using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class LibraryPaths
{
    public string Root { get; }
    public string OfficialCurrent => Path.Combine(Root, "Official", "Current");
    public string OfficialPrevious => Path.Combine(Root, "Official", "Previous");
    public string MyLibrary => Path.Combine(Root, "My Library");
    public string Inbox => Path.Combine(Root, "Inbox");
    public string Cache => Path.Combine(Root, "Cache");
    public string Thumbnails => Path.Combine(Root, "Thumbnails");
    public string Downloads => Path.Combine(Root, "Downloads");
    public string Database => Path.Combine(Root, "Database");
    public string Reports => Path.Combine(Root, "Reports");
    public string Bridge => Path.Combine(Root, "Bridge");
    public string BridgeInbox => Path.Combine(Bridge, "Inbox");
    public string BridgeOutbox => Path.Combine(Bridge, "Outbox");
    public string CatalogFile => Path.Combine(Database, "catalog.json");
    public string IndexStateFile => Path.Combine(Database, "index-state.json");
    public string VersionsFile => Path.Combine(Database, "official-versions.json");
    public string OverridesFile => Path.Combine(Database, "classification-overrides.json");
    public string ProjectKitsFile => Path.Combine(Database, "project-kits.json");
    public string LearningFile => Path.Combine(BridgeOutbox, "learning-observations.jsonl");
    public string FeedbackFile => Path.Combine(BridgeInbox, "cbim-feedback.jsonl");
    public string VocabularyFile => Path.Combine(BridgeOutbox, "cbim-library-vocabulary.json");
    public string QuantityCatalogFile => Path.Combine(BridgeOutbox, "cbim-quantity-catalog.json");
    public string TeamLibrary { get; }

    public LibraryPaths(AppSettings settings)
    {
        Root = Environment.ExpandEnvironmentVariables(settings.LibraryRootPath);
        TeamLibrary = Environment.ExpandEnvironmentVariables(settings.TeamLibraryPath ?? "");
        foreach (var path in new[] { OfficialCurrent, OfficialPrevious, MyLibrary, Inbox, Cache, Thumbnails, Downloads, Database, Reports, BridgeInbox, BridgeOutbox })
            Directory.CreateDirectory(path);
    }
}
