using Autodesk.Revit.UI;
using System.Reflection;
using System.Windows.Media.Imaging;

namespace CBIM.Library.Revit2027;

public sealed class App : IExternalApplication
{
    public Result OnStartup(UIControlledApplication application)
    {
        const string tab = "CBIM";
        try { application.CreateRibbonTab(tab); } catch { }
        var panel = application.CreateRibbonPanel(tab, "Library");
        var assembly = Assembly.GetExecutingAssembly().Location;
        var button = new PushButtonData(
            "CBIM.Library.Open",
            "Biblioteca\nBIM",
            assembly,
            typeof(OpenLibraryCommand).FullName!);
        button.ToolTip = "Abre a biblioteca BIM local, importação e atualizações.";
        var ribbonButton = (PushButton)panel.AddItem(button);
        ribbonButton.LargeImage = RibbonIcon.Create();
        return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;
}
