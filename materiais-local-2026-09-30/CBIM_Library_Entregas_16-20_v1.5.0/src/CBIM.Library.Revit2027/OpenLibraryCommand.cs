using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Library.Revit2027.UI;

namespace CBIM.Library.Revit2027;

[Transaction(TransactionMode.Manual)]
public sealed class OpenLibraryCommand : IExternalCommand
{
    private static LibraryWindow? _window;

    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        if (_window is { IsVisible: true })
        {
            _window.Activate();
            return Result.Succeeded;
        }

        var handler = new RevitActionHandler();
        var externalEvent = ExternalEvent.Create(handler);
        _window = new LibraryWindow(handler, externalEvent);
        _window.Closed += (_, _) => _window = null;
        _window.Show();
        return Result.Succeeded;
    }
}
