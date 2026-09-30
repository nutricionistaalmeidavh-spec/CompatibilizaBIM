using System.Diagnostics;
using System.Text;

namespace CBIM.Revit.Plugin;

public static class CoreProcess
{
    public static string AnalyzeDwg(string dwgPath, string discipline = "all")
    {
        Directory.CreateDirectory(PluginState.OutputDirectory);
        var psi = new ProcessStartInfo
        {
            FileName = PluginState.CoreExecutable,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        psi.ArgumentList.Add("analyze-dwg");
        psi.ArgumentList.Add("--dwg"); psi.ArgumentList.Add(dwgPath);
        psi.ArgumentList.Add("--output"); psi.ArgumentList.Add(PluginState.OutputDirectory);
        psi.ArgumentList.Add("--discipline"); psi.ArgumentList.Add(discipline);
        var libraryManifest = CBIM.Library.Contract.LibraryBridge.DefaultManifestPath;
        if (File.Exists(libraryManifest)) { psi.ArgumentList.Add("--library-manifest"); psi.ArgumentList.Add(libraryManifest); }
        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Unable to start cbim-revit CLI.");
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException($"CBIM Core failed ({process.ExitCode}): {stderr}");
        var plan = Path.Combine(PluginState.OutputDirectory, Path.GetFileNameWithoutExtension(dwgPath) + ".revit-plan.json");
        if (!File.Exists(plan)) throw new FileNotFoundException("CBIM Core did not emit a Revit build plan.", plan);
        PluginState.LastPlanPath = plan;
        return plan;
    }
}
