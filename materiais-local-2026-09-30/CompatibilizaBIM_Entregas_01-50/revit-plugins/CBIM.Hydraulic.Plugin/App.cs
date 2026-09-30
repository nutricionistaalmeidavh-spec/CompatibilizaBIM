using Autodesk.Revit.UI;

namespace CBIM.Hydraulic.Plugin;

public sealed class App : IExternalApplication
{
    public Result OnStartup(UIControlledApplication application)
    {
        const string tab = "CBIM";
        try { application.CreateRibbonTab(tab); } catch { }
        var panel = application.CreateRibbonPanel(tab, "CBIM Hidráulica");
        var assembly = typeof(App).Assembly.Location;
        AddButton(panel, "CBIM_Hyd_Refine", "Refinar\nrede", assembly, "CBIM.Hydraulic.Plugin.Commands.RefineHydraulicCommand", HydraulicIcon.Refine, "Refina a rede hidráulica identificada pelo CBIM.");
        AddButton(panel, "CBIM_Hyd_Build", "Construir\nMEP", assembly, "CBIM.Hydraulic.Plugin.Commands.BuildHydraulicCommand", HydraulicIcon.Build, "Cria a rede hidráulica nativa do Revit.");
        AddButton(panel, "CBIM_Hyd_QA", "QA\nHidráulica", assembly, "CBIM.Hydraulic.Plugin.Commands.HydraulicQaCommand", HydraulicIcon.Qa, "Verifica a qualidade e conectividade da rede hidráulica.");
        return Result.Succeeded;
    }
    public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;

    private static void AddButton(RibbonPanel panel, string id, string text, string assembly, string command, HydraulicIcon icon, string tooltip)
    {
        var button = (PushButton)panel.AddItem(new PushButtonData(id, text, assembly, command));
        button.LargeImage = RibbonIcons.Create(icon);
        button.ToolTip = tooltip;
    }
}
