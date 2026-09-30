using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class MetadataEnrichmentService
{
    private static readonly Regex Dn = new(@"(?<!\d)(?:dn\s*|ø\s*|dia(?:metro)?\s*)?(?<n>\d{1,4}(?:[.,]\d+)?)\s*(?:mm)?(?!\d)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Code = new(@"\b(?:ref|cod|sku|item)[-_ :]*(?<c>[a-z0-9][a-z0-9._-]{2,})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public void Enrich(LibraryItem item)
    {
        var text = Normalize(Path.GetFileNameWithoutExtension(item.Path) + " " + item.Path);
        item.Category = DetectCategory(text, item.Discipline);
        item.System = DetectSystem(text);
        item.Material = DetectMaterial(text);
        item.NominalDiameterMm ??= DetectDiameter(text);
        if (string.IsNullOrWhiteSpace(item.ProductCode)) item.ProductCode = DetectCode(text);
        if (item.TypeNames.Count == 0) item.TypeNames = ReadTypeCatalog(item.Path);
        item.RevitVersionHint = DetectRevitVersion(text);
        item.TechnicalSignature = string.Join('|', new[]
        {
            item.Discipline, item.Category, item.System, item.Material,
            item.NominalDiameterMm?.ToString("0.###", CultureInfo.InvariantCulture) ?? "",
            item.Manufacturer
        }.Select(Normalize));
        Score(item);
    }

    public void ApplyInspection(LibraryItem item, RevitInspectionResult inspection)
    {
        if (!string.IsNullOrWhiteSpace(inspection.Category)) item.Category = inspection.Category;
        if (inspection.TypeNames.Count > 0) item.TypeNames = inspection.TypeNames.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList();
        if (inspection.ParameterNames.Count > 0) item.ParameterNames = inspection.ParameterNames.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x).ToList();
        item.ConnectorCount = inspection.ConnectorCount;
        item.ElementCount = inspection.ElementCount;
        Score(item);
    }

    public void Score(LibraryItem item)
    {
        var score = 100;
        var issues = new List<string>();
        if (item.Manufacturer == "Não identificado") { score -= 10; issues.Add("Fabricante não identificado"); }
        if (item.Category == "Não classificado") { score -= 15; issues.Add("Categoria não classificada"); }
        if (item.Size > 15 * 1024 * 1024 && item.Extension.Equals("RFA", StringComparison.OrdinalIgnoreCase)) { score -= 15; issues.Add("RFA pesada (>15 MB)"); }
        if (item.Size > 40 * 1024 * 1024 && item.Extension.Equals("RFA", StringComparison.OrdinalIgnoreCase)) { score -= 15; issues.Add("RFA muito pesada (>40 MB)"); }
        if ((item.Discipline is "Hidráulica" or "HVAC" or "Incêndio" or "Elétrica") && item.Extension.Equals("RFA", StringComparison.OrdinalIgnoreCase) && item.ConnectorCount == 0)
        { score -= 20; issues.Add("Conectores MEP ainda não confirmados"); }
        if (item.TypeNames.Count == 0 && item.Extension.Equals("RFA", StringComparison.OrdinalIgnoreCase)) { score -= 5; issues.Add("Tipos ainda não inspecionados"); }
        if (item.ParameterNames.Count == 0 && item.Extension.Equals("RFA", StringComparison.OrdinalIgnoreCase)) { score -= 5; issues.Add("Parâmetros ainda não inspecionados"); }
        item.QualityScore = Math.Clamp(score, 0, 100);
        item.QualityIssues = issues;
    }

    private static string DetectCategory(string t, string discipline)
    {
        if (Has(t,"joelho","elbow")) return "Conexão - Joelho";
        if (Has(t,"tee","te ","tê ")) return "Conexão - Tê";
        if (Has(t,"valvula","válvula","valve","registro")) return "Válvula/Registro";
        if (Has(t,"pump","bomba")) return "Bomba";
        if (Has(t,"pipe","tubo","tubul")) return "Tubulação";
        if (Has(t,"duct","duto")) return "Duto";
        if (Has(t,"diffuser","difusor")) return "Difusor";
        if (Has(t,"sprinkler")) return "Sprinkler";
        if (Has(t,"door","porta")) return "Porta";
        if (Has(t,"window","janela","velux")) return "Janela";
        if (Has(t,"beam","viga")) return "Viga";
        if (Has(t,"column","pilar")) return "Pilar";
        if (Has(t,"toilet","bacia","lavatorio","lavatório","sanitario","sanitário")) return "Louça sanitária";
        return discipline == "Outros" ? "Não classificado" : discipline;
    }

    private static string DetectSystem(string t)
    {
        if (Has(t,"agua fria","água fria","cold water","af_")) return "Água fria";
        if (Has(t,"agua quente","água quente","hot water","aq_")) return "Água quente";
        if (Has(t,"esgoto","sewer","waste","sanitary")) return "Esgoto sanitário";
        if (Has(t,"sprinkler","fire","incend")) return "Incêndio";
        if (Has(t,"hvac","refriger","vrf","chiller")) return "HVAC";
        if (Has(t,"eletric","electrical","power")) return "Elétrica";
        return "";
    }

    private static string DetectMaterial(string t)
    {
        if (Has(t,"pvc")) return "PVC";
        if (Has(t,"cpvc")) return "CPVC";
        if (Has(t,"pex")) return "PEX";
        if (Has(t,"cobre","copper")) return "Cobre";
        if (Has(t,"inox","stainless")) return "Aço inox";
        if (Has(t,"aco","aço","steel")) return "Aço";
        if (Has(t,"ferro","iron")) return "Ferro";
        if (Has(t,"concreto","concrete")) return "Concreto";
        return "";
    }

    private static double? DetectDiameter(string t)
    {
        foreach (Match m in Dn.Matches(t))
        {
            if (!double.TryParse(m.Groups["n"].Value.Replace(',','.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var n)) continue;
            if (n is >= 10 and <= 2000) return n;
        }
        return null;
    }

    private static string DetectCode(string t) => Code.Match(t) is { Success: true } m ? m.Groups["c"].Value : "";
    private static string DetectRevitVersion(string t)
    {
        foreach (var y in Enumerable.Range(2020, 12).Reverse()) if (t.Contains(y.ToString(), StringComparison.OrdinalIgnoreCase)) return y.ToString();
        return "";
    }

    private static List<string> ReadTypeCatalog(string rfa)
    {
        if (!Path.GetExtension(rfa).Equals(".rfa", StringComparison.OrdinalIgnoreCase)) return new();
        var txt = Path.ChangeExtension(rfa, ".txt");
        if (!File.Exists(txt)) return new();
        try
        {
            return File.ReadLines(txt).Skip(1).Select(x => x.Split(',')[0].Trim()).Where(x => x.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).Take(500).ToList();
        }
        catch { return new(); }
    }

    private static bool Has(string s, params string[] terms) => terms.Any(x => s.Contains(x, StringComparison.OrdinalIgnoreCase));
    public static string Normalize(string value) => Regex.Replace(value.ToLowerInvariant().Normalize(NormalizationForm.FormD), "[^a-z0-9]+", " ").Trim();
}
