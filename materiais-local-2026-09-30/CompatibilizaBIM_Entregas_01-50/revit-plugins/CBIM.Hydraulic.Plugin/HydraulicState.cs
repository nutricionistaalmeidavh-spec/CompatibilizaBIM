using System.IO;

namespace CBIM.Hydraulic.Plugin;

public static class HydraulicState
{
    public static string? LastPlanPath { get; set; }

    public static string WorkDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "CBIM", "Revit", "2027", "Work");

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

    public static string? FindLatestCorePlan()
    {
        if (!Directory.Exists(WorkDirectory)) return null;
        return Directory.GetFiles(WorkDirectory, "*.revit-plan.json")
            .Where(path => !path.EndsWith(".hydraulic.revit-plan.json", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();
    }

    public static string? FindLatestHydraulicPlan()
    {
        if (!string.IsNullOrWhiteSpace(LastPlanPath) && File.Exists(LastPlanPath)) return LastPlanPath;
        if (!Directory.Exists(WorkDirectory)) return null;
        return Directory.GetFiles(WorkDirectory, "*.hydraulic.revit-plan.json")
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();
    }
}
