using System.Collections;
using System.Reflection;
using System.Text.Json;
using ACadSharp;
using ACadSharp.IO;

if (args.Length != 2) { Console.Error.WriteLine("usage: bridge <source.dwg> <payload.json>"); return 2; }
var source=Path.GetFullPath(args[0]); var target=Path.GetFullPath(args[1]);
var notifications=new List<string>(); CadDocument doc;
try { using var reader=new DwgReader(source); doc=reader.Read(); }
catch(Exception ex){ Console.Error.WriteLine(ex); return 3; }
var conv=new Converter(source,notifications); var payload=conv.Convert(doc);
Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.WriteAllText(target,JsonSerializer.Serialize(payload,new JsonSerializerOptions{WriteIndented=true,PropertyNamingPolicy=JsonNamingPolicy.SnakeCaseLower})); return 0;

sealed class Converter {
 readonly string source; readonly List<string> warnings; readonly Dictionary<string,int> srcTypes=new(), kinds=new(), unsupported=new(); int total=0,converted=0; double scale=1.0; string unit="unitless";
 public Converter(string source,List<string>warnings){this.source=source;this.warnings=warnings;}
 object? P(object? o,string n)=>o?.GetType().GetProperty(n,BindingFlags.Public|BindingFlags.Instance)?.GetValue(o);
 string S(object? o,string n,string d="")=>P(o,n)?.ToString()??d;
 double D(object? o,string n,double d=0){var v=P(o,n);if(v==null)return d;try{return System.Convert.ToDouble(v,System.Globalization.CultureInfo.InvariantCulture);}catch{return d;}}
 Dictionary<string,object> Pt(object? p)=>new(){{"x",D(p,"X")*scale},{"y",D(p,"Y")*scale},{"z",D(p,"Z")*scale}};
 string Id(object e,int index){var h=P(e,"Handle")?.ToString();return string.IsNullOrWhiteSpace(h)?$"acadsharp:{index}":$"dwg:{h}";}
 string Layer(object e)=>S(P(e,"Layer"),"Name","0");
 void Inc(Dictionary<string,int>d,string k){d[k]=d.GetValueOrDefault(k)+1;}
 double Angle(double a)=>Math.Abs(a)<=Math.PI*2.01?a*180.0/Math.PI:a;
 void ResolveUnits(CadDocument d){
   object? header=P(d,"Header"); object? u=P(header,"InsUnits")??P(header,"InsertionUnits"); var name=u?.ToString()??"Unitless"; unit=name;
   var key=name.Replace("_","").Replace(" ","").ToLowerInvariant(); scale=key switch{"millimeters" or "millimeter"=>.001,"centimeters" or "centimeter"=>.01,"meters" or "meter"=>1.0,"kilometers" or "kilometer"=>1000.0,"inches" or "inch"=>.0254,"feet" or "foot"=>.3048,"yards" or "yard"=>.9144,"miles" or "mile"=>1609.344,"microns" or "micron" or "micrometer" or "micrometers"=>1e-6,_=>1.0};
   if(key is "unitless" or "none" or "") warnings.Add("DWG $INSUNITS is unitless/unknown; canonical scale defaults to metres");
 }
 IEnumerable<object> Items(object? x){ if(x is IEnumerable e) foreach(var v in e) if(v!=null) yield return v; }
 Dictionary<string,object>? Entity(object e,int i){ total++; var t=e.GetType().Name; Inc(srcTypes,t); var meta=new Dictionary<string,object?>{{"source_type",t},{"handle",P(e,"Handle")?.ToString()}}; Dictionary<string,object>? r=null;
   if(t=="Line") r=new(){{"id",Id(e,i)},{"kind","line"},{"layer",Layer(e)},{"metadata",meta},{"start",Pt(P(e,"StartPoint"))},{"end",Pt(P(e,"EndPoint"))}};
   else if(t.Contains("Polyline",StringComparison.OrdinalIgnoreCase)) { var verts=Items(P(e,"Vertices")).Select(v=>Pt(P(v,"Location")??P(v,"Position")??v)).ToList(); if(verts.Count>=2) r=new(){{"id",Id(e,i)},{"kind","polyline"},{"layer",Layer(e)},{"metadata",meta},{"points",verts},{"closed",P(e,"IsClosed") as bool? ?? false}}; }
   else if(t=="Arc") r=new(){{"id",Id(e,i)},{"kind","arc"},{"layer",Layer(e)},{"metadata",meta},{"center",Pt(P(e,"Center"))},{"radius",D(e,"Radius")*scale},{"start_angle_deg",Angle(D(e,"StartAngle"))},{"end_angle_deg",Angle(D(e,"EndAngle"))}};
   else if(t=="Circle") r=new(){{"id",Id(e,i)},{"kind","circle"},{"layer",Layer(e)},{"metadata",meta},{"center",Pt(P(e,"Center"))},{"radius",D(e,"Radius")*scale}};
   else if(t=="Spline") { var pts=Items(P(e,"FitPoints")??P(e,"ControlPoints")??P(e,"Points")).Select(Pt).ToList(); if(pts.Count>=2)r=new(){{"id",Id(e,i)},{"kind","spline"},{"layer",Layer(e)},{"metadata",meta},{"points",pts},{"closed",P(e,"IsClosed") as bool? ?? false}}; }
   else if(t=="Insert") { var block=P(e,"Block"); var sc=P(e,"Scale")??P(e,"ScaleFactor"); r=new(){{"id",Id(e,i)},{"kind","insert"},{"layer",Layer(e)},{"metadata",meta},{"block_name",S(block,"Name",S(e,"BlockName","*UNKNOWN"))},{"position",Pt(P(e,"InsertPoint")??P(e,"Position"))},{"rotation_deg",Angle(D(e,"Rotation"))},{"xscale",D(sc,"X",D(e,"XScale",1))},{"yscale",D(sc,"Y",D(e,"YScale",1))},{"zscale",D(sc,"Z",D(e,"ZScale",1))}}; }
   else if(t is "TextEntity" or "MText") r=new(){{"id",Id(e,i)},{"kind","text"},{"layer",Layer(e)},{"metadata",meta},{"text",S(e,"Value",S(e,"Text"))},{"position",Pt(P(e,"InsertPoint")??P(e,"Position"))},{"height",D(e,"Height",D(e,"TextHeight",0))*scale},{"rotation_deg",Angle(D(e,"Rotation"))}};
   if(r!=null){converted++;Inc(kinds,(string)r["kind"]);}else Inc(unsupported,t); return r;
 }
 List<Dictionary<string,object>> Xrefs(CadDocument d){
   var defs=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   foreach(var b in Items(P(d,"BlockRecords"))){var isX=(P(b,"IsXRef") as bool?)??(P(b,"IsExternalReference") as bool?)??false;var path=S(b,"XRefPath",S(b,"ExternalReferencePath",S(b,"Path")));if(isX||!string.IsNullOrWhiteSpace(path)){var name=S(b,"Name",Path.GetFileNameWithoutExtension(path));if(!string.IsNullOrWhiteSpace(name)&&!string.IsNullOrWhiteSpace(path))defs[name]=path;}}
   var rows=new List<Dictionary<string,object>>();
   foreach(var e in Items(P(d,"Entities"))){if(e.GetType().Name!="Insert")continue;var block=P(e,"Block");var name=S(block,"Name",S(e,"BlockName"));if(!defs.TryGetValue(name,out var path))continue;var pos=P(e,"InsertPoint")??P(e,"Position");var sc=P(e,"Scale")??P(e,"ScaleFactor");var sx=D(sc,"X",D(e,"XScale",1));var sy=D(sc,"Y",D(e,"YScale",1));var sz=D(sc,"Z",D(e,"ZScale",1));if(Math.Abs(sx-sy)>1e-9||Math.Abs(sx-sz)>1e-9)warnings.Add($"XREF {name} has non-uniform scale; Core XREF currently uses X scale {sx}");rows.Add(new(){{"name",name},{"path",path},{"tx",D(pos,"X")*scale},{"ty",D(pos,"Y")*scale},{"tz",D(pos,"Z")*scale},{"rotation_deg",Angle(D(e,"Rotation"))},{"scale",sx},{"resolved",false}});}
   foreach(var kv in defs)if(!rows.Any(r=>string.Equals(r["name"].ToString(),kv.Key,StringComparison.OrdinalIgnoreCase)))rows.Add(new(){{"name",kv.Key},{"path",kv.Value},{"tx",0.0},{"ty",0.0},{"tz",0.0},{"rotation_deg",0.0},{"scale",1.0},{"resolved",false}});
   return rows;
 }
 public Dictionary<string,object> Convert(CadDocument d){ResolveUnits(d);var ents=new List<Dictionary<string,object>>();int i=0;foreach(var e in Items(P(d,"Entities"))){var x=Entity(e,++i);if(x!=null)ents.Add(x);}var blocks=new Dictionary<string,object>();foreach(var b in Items(P(d,"BlockRecords"))){var name=S(b,"Name");if(string.IsNullOrWhiteSpace(name)||name.StartsWith("*Model",StringComparison.OrdinalIgnoreCase)||name.StartsWith("*Paper",StringComparison.OrdinalIgnoreCase))continue;var bes=new List<Dictionary<string,object>>();foreach(var e in Items(P(b,"Entities"))){var x=Entity(e,++i);if(x!=null)bes.Add(x);}blocks[name]=new Dictionary<string,object>{{"name",name},{"base_point",new Dictionary<string,object>{{"x",0.0},{"y",0.0},{"z",0.0}}},{"entities",bes}};}
   var layers=ents.Select(x=>x["layer"].ToString()??"0").Distinct().Order().ToArray();var xrefs=Xrefs(d);var diag=new Dictionary<string,object>{{"provider","acadsharp"},{"source_path",source},{"version",S(P(d,"Header"),"Version")},{"unit_name",unit},{"unit_scale_to_m",scale},{"total_entities",total},{"converted_entities",converted},{"unsupported_entities",total-converted},{"blocks",blocks.Count},{"xrefs",xrefs.Count},{"by_source_type",srcTypes},{"by_canonical_kind",kinds},{"unsupported_types",unsupported},{"warnings",warnings},{"errors",Array.Empty<string>()}};
   var document=new Dictionary<string,object>{{"source_id",$"dwg:{Path.GetFileName(source)}"},{"source_format","dwg"},{"source_path",source},{"units","m"},{"entities",ents},{"blocks",blocks},{"layers",layers},{"metadata",new Dictionary<string,object>{{"dwg_provider","acadsharp"},{"native_dwg",true},{"converted_via_dxf",false}}}};return new(){{"document",document},{"diagnostics",diag},{"xrefs",xrefs}};
 }
}
