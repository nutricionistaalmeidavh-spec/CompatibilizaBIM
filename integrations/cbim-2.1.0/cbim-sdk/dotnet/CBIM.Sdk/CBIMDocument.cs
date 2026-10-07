namespace CBIM.Sdk;

public sealed class CBIMDocument
{
    public CBIMProject Project { get; private set; }

    public CBIMDocument(CBIMProject project)
    {
        Project = project;
        CBIMValidator.Validate(project);
    }

    public static CBIMDocument Create(string name) => new(new CBIMProject { Name = name });
    public static CBIMDocument Load(string path) => new(CBIMSerializer.Load(path));
    public void Save(string path) => CBIMSerializer.Save(Project, path);

    public T AddElement<T>(T element) where T : Element
    {
        Project.Elements.Add(element);
        CBIMValidator.Validate(Project);
        return element;
    }

    public Relation AddRelation(Relation relation)
    {
        Project.Relations.Add(relation);
        CBIMValidator.Validate(Project);
        return relation;
    }

    public IEnumerable<Element> QueryElements(string? type = null, string? storeyId = null)
    {
        IEnumerable<Element> query = Project.Elements;
        if (type is not null)
            query = query.Where(e => e.GetType().Name.Equals(type, StringComparison.OrdinalIgnoreCase));
        if (storeyId is not null)
            query = query.Where(e => e.StoreyId == storeyId);
        return query;
    }
}
