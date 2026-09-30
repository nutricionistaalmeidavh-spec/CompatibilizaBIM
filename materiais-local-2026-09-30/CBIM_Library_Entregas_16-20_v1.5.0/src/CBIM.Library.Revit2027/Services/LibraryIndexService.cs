using System.Security.Cryptography;
using System.Text.Json;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class LibraryIndexService
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    { ".rfa", ".rvt", ".ifc", ".ifczip", ".rte", ".rft", ".dwg", ".dxf", ".skp", ".step", ".stp", ".sat" };
    private static readonly string[] Manufacturers =
    { "Tigre","Amanco","Wavin","ArcelorMittal","Gerdau","Docol","Tramontina","Schneider","Hilti","Daikin","Legrand","KSB","Mitsubishi","Simpson","Unistrut","Atkore","Systemair","Swegon","Victaulic","Duravit","Eliane","Grundfos","Geberit","ABB","VELUX" };
    private readonly LibraryPaths _paths;
    private readonly MetadataEnrichmentService _metadata = new();
    private readonly JsonSerializerOptions _json = new() { WriteIndented=true, PropertyNameCaseInsensitive=true };
    public LibraryIndexService(LibraryPaths paths)=>_paths=paths;

    public IReadOnlyList<LibraryItem> LoadCatalog()
    {
        try { if(File.Exists(_paths.CatalogFile)) return JsonSerializer.Deserialize<List<LibraryItem>>(File.ReadAllText(_paths.CatalogFile),_json)??new(); } catch { }
        return Array.Empty<LibraryItem>();
    }

    public async Task<IReadOnlyList<LibraryItem>> ReindexAsync(CancellationToken token=default)
    {
        var previous=LoadCatalog().ToDictionary(x=>x.Path,StringComparer.OrdinalIgnoreCase);
        var state=LoadState(); var overrides=LoadOverrides().ToDictionary(x=>x.Sha256,StringComparer.OrdinalIgnoreCase); var result=new List<LibraryItem>();
        var roots=new List<(string root,string source)>{(_paths.OfficialCurrent,"Oficial"),(_paths.MyLibrary,"Minha Biblioteca")};
        if(!string.IsNullOrWhiteSpace(_paths.TeamLibrary)&&Directory.Exists(_paths.TeamLibrary)) roots.Add((_paths.TeamLibrary,"Empresa"));
        foreach(var (root,source) in roots)
        {
            if(!Directory.Exists(root)) continue;
            foreach(var file in Directory.EnumerateFiles(root,"*",SearchOption.AllDirectories))
            {
                token.ThrowIfCancellationRequested(); var ext=Path.GetExtension(file); if(!Allowed.Contains(ext)) continue;
                var info=new FileInfo(file); string sha;
                if(state.TryGetValue(file,out var cached)&&cached.Size==info.Length&&cached.LastWriteTicksUtc==info.LastWriteTimeUtc.Ticks) sha=cached.Sha256;
                else sha=await Sha256Async(file,token);
                previous.TryGetValue(file,out var old);
                var item=old??new LibraryItem();
                item.Name=Path.GetFileNameWithoutExtension(file); item.Path=file; item.Extension=ext.TrimStart('.').ToUpperInvariant();
                item.Size=info.Length; item.LastWriteTicksUtc=info.LastWriteTimeUtc.Ticks; item.Sha256=sha; item.Source=source;
                item.Manufacturer=DetectManufacturer(file); item.Discipline=DetectDiscipline(file); item.ThumbnailPath=Path.Combine(_paths.Thumbnails, sha+".png"); item.IndexedAtUtc=DateTime.UtcNow;
                _metadata.Enrich(item); ApplyOverride(item, overrides); result.Add(item);
                state[file]=new IndexStateEntry{Path=file,Size=info.Length,LastWriteTicksUtc=info.LastWriteTimeUtc.Ticks,Sha256=sha};
            }
        }
        result=result.GroupBy(x=>x.Sha256,StringComparer.OrdinalIgnoreCase).Select(g=>g.OrderBy(x=>SourceRank(x.Source)).First()).OrderBy(x=>x.Name).ToList();
        Directory.CreateDirectory(_paths.Database);
        await File.WriteAllTextAsync(_paths.CatalogFile,JsonSerializer.Serialize(result,_json),token);
        await File.WriteAllTextAsync(_paths.IndexStateFile,JsonSerializer.Serialize(state.Values,_json),token);
        return result;
    }

    public void SaveCatalog(IEnumerable<LibraryItem> items)=>File.WriteAllText(_paths.CatalogFile,JsonSerializer.Serialize(items,_json));
    public void SaveOverride(ClassificationOverride value)
    {
        var list=LoadOverrides(); var existing=list.FindIndex(x=>x.Sha256.Equals(value.Sha256,StringComparison.OrdinalIgnoreCase));
        if(existing>=0) list[existing]=value; else list.Add(value);
        File.WriteAllText(_paths.OverridesFile,JsonSerializer.Serialize(list,_json));
    }

    public static async Task<string> Sha256Async(string file,CancellationToken token=default)
    { await using var stream=File.OpenRead(file); var hash=await SHA256.HashDataAsync(stream,token); return Convert.ToHexString(hash).ToLowerInvariant(); }

    private Dictionary<string,IndexStateEntry> LoadState()
    { try { if(File.Exists(_paths.IndexStateFile)) return (JsonSerializer.Deserialize<List<IndexStateEntry>>(File.ReadAllText(_paths.IndexStateFile),_json)??new()).ToDictionary(x=>x.Path,StringComparer.OrdinalIgnoreCase); } catch{} return new(StringComparer.OrdinalIgnoreCase); }
    private List<ClassificationOverride> LoadOverrides(){ try { if(File.Exists(_paths.OverridesFile)) return JsonSerializer.Deserialize<List<ClassificationOverride>>(File.ReadAllText(_paths.OverridesFile),_json)??new(); }catch{} return new(); }
    private void ApplyOverride(LibraryItem item, Dictionary<string,ClassificationOverride> overrides)
    {
        if(!overrides.TryGetValue(item.Sha256,out var o))return;
        if(o.Discipline.Length>0)item.Discipline=o.Discipline; if(o.Category.Length>0)item.Category=o.Category; if(o.System.Length>0)item.System=o.System;
        if(o.Material.Length>0)item.Material=o.Material; if(o.NominalDiameterMm is not null)item.NominalDiameterMm=o.NominalDiameterMm;
        if(o.ProductCode.Length>0)item.ProductCode=o.ProductCode; if(o.QuantityUnit.Length>0)item.QuantityUnit=o.QuantityUnit;
        if(o.SinapiCode.Length>0)item.SinapiCode=o.SinapiCode; if(o.CostDescription.Length>0)item.CostDescription=o.CostDescription;
        _metadata.Score(item);
    }
    private static int SourceRank(string s)=>s switch{"Minha Biblioteca"=>0,"Empresa"=>1,"Oficial"=>2,_=>9};
    private static string DetectManufacturer(string path){foreach(var n in Manufacturers)if(path.Contains(n,StringComparison.OrdinalIgnoreCase))return n;return"Não identificado";}
    private static string DetectDiscipline(string path)
    { var p=path.ToLowerInvariant(); if(Has(p,"hidraul","plumbing","sanitar","pipe","valve","pump","tigre","amanco","grundfos","ksb","geberit","victaulic"))return"Hidráulica"; if(Has(p,"hvac","ventila","duct","daikin","mitsubishi","systemair","swegon"))return"HVAC"; if(Has(p,"sprinkler","fire","incend"))return"Incêndio"; if(Has(p,"eletric","electrical","legrand","schneider","tramontina","abb"))return"Elétrica"; if(Has(p,"struct","estrutura","steel","gerdau","arcelor","simpson","unistrut","hilti"))return"Estrutural"; if(Has(p,"arch","arquitet","door","window","duravit","eliane","velux"))return"Arquitetura"; return"Outros"; }
    private static bool Has(string s,params string[] terms)=>terms.Any(s.Contains);
}
