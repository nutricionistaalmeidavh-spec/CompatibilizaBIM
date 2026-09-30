using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace CBIM.Revit.Plugin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class AnalyzeCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (string.IsNullOrWhiteSpace(PluginState.LastDwgPath) || !File.Exists(PluginState.LastDwgPath))
        {
            TaskDialog.Show("CBIM", "Selecione primeiro um DWG em Importar DWG.");
            return Result.Cancelled;
        }
        try
        {
            var plan = CoreProcess.AnalyzeDwg(PluginState.LastDwgPath!);
            TaskDialog.Show("CBIM", $"Análise concluída.\nPlano Revit:\n{plan}");
            return Result.Succeeded;
        }
        catch (Exception ex) { message = ex.Message; return Result.Failed; }
    }
}
