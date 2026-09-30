using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed record SearchHit(LibraryItem Item, double Score);

public sealed class CatalogSearchService
{
    private readonly CbimBridgeService _bridge;
    public CatalogSearchService(CbimBridgeService bridge) => _bridge = bridge;

    public IReadOnlyList<SearchHit> Search(IEnumerable<LibraryItem> items, string query, string discipline = "Todas")
    {
        var q = MetadataEnrichmentService.Normalize(query);
        var tokens = q.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var learned = _bridge.GetLearnedBoosts(q);
        var result = new List<SearchHit>();
        foreach (var item in items)
        {
            if (discipline != "Todas" && !item.Discipline.Equals(discipline, StringComparison.OrdinalIgnoreCase)) continue;
            if (tokens.Length == 0) { result.Add(new(item, item.Favorite ? 2 : 0)); continue; }
            var fields = new[] { item.Name, item.Manufacturer, item.Discipline, item.Category, item.System, item.Material, item.ProductCode, string.Join(' ', item.TypeNames), string.Join(' ', item.Aliases) };
            var hay = MetadataEnrichmentService.Normalize(string.Join(' ', fields));
            double score = 0;
            foreach (var token in tokens)
            {
                if (MetadataEnrichmentService.Normalize(item.Name).Contains(token)) score += 8;
                if (MetadataEnrichmentService.Normalize(item.Manufacturer).Contains(token)) score += 5;
                if (MetadataEnrichmentService.Normalize(item.Category).Contains(token)) score += 5;
                if (MetadataEnrichmentService.Normalize(item.System).Contains(token)) score += 4;
                if (MetadataEnrichmentService.Normalize(item.Material).Contains(token)) score += 4;
                if (hay.Contains(token)) score += 2;
            }
            if (item.Favorite) score += 1.5;
            score += Math.Min(item.UseCount, 10) * .15;
            if (learned.TryGetValue(item.Sha256, out var boost)) score += boost * 10;
            if (score > 0) result.Add(new(item, score));
        }
        return result.OrderByDescending(x => x.Score).ThenByDescending(x => x.Item.QualityScore).ThenBy(x => x.Item.Name).ToList();
    }

    public IReadOnlyList<LibraryItem> Similar(LibraryItem selected, IEnumerable<LibraryItem> items, int limit = 30) => items
        .Where(x => x.Sha256 != selected.Sha256)
        .Select(x => new { Item=x, Score=Similarity(selected,x) })
        .Where(x => x.Score > 0)
        .OrderByDescending(x => x.Score).ThenByDescending(x => x.Item.QualityScore)
        .Take(limit).Select(x => x.Item).ToList();

    private static int Similarity(LibraryItem a, LibraryItem b)
    {
        var s=0;
        if (Eq(a.Discipline,b.Discipline)) s+=5;
        if (Eq(a.Category,b.Category)) s+=8;
        if (Eq(a.System,b.System) && a.System.Length>0) s+=5;
        if (Eq(a.Material,b.Material) && a.Material.Length>0) s+=4;
        if (a.NominalDiameterMm is double ad && b.NominalDiameterMm is double bd && Math.Abs(ad-bd)<0.01) s+=7;
        if (Eq(a.Manufacturer,b.Manufacturer)) s+=1;
        return s;
    }
    private static bool Eq(string a,string b)=>a.Equals(b,StringComparison.OrdinalIgnoreCase);
}
