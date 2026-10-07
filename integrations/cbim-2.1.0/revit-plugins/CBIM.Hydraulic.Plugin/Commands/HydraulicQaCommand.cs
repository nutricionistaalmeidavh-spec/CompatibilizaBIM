using System.IO;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Revit.Contracts;

namespace CBIM.Hydraulic.Plugin.Commands;

[Transaction(TransactionMode.ReadOnly)]
public sealed class HydraulicQaCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (string.IsNullOrWhiteSpace(HydraulicState.LastPlanPath) || !File.Exists(HydraulicState.LastPlanPath))
        {
            TaskDialog.Show("CBIM Hidráulica QA", "Nenhum plano hidráulico refinado nesta sessão.");
            return Result.Cancelled;
        }
        var plan = JsonContract.LoadPlan(HydraulicState.LastPlanPath!);
        var hyd = plan.Diagnostics.Where(d => d.Code.StartsWith("hydraulic_", StringComparison.OrdinalIgnoreCase)).ToList();
        var fittings = plan.Operations.Count(o => o.Action == "create_fitting");
        var pipes = plan.Operations.Count(o => o.Action == "create_pipe");
        TaskDialog.Show("CBIM Hidráulica QA", $"Trechos de tubo: {pipes}\nFittings solicitados: {fittings}\nDiagnósticos hidráulicos: {hyd.Count}\n\nNear-miss e transições compostas nunca são corrigidos silenciosamente.");
        return Result.Succeeded;
    }
}
