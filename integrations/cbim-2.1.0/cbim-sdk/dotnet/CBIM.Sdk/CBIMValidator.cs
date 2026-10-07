namespace CBIM.Sdk;

public static class CBIMValidator
{
    public static void Validate(CBIMProject project)
    {
        if (project.Schema != CBIMContract.SchemaName)
            throw new InvalidDataException($"Unsupported schema: {project.Schema}");
        if (project.SchemaVersion != CBIMContract.SchemaVersion)
            throw new InvalidDataException($"Unsupported schema version: {project.SchemaVersion}");
        if (project.Units != "m")
            throw new InvalidDataException("CBIM contract persists geometry in meters");

        var ids = new HashSet<string> { project.Id };
        foreach (var id in project.Sites.Select(x => x.Id)
                     .Concat(project.Buildings.Select(x => x.Id))
                     .Concat(project.Storeys.Select(x => x.Id))
                     .Concat(project.Materials.Select(x => x.Id))
                     .Concat(project.Systems.Select(x => x.Id))
                     .Concat(project.Elements.Select(x => x.Id)))
        {
            if (!ids.Add(id)) throw new InvalidDataException($"Duplicate CBIM id: {id}");
        }

        var siteIds = project.Sites.Select(x => x.Id).ToHashSet();
        var buildingIds = project.Buildings.Select(x => x.Id).ToHashSet();
        var storeyIds = project.Storeys.Select(x => x.Id).ToHashSet();
        var materialIds = project.Materials.Select(x => x.Id).ToHashSet();
        var systemIds = project.Systems.Select(x => x.Id).ToHashSet();
        var elementIds = project.Elements.Select(x => x.Id).ToHashSet();

        foreach (var building in project.Buildings)
            if (building.SiteId is not null && !siteIds.Contains(building.SiteId))
                throw new InvalidDataException($"Building {building.Id} references unknown site {building.SiteId}");
        foreach (var storey in project.Storeys)
            if (storey.BuildingId is not null && !buildingIds.Contains(storey.BuildingId))
                throw new InvalidDataException($"Storey {storey.Id} references unknown building {storey.BuildingId}");

        foreach (var element in project.Elements)
        {
            if (element.StoreyId is not null && !storeyIds.Contains(element.StoreyId))
                throw new InvalidDataException($"Element {element.Id} references unknown storey {element.StoreyId}");
            if (element.MaterialIds.Any(id => !materialIds.Contains(id)))
                throw new InvalidDataException($"Element {element.Id} references unknown material");
            if (element.Confidence < 0 || element.Confidence > 1)
                throw new InvalidDataException($"Element {element.Id} has invalid confidence");

            string? systemId = element switch
            {
                Pipe p => p.SystemId,
                Fitting f => f.SystemId,
                Equipment e => e.SystemId,
                _ => null
            };
            if (systemId is not null && !systemIds.Contains(systemId))
                throw new InvalidDataException($"Element {element.Id} references unknown system {systemId}");

            string? hostId = element switch
            {
                Door d => d.HostId,
                Window w => w.HostId,
                Opening o => o.HostId,
                _ => null
            };
            if (hostId is not null && !elementIds.Contains(hostId))
                throw new InvalidDataException($"Element {element.Id} references unknown host {hostId}");
        }

        foreach (var relation in project.Relations)
        {
            if (!ids.Contains(relation.FromId) || !ids.Contains(relation.ToId))
                throw new InvalidDataException($"Relation {relation.Id} references an unknown CBIM id");
        }
    }
}
