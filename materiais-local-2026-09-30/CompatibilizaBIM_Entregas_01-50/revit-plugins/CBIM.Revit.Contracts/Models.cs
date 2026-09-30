using System.Text.Json;
using System.Text.Json.Serialization;

namespace CBIM.Revit.Contracts;

public sealed class RevitBuildPlan
{
    [JsonPropertyName("schema")] public string Schema { get; set; } = "CBIM.RevitBuildPlan";
    [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    [JsonPropertyName("revit_version")] public int RevitVersion { get; set; } = 2027;
    [JsonPropertyName("project_id")] public string ProjectId { get; set; } = "";
    [JsonPropertyName("project_name")] public string ProjectName { get; set; } = "";
    [JsonPropertyName("units")] public string Units { get; set; } = "m";
    [JsonPropertyName("coordinate_reference")] public string CoordinateReference { get; set; } = "local";
    [JsonPropertyName("operations")] public List<RevitBuildOperation> Operations { get; set; } = [];
    [JsonPropertyName("diagnostics")] public List<RevitBuildDiagnostic> Diagnostics { get; set; } = [];
    [JsonPropertyName("metadata")] public Dictionary<string, JsonElement> Metadata { get; set; } = [];
}

public sealed class RevitBuildOperation
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("cbim_id")] public string? CbimId { get; set; }
    [JsonPropertyName("action")] public string Action { get; set; } = "";
    [JsonPropertyName("category")] public string Category { get; set; } = "";
    [JsonPropertyName("storey_id")] public string? StoreyId { get; set; }
    [JsonPropertyName("level_name")] public string? LevelName { get; set; }
    [JsonPropertyName("dependencies")] public List<string> Dependencies { get; set; } = [];
    [JsonPropertyName("geometry")] public Dictionary<string, JsonElement> Geometry { get; set; } = [];
    [JsonPropertyName("parameters")] public Dictionary<string, JsonElement> Parameters { get; set; } = [];
    [JsonPropertyName("family_query")] public Dictionary<string, JsonElement>? FamilyQuery { get; set; }
    [JsonPropertyName("resolved_family")] public Dictionary<string, JsonElement>? ResolvedFamily { get; set; }
    [JsonPropertyName("source_refs")] public List<Dictionary<string, JsonElement>> SourceRefs { get; set; } = [];
}

public sealed class RevitBuildDiagnostic
{
    [JsonPropertyName("severity")] public string Severity { get; set; } = "info";
    [JsonPropertyName("code")] public string Code { get; set; } = "";
    [JsonPropertyName("message")] public string Message { get; set; } = "";
    [JsonPropertyName("cbim_ids")] public List<string> CbimIds { get; set; } = [];
    [JsonPropertyName("data")] public Dictionary<string, JsonElement> Data { get; set; } = [];
}

public sealed class LibraryManifest
{
    [JsonPropertyName("schema")] public string Schema { get; set; } = "CBIM.RevitLibraryManifest";
    [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    [JsonPropertyName("roots")] public List<string> Roots { get; set; } = [];
    [JsonPropertyName("families")] public List<LibraryFamilyRecord> Families { get; set; } = [];
}

public sealed class LibraryFamilyRecord
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("family_path")] public string FamilyPath { get; set; } = "";
    [JsonPropertyName("family_name")] public string FamilyName { get; set; } = "";
    [JsonPropertyName("type_name")] public string TypeName { get; set; } = "";
    [JsonPropertyName("semantic_class")] public string SemanticClass { get; set; } = "";
    [JsonPropertyName("subtype")] public string? Subtype { get; set; }
    [JsonPropertyName("manufacturer")] public string? Manufacturer { get; set; }
    [JsonPropertyName("systems")] public List<string> Systems { get; set; } = [];
    [JsonPropertyName("materials")] public List<string> Materials { get; set; } = [];
    [JsonPropertyName("nominal_diameters_m")] public List<double> NominalDiametersM { get; set; } = [];
    [JsonPropertyName("angles_deg")] public List<double> AnglesDeg { get; set; } = [];
    [JsonPropertyName("connector_count")] public int? ConnectorCount { get; set; }
    [JsonPropertyName("revit_versions")] public List<int> RevitVersions { get; set; } = [2027];
    [JsonPropertyName("source")] public string Source { get; set; } = "local";
    [JsonPropertyName("redistribution")] public string Redistribution { get; set; } = "unknown";
}

public static class JsonContract
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public static RevitBuildPlan LoadPlan(string path) =>
        JsonSerializer.Deserialize<RevitBuildPlan>(File.ReadAllText(path), Options)
        ?? throw new InvalidDataException($"Invalid Revit build plan: {path}");

    public static LibraryManifest LoadLibraryManifest(string path) =>
        JsonSerializer.Deserialize<LibraryManifest>(File.ReadAllText(path), Options)
        ?? throw new InvalidDataException($"Invalid library manifest: {path}");
}
