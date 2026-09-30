using System.Text.Json;
using CBIM.Library.Contracts;

namespace CBIM.Library.Revit2027.Services;

public sealed class ProjectKitService
{
    private readonly LibraryPaths _paths; private readonly JsonSerializerOptions _json=new(){WriteIndented=true,PropertyNameCaseInsensitive=true};
    public ProjectKitService(LibraryPaths paths){_paths=paths;EnsureSample();}
    public List<ProjectKit> Load(){try{return JsonSerializer.Deserialize<List<ProjectKit>>(File.ReadAllText(_paths.ProjectKitsFile),_json)??new();}catch{return new();}}
    private void EnsureSample()
    {
        if(File.Exists(_paths.ProjectKitsFile))return;
        var kits=new[]{new ProjectKit{Id="residencial-br",Name="Residencial — Brasil",Description="Base para arquitetura + estrutura + MEP. Edite os caminhos no arquivo project-kits.json.",TemplatePath="",StandardsRvtPath="",Families=new()}};
        File.WriteAllText(_paths.ProjectKitsFile,JsonSerializer.Serialize(kits,_json));
    }
}
