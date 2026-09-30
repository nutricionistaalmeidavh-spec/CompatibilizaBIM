using System.Text.Json;
using CBIM.Library.Contracts;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class CbimBridgeService
{
    private readonly LibraryPaths _paths;
    private readonly JsonSerializerOptions _json = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };
    public CbimBridgeService(LibraryPaths paths) => _paths = paths;

    public void Record(string query, string action, LibraryItem item, string context = "", double confidence = 1.0)
    {
        var o = new LearningObservation
        {
            Query=query, Action=action, ItemSha256=item.Sha256, ItemName=item.Name,
            Discipline=item.Discipline, Manufacturer=item.Manufacturer, Context=context, Confidence=confidence
        };
        Directory.CreateDirectory(Path.GetDirectoryName(_paths.LearningFile)!);
        File.AppendAllText(_paths.LearningFile, JsonSerializer.Serialize(o) + Environment.NewLine);
    }

    public Dictionary<string,double> GetLearnedBoosts(string normalizedQuery)
    {
        var result = new Dictionary<string,double>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(normalizedQuery)) return result;
        foreach (var o in ReadJsonLines<LearningObservation>(_paths.LearningFile))
        {
            var oq = MetadataEnrichmentService.Normalize(o.Query);
            if (oq.Length == 0) continue;
            var similarity = QuerySimilarity(normalizedQuery, oq);
            if (similarity < .5) continue;
            result[o.ItemSha256] = result.GetValueOrDefault(o.ItemSha256) + similarity * o.Confidence * (o.Action == "confirmed" ? 2 : 1);
        }
        foreach (var f in ReadJsonLines<CbimFeedback>(_paths.FeedbackFile))
        {
            var fq=MetadataEnrichmentService.Normalize(f.Query);
            if (fq.Length==0) continue;
            var similarity=QuerySimilarity(normalizedQuery,fq);
            if (similarity < .5) continue;
            result[f.ItemSha256]=result.GetValueOrDefault(f.ItemSha256)+similarity*f.Weight*2;
        }
        return result;
    }

    public int ApplyFeedback(IList<LibraryItem> items)
    {
        var bySha=items.ToDictionary(x=>x.Sha256,StringComparer.OrdinalIgnoreCase);
        var count=0;
        foreach(var f in ReadJsonLines<CbimFeedback>(_paths.FeedbackFile))
        {
            if (!bySha.TryGetValue(f.ItemSha256,out var item)) continue;
            if (!string.IsNullOrWhiteSpace(f.Alias) && !item.Aliases.Contains(f.Alias,StringComparer.OrdinalIgnoreCase)) { item.Aliases.Add(f.Alias); count++; }
        }
        return count;
    }

    public void ExportVocabulary(IEnumerable<LibraryItem> items)
    {
        var payload = items.Select(x => new CbimVocabularyItem
        {
            Sha256=x.Sha256, Name=x.Name, Manufacturer=x.Manufacturer, Discipline=x.Discipline,
            Category=x.Category, System=x.System, Material=x.Material, NominalDiameterMm=x.NominalDiameterMm,
            ProductCode=x.ProductCode, TypeNames=x.TypeNames, Aliases=x.Aliases, TechnicalSignature=x.TechnicalSignature,
            QualityScore=x.QualityScore
        }).ToList();
        File.WriteAllText(_paths.VocabularyFile, JsonSerializer.Serialize(new { schema="cbim-library-vocabulary/v1", generatedAtUtc=DateTime.UtcNow, items=payload }, _json));
        File.WriteAllText(_paths.QuantityCatalogFile, JsonSerializer.Serialize(new
        {
            schema="cbim-quantity-catalog/v1", generatedAtUtc=DateTime.UtcNow,
            items=items.Select(x=>new { x.Sha256,x.Name,x.Manufacturer,x.Category,x.Material,x.NominalDiameterMm,x.QuantityUnit,x.SinapiCode,x.CostDescription }).ToList()
        },_json));
    }

    public void WriteContractFile()
    {
        var contract = new
        {
            schema="cbim-library-bridge/v1",
            outbox=new[]{"cbim-library-vocabulary.json","cbim-quantity-catalog.json","learning-observations.jsonl"},
            inbox=new[]{"cbim-feedback.jsonl"},
            rule="Integração somente por arquivos locais. Nenhum upload é feito pelo plugin do cliente.",
            feedback=new { query="texto reconhecido/pesquisado", itemSha256="sha256 da família escolhida", alias="sinônimo opcional", action="boost", weight=1.0 }
        };
        File.WriteAllText(Path.Combine(_paths.Bridge,"bridge-contract-v1.json"),JsonSerializer.Serialize(contract,_json));
    }

    private static IEnumerable<T> ReadJsonLines<T>(string file)
    {
        if(!File.Exists(file)) yield break;
        foreach(var line in File.ReadLines(file))
        {
            if(string.IsNullOrWhiteSpace(line)) continue;
            T? value=default;
            try { value=JsonSerializer.Deserialize<T>(line,new JsonSerializerOptions{PropertyNameCaseInsensitive=true}); } catch { }
            if(value is not null) yield return value;
        }
    }

    private static double QuerySimilarity(string a,string b)
    {
        var aa=a.Split(' ',StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        var bb=b.Split(' ',StringSplitOptions.RemoveEmptyEntries).ToHashSet();
        if(aa.Count==0||bb.Count==0) return 0;
        var inter=aa.Intersect(bb).Count(); var union=aa.Union(bb).Count();
        return union==0?0:(double)inter/union;
    }
}
