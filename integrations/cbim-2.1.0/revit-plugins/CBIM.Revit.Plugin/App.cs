using Autodesk.Revit.UI;

namespace CBIM.Revit.Plugin;

public sealed class App : IExternalApplication
{
    public Result OnStartup(UIControlledApplication application)
    {
        const string tab = "CBIM";
        try { application.CreateRibbonTab(tab); } catch { }
        var panel = application.CreateRibbonPanel(tab, "CBIM Core");
        var assembly = typeof(App).Assembly.Location;
        AddButton(panel, "CBIM_Import", "Importar\nDWG", assembly, "CBIM.Revit.Plugin.Commands.ImportDwgCommand", CoreIcon.Dwg, "Importa o desenho DWG para o fluxo CBIM.");
        AddButton(panel, "CBIM_Analyze", "Analisar", assembly, "CBIM.Revit.Plugin.Commands.AnalyzeCommand", CoreIcon.Analyze, "Analisa o DWG e identifica elementos BIM.");
        AddButton(panel, "CBIM_Reconstruct", "Reconstruir", assembly, "CBIM.Revit.Plugin.Commands.ReconstructCommand", CoreIcon.Reconstruct, "Reconstrói os elementos BIM a partir da análise.");
        AddButton(panel, "CBIM_Review", "Revisar", assembly, "CBIM.Revit.Plugin.Commands.ReviewCommand", CoreIcon.Review, "Revisa decisões e correções do modelo.");
        return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;

    private static void AddButton(RibbonPanel panel, string id, string text, string assembly, string command, CoreIcon icon, string tooltip)
    {
        var button = (PushButton)panel.AddItem(new PushButtonData(id, text, assembly, command));
        button.LargeImage = RibbonIcons.Create(icon);
        button.ToolTip = tooltip;
    }
}
