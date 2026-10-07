namespace CBIM.Revit.Plugin;

public static class PluginState
{
    public static string? LastDwgPath { get; set; }
    public static string? LastPlanPath { get; set; }
    public static string OutputDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CBIM", "Revit", "2027", "Work");
    public static string CoreExecutable
    {
        get
        {
            var configured = Environment.GetEnvironmentVariable("CBIM_REVIT_CLI");
            if (!string.IsNullOrWhiteSpace(configured)) return configured;
            var local = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CBIM", "Revit", "2027", "Core", "cbim-revit.cmd");
            return File.Exists(local) ? local : "cbim-revit";
        }
    }
}
