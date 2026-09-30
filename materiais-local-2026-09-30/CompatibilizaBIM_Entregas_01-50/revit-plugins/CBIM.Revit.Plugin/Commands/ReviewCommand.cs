using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Revit.Contracts;

namespace CBIM.Revit.Plugin.Commands;

[Transaction(TransactionMode.ReadOnly)]
public sealed class ReviewCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (string.IsNullOrWhiteSpace(PluginState.LastPlanPath) || !File.Exists(PluginState.LastPlanPath))
        {
            TaskDialog.Show("CBIM Review", "Nenhum plano analisado nesta sessão.");
            return Result.Cancelled;
        }
        var plan = JsonContract.LoadPlan(PluginState.LastPlanPath!);
        var warnings = plan.Diagnostics.Count(d => d.Severity != "info");
        var unresolved = plan.Operations.Count(o => o.FamilyQuery is not null && o.ResolvedFamily is null);
        TaskDialog.Show("CBIM Review", $"Projeto: {plan.ProjectName}\nOperações: {plan.Operations.Count}\nAvisos/erros: {warnings}\nFamílias não resolvidas: {unresolved}\n\nO JSON mantém CBIM_ID e evidências para revisão no CompatibilizaBIM.");
        return Result.Succeeded;
    }
}
