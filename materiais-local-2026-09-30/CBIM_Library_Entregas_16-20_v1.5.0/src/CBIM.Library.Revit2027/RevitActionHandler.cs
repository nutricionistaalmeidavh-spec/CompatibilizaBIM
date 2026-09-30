using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using CBIM.Library.Contracts;
using CBIM.Library.Revit2027.Models;
using System.Diagnostics;
using System.Drawing.Imaging;

namespace CBIM.Library.Revit2027;

public enum RevitAction { None, UseFile, InspectFamily, SmartInsert, ReplaceSelected, CreateProjectKit, ImportStandards }

public sealed class RevitActionRequest
{
    public RevitAction Action { get; set; }
    public string Path { get; set; } = "";
    public string TypeName { get; set; } = "";
    public string ThumbnailPath { get; set; } = "";
    public ProjectKit? Kit { get; set; }
}

public sealed class RevitActionResult
{
    public RevitAction Action { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public string Path { get; set; } = "";
    public RevitInspectionResult? Inspection { get; set; }
}

public sealed class RevitActionHandler : IExternalEventHandler
{
    private readonly object _gate=new(); private RevitActionRequest _request=new();
    public event EventHandler<RevitActionResult>? Completed;
    public void SetAction(RevitAction action,string path="",string typeName="",string thumbnailPath="",ProjectKit? kit=null)
    { lock(_gate)_request=new RevitActionRequest{Action=action,Path=path,TypeName=typeName,ThumbnailPath=thumbnailPath,Kit=kit}; }

    public void Execute(UIApplication app)
    {
        RevitActionRequest request;lock(_gate){request=_request;_request=new();}
        var result=new RevitActionResult{Action=request.Action,Path=request.Path};
        try
        {
            switch(request.Action)
            {
                case RevitAction.UseFile: UseFile(app,request);break;
                case RevitAction.InspectFamily: result.Inspection=InspectFamily(app,request.Path);break;
                case RevitAction.SmartInsert: SmartInsert(app,request);break;
                case RevitAction.ReplaceSelected: ReplaceSelected(app,request);break;
                case RevitAction.CreateProjectKit: CreateProjectKit(app,request.Kit??throw new InvalidOperationException("Kit não informado."));break;
                case RevitAction.ImportStandards: ImportStandards(app,request.Path);break;
                default:return;
            }
            result.Success=true;result.Message=request.Action==RevitAction.InspectFamily?"Família analisada.":"Operação concluída.";
        }
        catch(Exception ex){result.Success=false;result.Message=ex.Message;}
        Completed?.Invoke(this,result);
    }

    private static void UseFile(UIApplication app,RevitActionRequest r)
    {
        if(string.IsNullOrWhiteSpace(r.Path)||!File.Exists(r.Path))throw new FileNotFoundException("Arquivo BIM não encontrado.",r.Path);
        var ext=Path.GetExtension(r.Path).ToLowerInvariant();
        switch(ext)
        {
            case ".rfa": LoadFamilyOrSymbol(app,r.Path,r.TypeName,r.ThumbnailPath,false);break;
            case ".rvt":case ".ifc":app.OpenAndActivateDocument(r.Path);break;
            case ".rte":app.Application.NewProjectDocument(r.Path);break;
            case ".rft":app.Application.NewFamilyDocument(r.Path);break;
            default:Reveal(r.Path);break;
        }
    }

    private static FamilySymbol LoadFamilyOrSymbol(UIApplication app,string path,string typeName,string thumbnailPath,bool activate)
    {
        var uiDoc=app.ActiveUIDocument??throw new InvalidOperationException("Abra um projeto antes de carregar uma família.");var doc=uiDoc.Document;FamilySymbol? symbol=null;
        using(var tx=new Transaction(doc,"CBIM - Carregar família"))
        {
            tx.Start();
            if(!string.IsNullOrWhiteSpace(typeName))
            {
                if(!doc.LoadFamilySymbol(path,typeName,out symbol))throw new InvalidOperationException($"O Revit não carregou o tipo '{typeName}'.");
            }
            else
            {
                if(!doc.LoadFamily(path,out var family))throw new InvalidOperationException("O Revit não carregou a família selecionada.");
                symbol=family.GetFamilySymbolIds().Select(id=>doc.GetElement(id)).OfType<FamilySymbol>().FirstOrDefault()??throw new InvalidOperationException("A família não possui tipo utilizável.");
            }
            if(activate&&!symbol.IsActive)symbol.Activate(); tx.Commit();
        }
        TrySavePreview(symbol,thumbnailPath);return symbol;
    }

    private static void SmartInsert(UIApplication app,RevitActionRequest r)
    {
        var symbol=LoadFamilyOrSymbol(app,r.Path,r.TypeName,r.ThumbnailPath,true);app.ActiveUIDocument!.PromptForFamilyInstancePlacement(symbol);
    }

    private static void ReplaceSelected(UIApplication app,RevitActionRequest r)
    {
        var uiDoc=app.ActiveUIDocument??throw new InvalidOperationException("Abra um projeto.");var ids=uiDoc.Selection.GetElementIds();if(ids.Count==0)throw new InvalidOperationException("Selecione uma ou mais instâncias de família antes de substituir.");
        var symbol=LoadFamilyOrSymbol(app,r.Path,r.TypeName,r.ThumbnailPath,true);var instances=ids.Select(id=>uiDoc.Document.GetElement(id)).OfType<FamilyInstance>().ToList();if(instances.Count==0)throw new InvalidOperationException("A seleção não contém instâncias de família.");
        using var tx=new Transaction(uiDoc.Document,"CBIM - Substituir família");tx.Start();var changed=0;
        foreach(var fi in instances){if(fi.Category?.Id==symbol.Category?.Id){fi.Symbol=symbol;changed++;}}tx.Commit();
        if(changed==0)throw new InvalidOperationException("Nenhum elemento selecionado possui categoria compatível com a família escolhida.");
    }

    private static RevitInspectionResult InspectFamily(UIApplication app,string path)
    {
        if(!File.Exists(path)||!Path.GetExtension(path).Equals(".rfa",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Selecione um arquivo RFA.");
        var result=new RevitInspectionResult{Path=path};Document? familyDoc=null;
        try
        {
            familyDoc=app.Application.OpenDocumentFile(path);if(!familyDoc.IsFamilyDocument)throw new InvalidOperationException("O arquivo não é um documento de família.");
            result.Category=familyDoc.OwnerFamily?.FamilyCategory?.Name??"";
            foreach(FamilyType t in familyDoc.FamilyManager.Types)if(!string.IsNullOrWhiteSpace(t.Name))result.TypeNames.Add(t.Name);
            foreach(var p in familyDoc.FamilyManager.GetParameters())if(!string.IsNullOrWhiteSpace(p.Definition?.Name))result.ParameterNames.Add(p.Definition.Name);
            result.ConnectorCount=new FilteredElementCollector(familyDoc).OfClass(typeof(ConnectorElement)).GetElementCount();
            result.ElementCount=new FilteredElementCollector(familyDoc).WhereElementIsNotElementType().GetElementCount();return result;
        }
        finally{if(familyDoc is not null&&!familyDoc.IsModified)familyDoc.Close(false);else if(familyDoc is not null)familyDoc.Close(false);}
    }

    private static void CreateProjectKit(UIApplication app,ProjectKit kit)
    {
        Document doc=string.IsNullOrWhiteSpace(kit.TemplatePath)?app.Application.NewProjectDocument(UnitSystem.Metric):app.Application.NewProjectDocument(kit.TemplatePath);
        foreach(var family in kit.Families.Where(x=>File.Exists(x.Path)))
        {
            using var tx=new Transaction(doc,"CBIM Kit - Carregar família");tx.Start();
            if(string.IsNullOrWhiteSpace(family.TypeName))doc.LoadFamily(family.Path);else doc.LoadFamilySymbol(family.Path,family.TypeName);tx.Commit();
        }
        if(File.Exists(kit.StandardsRvtPath))CopyStandards(app,doc,kit.StandardsRvtPath);
    }

    private static void ImportStandards(UIApplication app,string sourcePath)
    { var target=app.ActiveUIDocument?.Document??throw new InvalidOperationException("Abra o projeto de destino.");CopyStandards(app,target,sourcePath); }

    private static void CopyStandards(UIApplication app,Document target,string sourcePath)
    {
        if(!File.Exists(sourcePath))throw new FileNotFoundException("Arquivo RVT de padrões não encontrado.",sourcePath);Document? source=null;
        try
        {
            source=app.Application.OpenDocumentFile(sourcePath);var ids=new HashSet<ElementId>();
            foreach(var v in new FilteredElementCollector(source).OfClass(typeof(View)).Cast<View>().Where(x=>x.IsTemplate))ids.Add(v.Id);
            foreach(var t in new[]{typeof(Material),typeof(ParameterFilterElement),typeof(FillPatternElement),typeof(LinePatternElement),typeof(TextNoteType),typeof(DimensionType)})
                foreach(var e in new FilteredElementCollector(source).OfClass(t))ids.Add(e.Id);
            if(ids.Count==0)return;using var tx=new Transaction(target,"CBIM - Importar padrões");tx.Start();var options=new CopyPasteOptions();options.SetDuplicateTypeNamesHandler(new UseDestinationTypesHandler());ElementTransformUtils.CopyElements(source,ids.ToList(),target,Transform.Identity,options);tx.Commit();
        }
        finally{source?.Close(false);}
    }

    private static void TrySavePreview(FamilySymbol symbol,string path)
    {
        if(string.IsNullOrWhiteSpace(path))return;try{Directory.CreateDirectory(Path.GetDirectoryName(path)!);using var bmp=symbol.GetPreviewImage(new System.Drawing.Size(320,320));bmp?.Save(path,ImageFormat.Png);}catch{}
    }
    private static void Reveal(string path)=>Process.Start(new ProcessStartInfo("explorer.exe",$"/select,\"{path}\""){UseShellExecute=true});
    public string GetName()=>"CBIM Library Revit Action";

    private sealed class UseDestinationTypesHandler:IDuplicateTypeNamesHandler{public DuplicateTypeAction OnDuplicateTypeNamesFound(DuplicateTypeNamesHandlerArgs args)=>DuplicateTypeAction.UseDestinationTypes;}
}
