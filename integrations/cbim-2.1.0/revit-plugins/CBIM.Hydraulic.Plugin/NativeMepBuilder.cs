using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Plumbing;
using CBIM.Revit.Contracts;

namespace CBIM.Hydraulic.Plugin;

public sealed class NativeMepBuilder
{
    private const double FeetPerMetre = 3.280839895013123;
    // Revit rejects MEPCurves shorter than 1/10 inch. Keep a small tolerance above it.
    private const double MinimumPipeLengthFeet = 0.01;
    private readonly Document _doc;
    private readonly Dictionary<string, Pipe> _pipes = new(StringComparer.OrdinalIgnoreCase);
    public int SkippedShortPipeCount { get; private set; }

    public NativeMepBuilder(Document document) => _doc = document;

    public int Build(RevitBuildPlan plan)
    {
        EnsureSafePlan(plan);
        var created = 0;
        using var group = new TransactionGroup(_doc, "CBIM Hidráulica — MEP nativo");
        group.Start();
        using (var tx = new Transaction(_doc, "CBIM Hidráulica — Pipes"))
        {
            tx.Start();
            foreach (var op in plan.Operations.Where(o => o.Action == "create_pipe"))
            {
                if (!HasMinimumLength(op))
                {
                    SkippedShortPipeCount++;
                    continue;
                }
                try
                {
                    var pipe = CreateNativePipe(op);
                    _pipes[op.Id] = pipe;
                    Stamp(pipe, op.CbimId);
                    created++;
                }
                catch (Autodesk.Revit.Exceptions.ArgumentException)
                {
                    // A malformed CAD fragment must not cancel the valid network.
                    SkippedShortPipeCount++;
                }
            }
            tx.Commit();
        }
        using (var tx = new Transaction(_doc, "CBIM Hidráulica — Fittings"))
        {
            tx.Start();
            foreach (var op in plan.Operations.Where(o => o.Action == "create_fitting"))
            {
                if (CreateNativeFitting(op) is not null) created++;
            }
            tx.Commit();
        }
        group.Assimilate();
        return created;
    }

    private Pipe CreateNativePipe(RevitBuildOperation op)
    {
        var level = ResolveLevel(op.LevelName);
        var systemType = new FilteredElementCollector(_doc).OfClass(typeof(PipingSystemType)).Cast<PipingSystemType>().First();
        var pipeType = new FilteredElementCollector(_doc).OfClass(typeof(PipeType)).Cast<PipeType>().First();
        var pipe = Pipe.Create(_doc, systemType.Id, pipeType.Id, level.Id, Point(op, "start"), Point(op, "end"));
        var diameter = Double(op.Parameters, "diameter_m");
        if (diameter > 0) pipe.get_Parameter(BuiltInParameter.RBS_PIPE_DIAMETER_PARAM)?.Set(diameter * FeetPerMetre);
        return pipe;
    }

    private FamilyInstance? CreateNativeFitting(RevitBuildOperation op)
    {
        var connectors = op.Dependencies
            .Where(id => _pipes.ContainsKey(id))
            .Select(id => ClosestConnector(_pipes[id], Point(op, "position")))
            .Where(c => c is not null)
            .Cast<Connector>()
            .ToList();
        if (connectors.Count < 2) return null;
        var type = String(op.Parameters, "fitting_type") ?? "other";
        try
        {
            return type switch
            {
                "elbow" when connectors.Count >= 2 => _doc.Create.NewElbowFitting(connectors[0], connectors[1]),
                "tee" when connectors.Count >= 3 => _doc.Create.NewTeeFitting(connectors[0], connectors[1], connectors[2]),
                "cross" when connectors.Count >= 4 => _doc.Create.NewCrossFitting(connectors[0], connectors[1], connectors[2], connectors[3]),
                "reducer" when connectors.Count >= 2 => _doc.Create.NewTransitionFitting(connectors[0], connectors[1]),
                _ => null,
            };
        }
        catch
        {
            // Leave the pipes native and surface unresolved fitting in QA instead of corrupting the network.
            return null;
        }
    }

    private static Connector? ClosestConnector(Pipe pipe, XYZ target)
    {
        Connector? best = null;
        var bestDistance = double.MaxValue;
        foreach (Connector connector in pipe.ConnectorManager.Connectors)
        {
            var d = connector.Origin.DistanceTo(target);
            if (d < bestDistance) { bestDistance = d; best = connector; }
        }
        return best;
    }

    private Level ResolveLevel(string? name)
    {
        var levels = new FilteredElementCollector(_doc).OfClass(typeof(Level)).Cast<Level>().ToList();
        return levels.FirstOrDefault(x => string.Equals(x.Name, name, StringComparison.OrdinalIgnoreCase)) ?? levels.OrderBy(x => x.Elevation).First();
    }

    private static void Stamp(Element element, string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        var p = element.LookupParameter("CBIM_ID") ?? element.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
        if (p is { IsReadOnly: false }) p.Set(element.LookupParameter("CBIM_ID") is not null ? id : $"CBIM_ID:{id}");
    }

    private static XYZ Point(RevitBuildOperation op, string key)
    {
        var v = op.Geometry[key];
        return new XYZ(v.GetProperty("x").GetDouble() * FeetPerMetre, v.GetProperty("y").GetDouble() * FeetPerMetre, v.TryGetProperty("z", out var z) ? z.GetDouble() * FeetPerMetre : 0.0);
    }
    private static bool HasMinimumLength(RevitBuildOperation op)
    {
        var start = Point(op, "start");
        var end = Point(op, "end");
        return start.DistanceTo(end) >= MinimumPipeLengthFeet;
    }
    private static void EnsureSafePlan(RevitBuildPlan plan)
    {
        var coreBlock = plan.Diagnostics.FirstOrDefault(d =>
            string.Equals(d.Code, "hydraulic_microsegment_plan_blocked", StringComparison.OrdinalIgnoreCase));
        if (coreBlock is not null)
            throw new InvalidOperationException("O CBIM bloqueou esta rede: " + coreBlock.Message);

        var pipes = plan.Operations.Where(o => o.Action == "create_pipe").ToList();
        if (pipes.Count < 10) return;
        var microsegments = pipes.Count(op =>
        {
            var diameter = Double(op.Parameters, "diameter_m");
            var minimumMetres = Math.Max(0.03, diameter * 1.25);
            return Point(op, "start").DistanceTo(Point(op, "end")) < minimumMetres * FeetPerMetre;
        });
        if (microsegments * 100 >= pipes.Count * 35)
            throw new InvalidOperationException(
                $"Criação MEP bloqueada: {microsegments} de {pipes.Count} trechos são microsegmentos gráficos do DWG, não tubos confiáveis. Refine a rede para revisão antes de construir.");
    }
    private static double Double(IReadOnlyDictionary<string, JsonElement> values, string key) => values.TryGetValue(key, out var v) && v.TryGetDouble(out var d) ? d : 0.0;
    private static string? String(IReadOnlyDictionary<string, JsonElement> values, string key) => values.TryGetValue(key, out var v) ? v.ToString() : null;
}
