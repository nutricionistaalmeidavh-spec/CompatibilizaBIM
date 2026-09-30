using System.IO.Compression;
using System.Net.Http;
using System.Text.Json;
using CBIM.Library.Contracts;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class UpdateSummary
{
    public int Updated { get; set; }
    public int Current { get; set; }
    public int ReusedFiles { get; set; }
    public int DownloadedFiles { get; set; }
    public List<string> Errors { get; } = new();
}

public sealed class RemoteUpdateService
{
    private readonly LibraryPaths _paths;
    private readonly HttpClient _http=new(){Timeout=TimeSpan.FromMinutes(40)};
    private readonly JsonSerializerOptions _json=new(){WriteIndented=true,PropertyNameCaseInsensitive=true};
    public RemoteUpdateService(LibraryPaths paths)=>_paths=paths;

    public async Task<UpdateSummary> UpdateAsync(AppSettings settings,IProgress<string>? progress=null,CancellationToken token=default)
    {
        var manifestUrl=settings.ManifestUrl;
        if(string.IsNullOrWhiteSpace(manifestUrl))throw new InvalidOperationException("Configure a URL do manifest da biblioteca oficial.");
        var summary=new UpdateSummary(); var manifestJson=await _http.GetStringAsync(manifestUrl,token);
        var manifest=JsonSerializer.Deserialize<RemoteManifest>(manifestJson,_json)??throw new InvalidDataException("Manifest inválido.");
        ValidateManifest(manifest,settings);
        var installed=LoadVersions(); var manifestUri=new Uri(manifestUrl,UriKind.Absolute);
        foreach(var package in manifest.Packages.Where(x=>Compatible(x,settings.UpdateChannel)))
        {
            token.ThrowIfCancellationRequested(); if(installed.TryGetValue(package.Id,out var version)&&version==package.Version){summary.Current++;continue;}
            try
            {
                progress?.Report($"Atualizando {package.Id} {package.Version}...");
                if(package.Files.Count>0) await InstallDifferentialAsync(package,manifestUri,installed.TryGetValue(package.Id,out var old)?old:null,summary,progress,token);
                else await InstallZipAsync(package,manifestUri,installed.TryGetValue(package.Id,out var old)?old:null,token);
                installed[package.Id]=package.Version; SaveVersions(installed); summary.Updated++;
            }
            catch(Exception ex){summary.Errors.Add($"{package.Id}: {ex.Message}");}
        }
        return summary;
    }

    private void ValidateManifest(RemoteManifest manifest,AppSettings settings)
    {
        if(settings.RequireSignedManifest)
        {
            if(string.IsNullOrWhiteSpace(settings.TrustedManifestPublicKeyPem))throw new InvalidOperationException("Manifest assinado obrigatório, mas a chave pública confiável não foi configurada.");
            if(!ManifestSecurity.Verify(manifest,settings.TrustedManifestPublicKeyPem))throw new InvalidDataException("Assinatura do manifest oficial inválida.");
            var fp=ManifestSecurity.Fingerprint(settings.TrustedManifestPublicKeyPem);
            if(!string.IsNullOrWhiteSpace(manifest.PublicKeyFingerprint)&&!fp.Equals(manifest.PublicKeyFingerprint,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Fingerprint da chave do manifest não corresponde à chave confiável.");
        }
    }

    private static bool Compatible(RemotePackage p,string channel)
    {
        if(p.MinRevit>2027||p.MaxRevit<2027)return false;
        if(channel.Equals("preview",StringComparison.OrdinalIgnoreCase))return p.Channel is "stable" or "preview";
        return p.Channel.Equals("stable",StringComparison.OrdinalIgnoreCase);
    }

    private async Task InstallDifferentialAsync(RemotePackage package,Uri manifestUri,string? oldVersion,UpdateSummary summary,IProgress<string>? progress,CancellationToken token)
    {
        var current=Path.Combine(_paths.OfficialCurrent,Safe(package.Id)); var staging=Path.Combine(_paths.Cache,"update_"+Safe(package.Id)+"_"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        try
        {
            foreach(var remote in package.Files)
            {
                token.ThrowIfCancellationRequested(); var rel=SafeRelative(remote.RelativePath); var target=Path.Combine(staging,rel); Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                var existing=Path.Combine(current,rel);
                if(File.Exists(existing)&&new FileInfo(existing).Length==remote.Size)
                {
                    var sha=await LibraryIndexService.Sha256Async(existing,token);
                    if(sha.Equals(remote.Sha256,StringComparison.OrdinalIgnoreCase)){File.Copy(existing,target,true);summary.ReusedFiles++;continue;}
                }
                progress?.Report($"Baixando {package.Id}: {rel}"); await DownloadAsync(Resolve(manifestUri,remote.Url),target,token);
                var actual=await LibraryIndexService.Sha256Async(target,token); if(!actual.Equals(remote.Sha256,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException($"SHA-256 inválido: {package.Id}/{rel}");
                summary.DownloadedFiles++;
            }
            SwapPackage(package.Id,oldVersion,staging);
        }
        catch{if(Directory.Exists(staging))Directory.Delete(staging,true);throw;}
    }

    private async Task InstallZipAsync(RemotePackage package,Uri manifestUri,string? oldVersion,CancellationToken token)
    {
        var zipPath=Path.Combine(_paths.Downloads,$"{Safe(package.Id)}-{Safe(package.Version)}.zip"); await DownloadAsync(Resolve(manifestUri,package.Url),zipPath,token);
        if(!string.IsNullOrWhiteSpace(package.Sha256))
        {var actual=await LibraryIndexService.Sha256Async(zipPath,token);if(!actual.Equals(package.Sha256,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException($"SHA-256 inválido em {package.Id}.");}
        var staging=Path.Combine(_paths.Cache,"update_"+Safe(package.Id)+"_"+Guid.NewGuid().ToString("N")); Directory.CreateDirectory(staging);
        try{ZipFile.ExtractToDirectory(zipPath,staging,true);SwapPackage(package.Id,oldVersion,staging);}catch{if(Directory.Exists(staging))Directory.Delete(staging,true);throw;}
    }

    private void SwapPackage(string id,string? oldVersion,string staging)
    {
        var current=Path.Combine(_paths.OfficialCurrent,Safe(id));string? backup=null;
        if(Directory.Exists(current)){backup=Path.Combine(_paths.OfficialPrevious,Safe(id),$"{Safe(oldVersion??"unknown")}_{DateTime.Now:yyyyMMdd_HHmmss}");Directory.CreateDirectory(Path.GetDirectoryName(backup)!);Directory.Move(current,backup);}
        try{Directory.Move(staging,current);}catch{if(Directory.Exists(current))Directory.Delete(current,true);if(backup is not null&&Directory.Exists(backup))Directory.Move(backup,current);throw;}
    }
    private static string Resolve(Uri manifest,string url)=>Uri.TryCreate(url,UriKind.Absolute,out var abs)?abs.AbsoluteUri:new Uri(manifest,url).AbsoluteUri;
    private async Task DownloadAsync(string url,string output,CancellationToken token){Directory.CreateDirectory(Path.GetDirectoryName(output)!);using var response=await _http.GetAsync(url,HttpCompletionOption.ResponseHeadersRead,token);response.EnsureSuccessStatusCode();await using var input=await response.Content.ReadAsStreamAsync(token);await using var file=File.Create(output);await input.CopyToAsync(file,token);}
    private Dictionary<string,string> LoadVersions(){try{if(File.Exists(_paths.VersionsFile))return JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(_paths.VersionsFile),_json)??new();}catch{}return new(StringComparer.OrdinalIgnoreCase);}
    private void SaveVersions(Dictionary<string,string> v)=>File.WriteAllText(_paths.VersionsFile,JsonSerializer.Serialize(v,_json));
    private static string Safe(string v)=>string.Concat(v.Select(c=>Path.GetInvalidFileNameChars().Contains(c)?'_':c));
    private static string SafeRelative(string rel){var normalized=rel.Replace('/',Path.DirectorySeparatorChar).Replace('\\',Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);if(normalized.Split(Path.DirectorySeparatorChar).Any(x=>x==".."))throw new InvalidDataException("Caminho remoto inválido.");return normalized;}
}
