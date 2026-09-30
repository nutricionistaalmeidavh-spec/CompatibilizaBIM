using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CBIM.Library.Contracts;

public sealed class RemoteManifest
{
    public string Schema { get; set; } = "cbim-library-manifest/v2";
    public string Version { get; set; } = "2.0";
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
    public string Channel { get; set; } = "stable";
    public string Signature { get; set; } = "";
    public string PublicKeyFingerprint { get; set; } = "";
    public List<RemotePackage> Packages { get; set; } = new();
}

public sealed class RemotePackage
{
    public string Id { get; set; } = "";
    public string Version { get; set; } = "";
    public string Category { get; set; } = "Geral";
    public string Channel { get; set; } = "stable";
    public int MinRevit { get; set; } = 2027;
    public int MaxRevit { get; set; } = 2027;
    public string Url { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Size { get; set; }
    public List<RemoteFile> Files { get; set; } = new();
}

public sealed class RemoteFile
{
    public string RelativePath { get; set; } = "";
    public string Url { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Size { get; set; }
}

public sealed class ProjectKit
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string TemplatePath { get; set; } = "";
    public string StandardsRvtPath { get; set; } = "";
    public List<ProjectKitFamily> Families { get; set; } = new();
}

public sealed class ProjectKitFamily
{
    public string Path { get; set; } = "";
    public string TypeName { get; set; } = "";
}

public sealed class CbimVocabularyItem
{
    public string Sha256 { get; set; } = "";
    public string Name { get; set; } = "";
    public string Manufacturer { get; set; } = "";
    public string Discipline { get; set; } = "";
    public string Category { get; set; } = "";
    public string System { get; set; } = "";
    public string Material { get; set; } = "";
    public double? NominalDiameterMm { get; set; }
    public string ProductCode { get; set; } = "";
    public List<string> TypeNames { get; set; } = new();
    public List<string> Aliases { get; set; } = new();
    public string TechnicalSignature { get; set; } = "";
    public int QualityScore { get; set; }
}

public sealed class LearningObservation
{
    public string Schema { get; set; } = "cbim-learning-observation/v1";
    public DateTime AtUtc { get; set; } = DateTime.UtcNow;
    public string Query { get; set; } = "";
    public string Action { get; set; } = "";
    public string ItemSha256 { get; set; } = "";
    public string ItemName { get; set; } = "";
    public string Discipline { get; set; } = "";
    public string Manufacturer { get; set; } = "";
    public string Context { get; set; } = "";
    public double Confidence { get; set; } = 1.0;
}

public sealed class CbimFeedback
{
    public string Schema { get; set; } = "cbim-learning-feedback/v1";
    public DateTime AtUtc { get; set; } = DateTime.UtcNow;
    public string Query { get; set; } = "";
    public string ItemSha256 { get; set; } = "";
    public string Alias { get; set; } = "";
    public string Action { get; set; } = "boost";
    public double Weight { get; set; } = 1.0;
}

public static class ManifestSecurity
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public static byte[] CanonicalBytes(RemoteManifest manifest)
    {
        var clone = new RemoteManifest
        {
            Schema = manifest.Schema,
            Version = manifest.Version,
            GeneratedAtUtc = manifest.GeneratedAtUtc,
            Channel = manifest.Channel,
            Signature = "",
            PublicKeyFingerprint = manifest.PublicKeyFingerprint,
            Packages = manifest.Packages
        };
        return JsonSerializer.SerializeToUtf8Bytes(clone, Json);
    }

    public static bool Verify(RemoteManifest manifest, string publicKeyPem)
    {
        if (string.IsNullOrWhiteSpace(manifest.Signature)) return false;
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        return rsa.VerifyData(CanonicalBytes(manifest), Convert.FromBase64String(manifest.Signature), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    }

    public static string Fingerprint(string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        var der = rsa.ExportSubjectPublicKeyInfo();
        return Convert.ToHexString(SHA256.HashData(der)).ToLowerInvariant();
    }
}
