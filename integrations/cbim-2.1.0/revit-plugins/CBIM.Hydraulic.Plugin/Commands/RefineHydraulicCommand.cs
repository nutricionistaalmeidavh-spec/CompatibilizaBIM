using System.Diagnostics;
using System.IO;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Microsoft.Win32;

namespace CBIM.Hydraulic.Plugin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class RefineHydraulicCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var input = HydraulicState.FindLatestCorePlan();
        if (string.IsNullOrWhiteSpace(input) || !File.Exists(input))
        {
            var dialog = new OpenFileDialog { Filter = "CBIM Revit Build Plan (*.revit-plan.json)|*.revit-plan.json|JSON (*.json)|*.json" };
            if (dialog.ShowDialog() != true) return Result.Cancelled;
            input = dialog.FileName;
        }
        var stem = Path.GetFileNameWithoutExtension(input).Replace(".revit-plan", "");
        var output = Path.Combine(Path.GetDirectoryName(input)!, stem + ".hydraulic.revit-plan.json");
        var psi = new ProcessStartInfo { FileName = HydraulicState.CoreExecutable, UseShellExecute = false, RedirectStandardError = true, CreateNoWindow = true };
        psi.ArgumentList.Add("refine-hydraulic"); psi.ArgumentList.Add("--plan"); psi.ArgumentList.Add(input); psi.ArgumentList.Add("--output"); psi.ArgumentList.Add(output);
        using var p = Process.Start(psi) ?? throw new InvalidOperationException("Não foi possível iniciar o CBIM Core.");
        var stderr = p.StandardError.ReadToEnd();
        p.WaitForExit();
        if (p.ExitCode != 0) { message = stderr; return Result.Failed; }
        HydraulicState.LastPlanPath = output;
        TaskDialog.Show("CBIM Hidráulica", $"Rede refinada a partir do último plano CBIM:\n{output}");
        return Result.Succeeded;
    }
}
