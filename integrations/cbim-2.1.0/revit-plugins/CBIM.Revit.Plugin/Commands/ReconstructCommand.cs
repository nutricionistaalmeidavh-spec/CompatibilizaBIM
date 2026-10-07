using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Revit.Contracts;
using Microsoft.Win32;

namespace CBIM.Revit.Plugin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class ReconstructCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var path = PluginState.LastPlanPath;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            var dialog = new OpenFileDialog { Filter = "CBIM Revit Build Plan (*.revit-plan.json)|*.revit-plan.json|JSON (*.json)|*.json", Title = "Selecionar plano CBIM/Revit" };
            if (dialog.ShowDialog() != true) return Result.Cancelled;
            path = dialog.FileName;
        }
        try
        {
            var plan = JsonContract.LoadPlan(path!);
            var created = new BuildPlanExecutor(commandData.Application.ActiveUIDocument.Document).Execute(plan);
            TaskDialog.Show("CBIM", $"Reconstrução nativa concluída. Operações criadas/rastreadas: {created.Count}.\nConexões MEP especializadas ficam para o plugin CBIM Hidráulica.");
            return Result.Succeeded;
        }
        catch (Exception ex) { message = ex.ToString(); return Result.Failed; }
    }
}
