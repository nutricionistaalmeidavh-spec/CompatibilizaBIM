namespace CBIM.Library.Revit2027.Models;

public sealed class AppSettings
{
    public string LibraryRootPath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "CBIM Library");
    public string ManifestUrl { get; set; } = "";
    public string UpdateChannel { get; set; } = "stable";
    public string TrustedManifestPublicKeyPem { get; set; } = "";
    public string TeamLibraryPath { get; set; } = "";
    public bool RequireSignedManifest { get; set; }
    public bool LearningEnabled { get; set; } = true;
}
