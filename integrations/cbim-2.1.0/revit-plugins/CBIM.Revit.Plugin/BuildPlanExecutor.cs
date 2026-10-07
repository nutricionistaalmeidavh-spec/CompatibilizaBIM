using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using CBIM.Library.Contract;
using CBIM.Revit.Contracts;

namespace CBIM.Revit.Plugin;

public sealed class BuildPlanExecutor
{
    private const double FeetPerMetre = 3.280839895013123;
    private readonly Document _doc;
    private readonly Dictionary<string, ElementId> _created = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Level> _levelsByStorey = new(StringComparer.OrdinalIgnoreCase);

    public BuildPlanExecutor(Document doc) => _doc = doc;

    public IReadOnlyDictionary<string, ElementId> Execute(RevitBuildPlan plan)
    {
        using var group = new TransactionGroup(_doc, $"CBIM — {plan.ProjectName}");
        group.Start();
        foreach (var operation in plan.Operations)
        {
            if (operation.Action is "create_pipe" or "create_fitting") continue; // CBIM Hidráulica owns native MEP and connectors
            using var tx = new Transaction(_doc, $"CBIM {operation.Action}");
            tx.Start();
            try
            {
                Element? element = operation.Action switch
                {
                    "ensure_level" => EnsureLevel(operation),
                    "create_wall" => CreateWall(operation),
                    "create_floor" => CreateFloor(operation),
                    "place_family_instance" => PlaceFamily(operation),
                    _ => null,
                };
                if (element is not null && !string.IsNullOrWhiteSpace(operation.CbimId))
                {
                    StampCbimId(element, operation.CbimId!);
                    _created[operation.Id] = element.Id;
                }
                tx.Commit();
            }
            catch
            {
                tx.RollBack();
                throw;
            }
        }
        group.Assimilate();
        return _created;
    }

    private Level EnsureLevel(RevitBuildOperation op)
    {
        var elevation = GetDouble(op.Parameters, "elevation_m") * FeetPerMetre;
        var name = op.LevelName ?? op.StoreyId ?? "CBIM Level";
        var level = new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>()
            .FirstOrDefault(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase) && Math.Abs(x.Elevation - elevation) < 0.01)
            ?? Level.Create(_doc, elevation);
        if (level.Name != name) level.Name = name;
        if (!string.IsNullOrWhiteSpace(op.StoreyId)) _levelsByStorey[op.StoreyId!] = level;
        return level;
    }

    private Wall CreateWall(RevitBuildOperation op)
    {
        var level = ResolveLevel(op);
        var a = GetPoint(op.Geometry, "start");
        var b = GetPoint(op.Geometry, "end");
        var height = Math.Max(0.01, GetDouble(op.Parameters, "height_m")) * FeetPerMetre;
        var type = new FilteredElementCollector(_doc).OfClass(typeof(WallType)).Cast<WallType>()
            .OrderBy(x => Math.Abs(x.Width - Math.Max(0.001, GetDouble(op.Parameters, "thickness_m")) * FeetPerMetre)).First();
        return Wall.Create(_doc, Line.CreateBound(a, b), type.Id, level.Id, height, 0.0, false, false);
    }

    private Floor CreateFloor(RevitBuildOperation op)
    {
        var level = ResolveLevel(op);
        var points = GetPointArray(op.Geometry, "boundary");
        if (points.Count < 3) throw new InvalidDataException("Floor boundary needs at least three points.");
        var loop = new CurveLoop();
        for (var i = 0; i < points.Count; i++) loop.Append(Line.CreateBound(points[i], points[(i + 1) % points.Count]));
        var type = new FilteredElementCollector(_doc).OfClass(typeof(FloorType)).Cast<FloorType>().First();
        return Floor.Create(_doc, new List<CurveLoop> { loop }, type.Id, level.Id);
    }

    private FamilyInstance? PlaceFamily(RevitBuildOperation op)
    {
        var resolution = LibraryBridge.ResolveFromOperation(op);
        if (resolution is null) return null;
        if (!_doc.LoadFamily(resolution.FamilyPath, out var family))
            family = new FilteredElementCollector(_doc).OfClass(typeof(Family)).Cast<Family>().FirstOrDefault(f => f.Name == resolution.FamilyName);
        if (family is null) return null;
        var symbols = family.GetFamilySymbolIds().Select(id => _doc.GetElement(id)).OfType<FamilySymbol>().ToList();
        var symbol = symbols.FirstOrDefault(s => string.Equals(s.Name, resolution.TypeName, StringComparison.OrdinalIgnoreCase)) ?? symbols.FirstOrDefault();
        if (symbol is null) return null;
        if (!symbol.IsActive) symbol.Activate();
        var level = ResolveLevel(op);
        var point = GetPoint(op.Geometry, "position");
        return _doc.Create.NewFamilyInstance(point, symbol, level, StructuralType.NonStructural);
    }

    private Level ResolveLevel(RevitBuildOperation op)
    {
        if (!string.IsNullOrWhiteSpace(op.StoreyId) && _levelsByStorey.TryGetValue(op.StoreyId!, out var cached)) return cached;
        var name = op.LevelName;
        var level = new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>()
            .FirstOrDefault(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase));
        return level ?? new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>().OrderBy(x => x.Elevation).First();
    }

    private static void StampCbimId(Element element, string cbimId)
    {
        // If the user's template contains the CBIM_ID shared parameter, use it. Otherwise preserve traceability in Comments.
        var p = element.LookupParameter("CBIM_ID") ?? element.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
        if (p is { IsReadOnly: false }) p.Set(element.LookupParameter("CBIM_ID") is not null ? cbimId : $"CBIM_ID:{cbimId}");
    }

    private static double GetDouble(IReadOnlyDictionary<string, JsonElement> dict, string key) =>
        dict.TryGetValue(key, out var value) && value.TryGetDouble(out var number) ? number : 0.0;

    private static XYZ GetPoint(IReadOnlyDictionary<string, JsonElement> dict, string key)
    {
        if (!dict.TryGetValue(key, out var value)) throw new KeyNotFoundException(key);
        return PointFromJson(value);
    }

    private static List<XYZ> GetPointArray(IReadOnlyDictionary<string, JsonElement> dict, string key)
    {
        if (!dict.TryGetValue(key, out var value) || value.ValueKind != JsonValueKind.Array) return [];
        return value.EnumerateArray().Select(PointFromJson).ToList();
    }

    private static XYZ PointFromJson(JsonElement value)
    {
        var x = value.GetProperty("x").GetDouble() * FeetPerMetre;
        var y = value.GetProperty("y").GetDouble() * FeetPerMetre;
        var z = value.TryGetProperty("z", out var zv) ? zv.GetDouble() * FeetPerMetre : 0.0;
        return new XYZ(x, y, z);
    }
}
