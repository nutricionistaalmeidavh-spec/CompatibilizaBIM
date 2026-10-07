using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Microsoft.Win32;

namespace CBIM.Revit.Plugin.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class ImportDwgCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        var dialog = new OpenFileDialog { Filter = "AutoCAD DWG (*.dwg)|*.dwg", Multiselect = false, Title = "Selecionar DWG para o CBIM" };
        if (dialog.ShowDialog() != true) return Result.Cancelled;
        PluginState.LastDwgPath = dialog.FileName;
        TaskDialog.Show("CBIM", $"DWG selecionado:\n{dialog.FileName}\n\nUse Analisar para executar o CBIM Core sem IFC intermediário.");
        return Result.Succeeded;
    }
}
