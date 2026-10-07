using System.Text.Json;
using CBIM.Revit.Contracts;

namespace CBIM.Library.Contract;

public sealed record LibraryResolution(string FamilyPath, string FamilyName, string TypeName, string? Manufacturer, string FamilyId);

public static class LibraryBridge
{
    public static string DefaultManifestPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "CBIM", "Library", "manifest.json");

    public static LibraryManifest? TryLoadDefaultManifest()
    {
        var path = DefaultManifestPath;
        if (!File.Exists(path)) return null;
        try { return JsonContract.LoadLibraryManifest(path); }
        catch { return null; }
    }

    public static LibraryResolution? ResolveFromOperation(RevitBuildOperation operation, LibraryManifest? manifest = null)
    {
        manifest ??= TryLoadDefaultManifest();
        if (operation.ResolvedFamily is { Count: > 0 })
        {
            var rf = operation.ResolvedFamily;
            var path = StringValue(rf, "family_path");
            if (path is not null && IsPathAllowed(path, manifest?.Roots ?? []))
                return new(path, StringValue(rf, "family_name") ?? Path.GetFileNameWithoutExtension(path), StringValue(rf, "type_name") ?? "", StringValue(rf, "manufacturer"), StringValue(rf, "family_id") ?? "resolved");
        }

        if (manifest is null || operation.FamilyQuery is null) return null;
        var semantic = StringValue(operation.FamilyQuery, "semantic_class");
        var subtype = StringValue(operation.FamilyQuery, "subtype");
        var revitVersion = IntValue(operation.FamilyQuery, "revit_version") ?? 2027;
        var diameter = DoubleValue(operation.FamilyQuery, "nominal_diameter_m");
        var manufacturer = StringValue(operation.FamilyQuery, "manufacturer");

        foreach (var family in manifest.Families)
        {
            if (!string.Equals(family.SemanticClass, semantic, StringComparison.OrdinalIgnoreCase)) continue;
            if (!string.IsNullOrWhiteSpace(subtype) && !string.IsNullOrWhiteSpace(family.Subtype) && !string.Equals(family.Subtype, subtype, StringComparison.OrdinalIgnoreCase)) continue;
            if (!family.RevitVersions.Contains(revitVersion)) continue;
            if (!string.IsNullOrWhiteSpace(manufacturer) && !string.IsNullOrWhiteSpace(family.Manufacturer) && !string.Equals(family.Manufacturer, manufacturer, StringComparison.OrdinalIgnoreCase)) continue;
            if (diameter.HasValue && family.NominalDiametersM.Count > 0 && family.NominalDiametersM.All(d => Math.Abs(d - diameter.Value) > 0.0006)) continue;
            if (!IsPathAllowed(family.FamilyPath, manifest.Roots)) continue;
            return new(family.FamilyPath, family.FamilyName, family.TypeName, family.Manufacturer, family.Id);
        }
        return null;
    }

    public static bool IsPathAllowed(string familyPath, IEnumerable<string> roots)
    {
        if (!File.Exists(familyPath) || !string.Equals(Path.GetExtension(familyPath), ".rfa", StringComparison.OrdinalIgnoreCase)) return false;
        var full = Path.GetFullPath(familyPath);
        foreach (var root in roots)
        {
            if (string.IsNullOrWhiteSpace(root)) continue;
            var r = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (full.StartsWith(r, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static string? StringValue(IReadOnlyDictionary<string, JsonElement> values, string key) =>
        values.TryGetValue(key, out var v) && v.ValueKind != JsonValueKind.Null ? v.ToString() : null;
    private static int? IntValue(IReadOnlyDictionary<string, JsonElement> values, string key) =>
        values.TryGetValue(key, out var v) && v.TryGetInt32(out var n) ? n : null;
    private static double? DoubleValue(IReadOnlyDictionary<string, JsonElement> values, string key) =>
        values.TryGetValue(key, out var v) && v.TryGetDouble(out var n) ? n : null;
}
