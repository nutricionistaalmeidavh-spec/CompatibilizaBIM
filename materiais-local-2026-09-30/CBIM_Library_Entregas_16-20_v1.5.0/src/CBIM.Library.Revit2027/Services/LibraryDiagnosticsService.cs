using System.Text;
using System.Text.Json;
using CBIM.Library.Revit2027.Models;

namespace CBIM.Library.Revit2027.Services;

public sealed class LibraryDiagnosticsService
{
    private readonly LibraryPaths _paths;
    public LibraryDiagnosticsService(LibraryPaths paths)=>_paths=paths;
    public string Generate(IReadOnlyCollection<LibraryItem> items)
    {
        var now=DateTime.Now; var path=Path.Combine(_paths.Reports,$"diagnostico-{now:yyyyMMdd-HHmmss}.html");
        var low=items.Where(x=>x.QualityScore<70).OrderBy(x=>x.QualityScore).ToList();
        var unclassified=items.Count(x=>x.Category=="Não classificado"); var noManufacturer=items.Count(x=>x.Manufacturer=="Não identificado");
        var huge=items.Count(x=>x.Extension=="RFA"&&x.Size>40*1024*1024);
        var sb=new StringBuilder(); sb.Append("<!doctype html><meta charset='utf-8'><title>CBIM Library - Diagnóstico</title><style>body{font-family:Segoe UI,Arial;max-width:1100px;margin:32px auto}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.bad{font-weight:bold}</style>");
        sb.Append($"<h1>CBIM Library — Diagnóstico</h1><p>{now:dd/MM/yyyy HH:mm}</p><ul><li>Total: {items.Count}</li><li>Score &lt;70: {low.Count}</li><li>Não classificados: {unclassified}</li><li>Fabricante não identificado: {noManufacturer}</li><li>RFA &gt;40 MB: {huge}</li></ul>");
        sb.Append("<h2>Itens que merecem revisão</h2><table><tr><th>Score</th><th>Nome</th><th>Origem</th><th>Problemas</th></tr>");
        foreach(var x in low.Take(500)) sb.Append($"<tr><td class='bad'>{x.QualityScore}</td><td>{E(x.Name)}</td><td>{E(x.Source)}</td><td>{E(string.Join("; ",x.QualityIssues))}</td></tr>");
        sb.Append("</table>"); File.WriteAllText(path,sb.ToString()); return path;
    }
    private static string E(string s)=>System.Net.WebUtility.HtmlEncode(s);
}
