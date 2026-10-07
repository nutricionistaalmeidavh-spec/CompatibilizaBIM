using System.Text.Json.Serialization;

namespace CBIM.Sdk;

public static class CBIMContract
{
    public const string SchemaName = "CBIM";
    public const string SchemaVersion = "0.2.0";
}

public sealed record Point3D(
    [property: JsonPropertyName("x")] double X,
    [property: JsonPropertyName("y")] double Y,
    [property: JsonPropertyName("z")] double Z = 0.0
);

public sealed class SourceRef
{
    [JsonPropertyName("source_id")] public string SourceId { get; init; } = "";
    [JsonPropertyName("entity_id")] public string EntityId { get; init; } = "";
    [JsonPropertyName("source_type")] public string SourceType { get; init; } = "cad";
    [JsonPropertyName("layer")] public string? Layer { get; init; }
    [JsonPropertyName("metadata")] public Dictionary<string, object?> Metadata { get; init; } = [];
}

public sealed class Site
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("site");
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("latitude")] public double? Latitude { get; init; }
    [JsonPropertyName("longitude")] public double? Longitude { get; init; }
    [JsonPropertyName("elevation")] public double Elevation { get; init; }
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

public sealed class Building
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("building");
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("site_id")] public string? SiteId { get; init; }
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

public sealed class Storey
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("storey");
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("building_id")] public string? BuildingId { get; init; }
    [JsonPropertyName("elevation")] public double Elevation { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

public sealed class Material
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("material");
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("category")] public string? Category { get; init; }
    [JsonPropertyName("manufacturer")] public string? Manufacturer { get; init; }
    [JsonPropertyName("product_code")] public string? ProductCode { get; init; }
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

public sealed class SystemModel
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("system");
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("discipline")] public string Discipline { get; init; } = "other";
    [JsonPropertyName("classification")] public string? Classification { get; init; }
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(Wall), "wall")]
[JsonDerivedType(typeof(Column), "column")]
[JsonDerivedType(typeof(Beam), "beam")]
[JsonDerivedType(typeof(Slab), "slab")]
[JsonDerivedType(typeof(Door), "door")]
[JsonDerivedType(typeof(Window), "window")]
[JsonDerivedType(typeof(Space), "space")]
[JsonDerivedType(typeof(Pipe), "pipe")]
[JsonDerivedType(typeof(Fitting), "fitting")]
[JsonDerivedType(typeof(Equipment), "equipment")]
[JsonDerivedType(typeof(Stair), "stair")]
[JsonDerivedType(typeof(SanitaryTerminal), "sanitary_terminal")]
[JsonDerivedType(typeof(Furniture), "furniture")]
[JsonDerivedType(typeof(Opening), "opening")]
public abstract class Element
{
    [JsonPropertyName("id")] public string Id { get; init; } = "";
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("storey_id")] public string? StoreyId { get; init; }
    [JsonPropertyName("confidence")] public double Confidence { get; init; } = 1.0;
    [JsonPropertyName("review_state")] public string ReviewState { get; init; } = "auto";
    [JsonPropertyName("source_refs")] public List<SourceRef> SourceRefs { get; init; } = [];
    [JsonPropertyName("material_ids")] public List<string> MaterialIds { get; init; } = [];
    [JsonPropertyName("properties")] public Dictionary<string, object?> Properties { get; init; } = [];
}

public sealed class Wall : Element
{
    public Wall() => Id = Ids.New("wall");
    [JsonPropertyName("start")] public Point3D Start { get; init; } = new(0,0,0);
    [JsonPropertyName("end")] public Point3D End { get; init; } = new(0,0,0);
    [JsonPropertyName("thickness")] public double Thickness { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
}

public sealed class Column : Element
{
    public Column() => Id = Ids.New("column");
    [JsonPropertyName("center")] public Point3D Center { get; init; } = new(0,0,0);
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("depth")] public double Depth { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Beam : Element
{
    public Beam() => Id = Ids.New("beam");
    [JsonPropertyName("start")] public Point3D Start { get; init; } = new(0,0,0);
    [JsonPropertyName("end")] public Point3D End { get; init; } = new(0,0,0);
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
}

public sealed class Slab : Element
{
    public Slab() => Id = Ids.New("slab");
    [JsonPropertyName("boundary")] public List<Point3D> Boundary { get; init; } = [];
    [JsonPropertyName("thickness")] public double Thickness { get; init; }
}

public sealed class Door : Element
{
    public Door() => Id = Ids.New("door");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("host_id")] public string? HostId { get; init; }
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Window : Element
{
    public Window() => Id = Ids.New("window");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("sill_height")] public double SillHeight { get; init; } = 1.0;
    [JsonPropertyName("host_id")] public string? HostId { get; init; }
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Space : Element
{
    public Space() => Id = Ids.New("space");
    [JsonPropertyName("boundary")] public List<Point3D> Boundary { get; init; } = [];
    [JsonPropertyName("height")] public double Height { get; init; }
}

public sealed class Pipe : Element
{
    public Pipe() => Id = Ids.New("pipe");
    [JsonPropertyName("path")] public List<Point3D> Path { get; init; } = [];
    [JsonPropertyName("diameter")] public double Diameter { get; init; }
    [JsonPropertyName("system_id")] public string? SystemId { get; init; }
    [JsonPropertyName("slope")] public double? Slope { get; init; }
}

public sealed class Fitting : Element
{
    public Fitting() => Id = Ids.New("fitting");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("fitting_type")] public string FittingType { get; init; } = "other";
    [JsonPropertyName("nominal_diameter")] public double? NominalDiameter { get; init; }
    [JsonPropertyName("system_id")] public string? SystemId { get; init; }
}

public sealed class Equipment : Element
{
    public Equipment() => Id = Ids.New("equipment");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("equipment_type")] public string EquipmentType { get; init; } = "";
    [JsonPropertyName("system_id")] public string? SystemId { get; init; }
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Stair : Element
{
    public Stair() => Id = Ids.New("stair");
    [JsonPropertyName("boundary")] public List<Point3D> Boundary { get; init; } = [];
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("riser_count")] public int RiserCount { get; init; }
    [JsonPropertyName("tread_depth")] public double TreadDepth { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("direction_deg")] public double DirectionDeg { get; init; }
}

public sealed class SanitaryTerminal : Element
{
    public SanitaryTerminal() => Id = Ids.New("sanitary");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("terminal_type")] public string TerminalType { get; init; } = "other";
    [JsonPropertyName("width")] public double Width { get; init; } = 0.60;
    [JsonPropertyName("depth")] public double Depth { get; init; } = 0.50;
    [JsonPropertyName("height")] public double Height { get; init; } = 0.85;
    [JsonPropertyName("system_id")] public string? SystemId { get; init; }
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Furniture : Element
{
    public Furniture() => Id = Ids.New("furniture");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("furniture_type")] public string FurnitureType { get; init; } = "generic";
    [JsonPropertyName("width")] public double Width { get; init; } = 1.0;
    [JsonPropertyName("depth")] public double Depth { get; init; } = 0.60;
    [JsonPropertyName("height")] public double Height { get; init; } = 0.90;
    [JsonPropertyName("rotation_deg")] public double RotationDeg { get; init; }
}

public sealed class Opening : Element
{
    public Opening() => Id = Ids.New("opening");
    [JsonPropertyName("position")] public Point3D Position { get; init; } = new(0,0,0);
    [JsonPropertyName("width")] public double Width { get; init; }
    [JsonPropertyName("height")] public double Height { get; init; }
    [JsonPropertyName("depth")] public double? Depth { get; init; }
    [JsonPropertyName("host_id")] public string? HostId { get; init; }
}

public sealed class Relation
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("relation");
    [JsonPropertyName("type")] public string Type { get; init; } = "connects";
    [JsonPropertyName("from_id")] public string FromId { get; init; } = "";
    [JsonPropertyName("to_id")] public string ToId { get; init; } = "";
    [JsonPropertyName("metadata")] public Dictionary<string, object?> Metadata { get; init; } = [];
}

public sealed class CBIMProject
{
    [JsonPropertyName("id")] public string Id { get; init; } = Ids.New("project");
    [JsonPropertyName("schema")] public string Schema { get; init; } = CBIMContract.SchemaName;
    [JsonPropertyName("schema_version")] public string SchemaVersion { get; init; } = CBIMContract.SchemaVersion;
    [JsonPropertyName("name")] public string Name { get; init; } = "";
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    [JsonPropertyName("units")] public string Units { get; init; } = "m";
    [JsonPropertyName("coordinate_reference")] public string CoordinateReference { get; init; } = "local";
    [JsonPropertyName("sites")] public List<Site> Sites { get; init; } = [];
    [JsonPropertyName("buildings")] public List<Building> Buildings { get; init; } = [];
    [JsonPropertyName("storeys")] public List<Storey> Storeys { get; init; } = [];
    [JsonPropertyName("materials")] public List<Material> Materials { get; init; } = [];
    [JsonPropertyName("systems")] public List<SystemModel> Systems { get; init; } = [];
    [JsonPropertyName("elements")] public List<Element> Elements { get; init; } = [];
    [JsonPropertyName("relations")] public List<Relation> Relations { get; init; } = [];
    [JsonPropertyName("metadata")] public Dictionary<string, object?> Metadata { get; init; } = [];
}

internal static class Ids
{
    public static string New(string prefix) => $"{prefix}_{Guid.NewGuid():N}"[..(prefix.Length + 17)];
}
