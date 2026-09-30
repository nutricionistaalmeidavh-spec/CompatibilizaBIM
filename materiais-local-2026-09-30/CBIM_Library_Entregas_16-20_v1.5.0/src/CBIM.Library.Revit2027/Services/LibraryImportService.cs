using System.IO.Compression;

namespace CBIM.Library.Revit2027.Services;

public sealed class ImportResult
{
    public int Imported { get; set; }
    public int Duplicates { get; set; }
    public int Ignored { get; set; }
    public List<string> Errors { get; } = new();
}

public sealed class LibraryImportService
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    { ".rfa", ".rvt", ".ifc", ".ifczip", ".rte", ".rft", ".dwg", ".dxf", ".skp", ".step", ".stp", ".sat" };
    private readonly LibraryPaths _paths;
    private readonly LibraryIndexService _index;
    public LibraryImportService(LibraryPaths paths, LibraryIndexService index){_paths=paths;_index=index;}

    public async Task<ImportResult> ImportAsync(IEnumerable<string> dropped,CancellationToken token=default)
    {
        var result=new ImportResult(); var known=_index.LoadCatalog().Select(x=>x.Sha256).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var session=Path.Combine(_paths.MyLibrary,"Imported",DateTime.Now.ToString("yyyy-MM-dd_HHmmss")); Directory.CreateDirectory(session);
        var inputs=new List<string>();
        foreach(var path in dropped)
        {
            if(File.Exists(path)&&Path.GetExtension(path).Equals(".zip",StringComparison.OrdinalIgnoreCase))
            {
                var temp=Path.Combine(_paths.Cache,"import_"+Guid.NewGuid().ToString("N")); Directory.CreateDirectory(temp);
                try{ZipFile.ExtractToDirectory(path,temp,true);inputs.Add(temp);}catch(Exception ex){result.Errors.Add(ex.Message);}
            }
            else inputs.Add(path);
        }
        foreach(var input in inputs)
        {
            IEnumerable<string> files=File.Exists(input)?new[]{input}:Directory.Exists(input)?Directory.EnumerateFiles(input,"*",SearchOption.AllDirectories):Array.Empty<string>();
            foreach(var file in files)
            {
                token.ThrowIfCancellationRequested(); var ext=Path.GetExtension(file); if(!Allowed.Contains(ext)){result.Ignored++;continue;}
                try
                {
                    var sha=await LibraryIndexService.Sha256Async(file,token); if(!known.Add(sha)){result.Duplicates++;continue;}
                    var relativeRoot=Directory.Exists(input)?Path.GetRelativePath(input,file):Path.GetFileName(file);
                    var destination=UniquePath(session,relativeRoot); Directory.CreateDirectory(Path.GetDirectoryName(destination)!); File.Copy(file,destination,false);
                    if(ext.Equals(".rfa",StringComparison.OrdinalIgnoreCase)) CopySidecar(file,destination,".txt");
                    result.Imported++;
                }
                catch(Exception ex){result.Errors.Add($"{file}: {ex.Message}");}
            }
        }
        await _index.ReindexAsync(token); return result;
    }
    private static void CopySidecar(string source,string destination,string extension)
    { var s=Path.ChangeExtension(source,extension); if(!File.Exists(s))return; var d=Path.ChangeExtension(destination,extension); if(!File.Exists(d))File.Copy(s,d); }
    private static string UniquePath(string folder,string relative)
    {
        relative=relative.TrimStart(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar); var path=Path.Combine(folder,relative); if(!File.Exists(path))return path;
        var dir=Path.GetDirectoryName(path)!;var stem=Path.GetFileNameWithoutExtension(path);var ext=Path.GetExtension(path);var i=2;while(File.Exists(path=Path.Combine(dir,$"{stem}_{i++}{ext}"))){}return path;
    }
}
