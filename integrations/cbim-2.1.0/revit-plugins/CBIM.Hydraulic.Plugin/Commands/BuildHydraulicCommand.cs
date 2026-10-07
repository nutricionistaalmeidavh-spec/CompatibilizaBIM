using System.IO;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Revit.Contracts;
using Microsoft.Win32;

namespace CBIM.Hydraulic.Plugin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class BuildHydraulicCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var path = HydraulicState.FindLatestHydraulicPlan() ?? HydraulicState.FindLatestCorePlan();
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            var dialog = new OpenFileDialog { Filter = "CBIM Revit Build Plan (*.json)|*.json" };
            if (dialog.ShowDialog() != true) return Result.Cancelled;
            path = dialog.FileName;
        }
        try
        {
            var plan = JsonContract.LoadPlan(path!);
            var builder = new NativeMepBuilder(commandData.Application.ActiveUIDocument.Document);
            var created = builder.Build(plan);
            var skipped = builder.SkippedShortPipeCount;
            TaskDialog.Show("CBIM Hidráulica", $"MEP nativo criado: {created} elementos/peças.\nTrechos CAD inválidos ou curtos ignorados: {skipped}.\n\nZ e diâmetros foram preservados do plano CBIM.");
            return Result.Succeeded;
        }
        catch (InvalidOperationException ex)
        {
            TaskDialog.Show("CBIM Hidráulica — revisão necessária", ex.Message);
            return Result.Cancelled;
        }
        catch (Exception ex) { message = ex.ToString(); return Result.Failed; }
    }
}
