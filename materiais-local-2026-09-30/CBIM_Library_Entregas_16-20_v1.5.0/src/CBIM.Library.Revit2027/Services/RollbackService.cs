using System.Text.Json;

namespace CBIM.Library.Revit2027.Services;

public sealed class RollbackService
{
    private readonly LibraryPaths _paths; public RollbackService(LibraryPaths paths)=>_paths=paths;
    public IReadOnlyList<string> Backups(string packageId)
    { var root=Path.Combine(_paths.OfficialPrevious,Safe(packageId)); return Directory.Exists(root)?Directory.GetDirectories(root).OrderByDescending(x=>x).ToList():Array.Empty<string>(); }
    public void Restore(string packageId,string backup)
    {
        var current=Path.Combine(_paths.OfficialCurrent,Safe(packageId)); if(!Directory.Exists(backup))throw new DirectoryNotFoundException(backup);
        var safety=current+".rollback_"+DateTime.Now.ToString("yyyyMMdd_HHmmss"); if(Directory.Exists(current))Directory.Move(current,safety);
        Directory.Move(backup,current); if(Directory.Exists(safety))Directory.Delete(safety,true);
    }
    private static string Safe(string s)=>string.Concat(s.Select(c=>Path.GetInvalidFileNameChars().Contains(c)?'_':c));
}
