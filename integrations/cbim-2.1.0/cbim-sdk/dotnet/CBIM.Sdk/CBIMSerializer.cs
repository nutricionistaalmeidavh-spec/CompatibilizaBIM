using System.Text.Json;

namespace CBIM.Sdk;

public static class CBIMSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = null,
        WriteIndented = true,
        PropertyNameCaseInsensitive = false
    };

    public static string Serialize(CBIMProject project) => JsonSerializer.Serialize(project, Options);

    public static CBIMProject Deserialize(string json)
    {
        var project = JsonSerializer.Deserialize<CBIMProject>(json, Options)
            ?? throw new JsonException("CBIM payload is empty");
        CBIMValidator.Validate(project);
        return project;
    }

    public static void Save(CBIMProject project, string path) => File.WriteAllText(path, Serialize(project));

    public static CBIMProject Load(string path) => Deserialize(File.ReadAllText(path));
}
