using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using CBIM.Library.Contracts;

if (args.Contains("--generate-keypair"))
{
    var i=Array.IndexOf(args,"--generate-keypair"); var dir=i>=0&&i+1<args.Length?Path.GetFullPath(args[i+1]):Path.GetFullPath("keys"); Directory.CreateDirectory(dir);
    using var rsa=RSA.Create(3072); File.WriteAllText(Path.Combine(dir,"cbim-manifest-private.pem"),rsa.ExportPkcs8PrivateKeyPem()); File.WriteAllText(Path.Combine(dir,"cbim-manifest-public.pem"),rsa.ExportSubjectPublicKeyInfoPem());
    Console.WriteLine("Chaves geradas. A chave PRIVADA deve permanecer somente com o Publisher."); return 0;
}
if(args.Length<4||!args.Contains("--source")||!args.Contains("--out"))
{
    Console.WriteLine("CBIM Library Publisher 1.5");
    Console.WriteLine("Uso: --source C:\\BIM_MASTER --out C:\\Release [--base-url https://host] [--channel stable|preview] [--previous-manifest arquivo] [--sign-private-key chave.pem] [--mode both|differential|zip]"); return 2;
}
string Arg(string name,string fallback=""){var i=Array.IndexOf(args,name);return i>=0&&i+1<args.Length?args[i+1]:fallback;}
var source=Path.GetFullPath(Arg("--source"));var output=Path.GetFullPath(Arg("--out"));var baseUrl=Arg("--base-url").TrimEnd('/');var channel=Arg("--channel","stable").ToLowerInvariant();var mode=Arg("--mode","both").ToLowerInvariant();
var previousPath=Arg("--previous-manifest");var privateKeyPath=Arg("--sign-private-key");
if(!Directory.Exists(source)){Console.Error.WriteLine("Pasta fonte inexistente.");return 3;} Directory.CreateDirectory(output); Directory.CreateDirectory(Path.Combine(output,"packages"));Directory.CreateDirectory(Path.Combine(output,"files"));
RemoteManifest? previous=null;try{if(File.Exists(previousPath))previous=JsonSerializer.Deserialize<RemoteManifest>(File.ReadAllText(previousPath),JsonOpts());}catch{}
var manifest=new RemoteManifest{Version="2.0",Channel=channel,GeneratedAtUtc=DateTime.UtcNow};var staging=new List<object>();
foreach(var dir in Directory.GetDirectories(source).OrderBy(x=>x))
{
    var id=Path.GetFileName(dir);var versionFile=Path.Combine(dir,"VERSION.txt");var version=File.Exists(versionFile)?File.ReadAllText(versionFile).Trim():DateTime.Now.ToString("yyyy.MM.dd.HHmm");
    var pkg=new RemotePackage{Id=id,Version=version,Category=id,Channel=channel,MinRevit=2027,MaxRevit=2027};
    var prev=previous?.Packages.FirstOrDefault(x=>x.Id.Equals(id,StringComparison.OrdinalIgnoreCase));var newCount=0;var changedCount=0;var unchangedCount=0;
    foreach(var file in Directory.GetFiles(dir,"*",SearchOption.AllDirectories).Where(x=>!Path.GetFileName(x).Equals("VERSION.txt",StringComparison.OrdinalIgnoreCase)).OrderBy(x=>x))
    {
        var rel=Path.GetRelativePath(dir,file).Replace('\\','/');var sha=Sha(file);var size=new FileInfo(file).Length;var old=prev?.Files.FirstOrDefault(x=>x.RelativePath.Equals(rel,StringComparison.OrdinalIgnoreCase));
        if(old is null)newCount++;else if(old.Sha256.Equals(sha,StringComparison.OrdinalIgnoreCase))unchangedCount++;else changedCount++;
        var destination=Path.Combine(output,"files",Safe(id),rel.Replace('/',Path.DirectorySeparatorChar));Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        if(mode is "both" or "differential") File.Copy(file,destination,true);
        var url=Url(baseUrl,$"files/{Uri.EscapeDataString(Safe(id))}/{EscapePath(rel)}");pkg.Files.Add(new RemoteFile{RelativePath=rel,Url=url,Sha256=sha,Size=size});
    }
    var removed=prev?.Files.Count(x=>!pkg.Files.Any(n=>n.RelativePath.Equals(x.RelativePath,StringComparison.OrdinalIgnoreCase)))??0;
    if(mode is "both" or "zip")
    {
        var fileName=$"{Safe(id)}-{Safe(version)}.zip";var zip=Path.Combine(output,"packages",fileName);if(File.Exists(zip))File.Delete(zip);ZipFile.CreateFromDirectory(dir,zip,CompressionLevel.SmallestSize,false);pkg.Sha256=Sha(zip);pkg.Size=new FileInfo(zip).Length;pkg.Url=Url(baseUrl,"packages/"+Uri.EscapeDataString(fileName));
    }
    manifest.Packages.Add(pkg);staging.Add(new{id,version,newFiles=newCount,changedFiles=changedCount,unchangedFiles=unchangedCount,removedFiles=removed,totalFiles=pkg.Files.Count});
    Console.WriteLine($"{id}: {pkg.Files.Count} arquivos | +{newCount} ~{changedCount} ={unchangedCount} -{removed}");
}
if(File.Exists(privateKeyPath))
{
    var privatePem=File.ReadAllText(privateKeyPath);using var rsa=RSA.Create();rsa.ImportFromPem(privatePem);var publicPem=rsa.ExportSubjectPublicKeyInfoPem();manifest.PublicKeyFingerprint=ManifestSecurity.Fingerprint(publicPem);manifest.Signature=SignManifest(manifest,privatePem);
}
File.WriteAllText(Path.Combine(output,"manifest.json"),JsonSerializer.Serialize(manifest,JsonOpts()));File.WriteAllText(Path.Combine(output,"staging-report.json"),JsonSerializer.Serialize(new{generatedAtUtc=DateTime.UtcNow,channel,packages=staging},JsonOpts()));
Console.WriteLine("Manifest e staging report gerados.");return 0;

static string SignManifest(RemoteManifest manifest,string privatePem){using var rsa=RSA.Create();rsa.ImportFromPem(privatePem);var bytes=ManifestSecurity.CanonicalBytes(manifest);return Convert.ToBase64String(rsa.SignData(bytes,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1));}
static JsonSerializerOptions JsonOpts()=>new(){WriteIndented=true,PropertyNameCaseInsensitive=true};
static string Safe(string s)=>string.Concat(s.Select(c=>Path.GetInvalidFileNameChars().Contains(c)?'_':c));
static string Sha(string p){using var fs=File.OpenRead(p);return Convert.ToHexString(SHA256.HashData(fs)).ToLowerInvariant();}
static string EscapePath(string rel)=>string.Join('/',rel.Split('/').Select(Uri.EscapeDataString));
static string Url(string baseUrl,string rel)=>string.IsNullOrWhiteSpace(baseUrl)?rel:$"{baseUrl}/{rel}";
