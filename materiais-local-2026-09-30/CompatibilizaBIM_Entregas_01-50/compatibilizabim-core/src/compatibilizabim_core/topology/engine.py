from __future__ import annotations

import math
from collections import defaultdict
from time import perf_counter
from typing import Callable

from shapely.geometry import LineString, Point
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree

from ..cad.model import CadDocument, CadLine, CadPolyline
from .model import TopologyEdge, TopologyFace, TopologyGraph, TopologyNode

ProgressCallback = Callable[[str, str, float | None, dict], None]


class TopologyEngine:
    """Build a planar topology graph from CAD linework.

    The v1.39 implementation uses spatial indexes for line intersections, gap repair,
    and face attribution. This keeps sparse real-world drawings from degrading to
    all-pairs O(n²) geometry comparisons.
    """

    def __init__(self, *, tolerance_m: float = 1e-4, gap_tolerance_m: float = .02):
        self.tol = tolerance_m
        self.gap_tol = gap_tolerance_m

    @staticmethod
    def _emit(progress: ProgressCallback | None, stage: str, status: str, elapsed: float | None = None, **detail):
        if progress:
            progress(stage, status, elapsed, detail)

    def _segments(self, doc: CadDocument):
        out = []
        ignored_entities = 0
        for e in doc.entities:
            # Profiles may explicitly mark annotation/helper geometry as non-semantic.
            # Such linework must not inflate topology cost or create false junctions.
            if e.metadata.get("semantic_target") == "ignore":
                ignored_entities += 1
                continue
            if isinstance(e, CadLine):
                out.append((e.id, e.layer, (e.start.x, e.start.y), (e.end.x, e.end.y)))
            elif isinstance(e, CadPolyline):
                pts = [(p.x, p.y) for p in e.points]
                pairs = list(zip(pts, pts[1:]))
                if e.closed and pts and pts[0] != pts[-1]:
                    pairs.append((pts[-1], pts[0]))
                out += [(f"{e.id}:{i}", e.layer, a, b) for i, (a, b) in enumerate(pairs)]
        return [s for s in out if math.dist(s[2], s[3]) > self.tol], ignored_entities

    def _key(self, p):
        return (round(p[0] / self.tol), round(p[1] / self.tol))

    @staticmethod
    def _intersection_points(geometry):
        """Return topological cut points from any Shapely intersection result."""
        if geometry.is_empty:
            return []
        kind = geometry.geom_type
        if kind == "Point":
            return [(float(geometry.x), float(geometry.y))]
        if kind == "MultiPoint":
            return [(float(p.x), float(p.y)) for p in geometry.geoms]
        if kind == "LineString":
            coords = list(geometry.coords)
            if not coords:
                return []
            if len(coords) == 1:
                return [(float(coords[0][0]), float(coords[0][1]))]
            # Collinear overlap: split both source segments at overlap boundaries.
            return [
                (float(coords[0][0]), float(coords[0][1])),
                (float(coords[-1][0]), float(coords[-1][1])),
            ]
        if kind in {"MultiLineString", "GeometryCollection"}:
            points = []
            for part in geometry.geoms:
                points.extend(TopologyEngine._intersection_points(part))
            return points
        return []

    def _node_id(self, key):
        return f"N_{key[0]}_{key[1]}"

    def build(self, document: CadDocument, *, repair_gaps: bool = True, progress: ProgressCallback | None = None) -> TopologyGraph:
        total_started = perf_counter()

        t = perf_counter()
        raw, ignored_entities = self._segments(document)
        cuts = {sid: {a, b} for sid, _, a, b in raw}
        segment_ids = [s[0] for s in raw]
        line_geometries = [LineString([s[2], s[3]]) for s in raw]
        line_by_id = dict(zip(segment_ids, line_geometries))
        tree = STRtree(line_geometries) if line_geometries else None
        index_seconds = perf_counter() - t
        self._emit(
            progress,
            "topology_spatial_index",
            "done",
            index_seconds,
            segments=len(raw),
            ignored_entities=ignored_entities,
        )

        t = perf_counter()
        candidate_pairs = 0
        intersection_pairs = 0
        cut_points = 0
        if tree is not None:
            # Query one segment at a time to keep memory bounded even when a drawing
            # contains dense/overlapping linework. j > i deduplicates symmetric pairs.
            for i, line in enumerate(line_geometries):
                candidate_indices = tree.query(line, predicate="intersects")
                for j_raw in candidate_indices:
                    j = int(j_raw)
                    if j <= i:
                        continue
                    candidate_pairs += 1
                    inter = line.intersection(line_geometries[j])
                    pts = self._intersection_points(inter)
                    if not pts:
                        continue
                    intersection_pairs += 1
                    sa, sb = segment_ids[i], segment_ids[j]
                    for p in pts:
                        cuts[sa].add(p)
                        cuts[sb].add(p)
                    cut_points += len(pts)
        intersection_seconds = perf_counter() - t
        self._emit(
            progress,
            "topology_intersections",
            "done",
            intersection_seconds,
            candidate_pairs=candidate_pairs,
            intersection_pairs=intersection_pairs,
            cut_points=cut_points,
        )

        t = perf_counter()
        coords = {}
        sources = defaultdict(set)
        edges = []
        ec = 0

        def nid(p):
            k = self._key(p)
            coords.setdefault(k, (float(p[0]), float(p[1])))
            return self._node_id(k)

        for sid, layer, _a, _b in raw:
            line = line_by_id[sid]
            pts = sorted(cuts[sid], key=lambda p: line.project(Point(p)))
            for p in pts:
                sources[nid(p)].add(sid.split(":")[0])
            for p, q in zip(pts, pts[1:]):
                if math.dist(p, q) <= self.tol:
                    continue
                ec += 1
                edges.append(
                    TopologyEdge(
                        id=f"E{ec:05d}",
                        start_node_id=nid(p),
                        end_node_id=nid(q),
                        source_entity_id=sid.split(":")[0],
                        layer=layer,
                        length=math.dist(p, q),
                    )
                )
        edge_build_seconds = perf_counter() - t
        self._emit(progress, "topology_edges", "done", edge_build_seconds, nodes=len(coords), edges=len(edges))

        t = perf_counter()
        gap_candidates = 0
        gaps_repaired = 0
        if repair_gaps and edges:
            degree = defaultdict(int)
            for e in edges:
                degree[e.start_node_id] += 1
                degree[e.end_node_id] += 1
            ends = [n for n in sources if degree[n] == 1]
            id_to_coord = {self._node_id(k): v for k, v in coords.items()}
            end_points = [Point(id_to_coord[n]) for n in ends]
            if end_points:
                end_tree = STRtree(end_points)
                used = set()
                for i, node_a in enumerate(ends):
                    if node_a in used:
                        continue
                    nearby = sorted(int(j) for j in end_tree.query(end_points[i], predicate="dwithin", distance=self.gap_tol))
                    for j in nearby:
                        if j <= i:
                            continue
                        node_b = ends[j]
                        if node_b in used:
                            continue
                        gap_candidates += 1
                        d = math.dist(id_to_coord[node_a], id_to_coord[node_b])
                        if self.tol < d <= self.gap_tol:
                            ec += 1
                            edges.append(
                                TopologyEdge(
                                    id=f"E{ec:05d}",
                                    start_node_id=node_a,
                                    end_node_id=node_b,
                                    source_entity_id="__gap_repair__",
                                    layer="__synthetic__",
                                    length=d,
                                    synthetic=True,
                                )
                            )
                            used.update((node_a, node_b))
                            gaps_repaired += 1
                            break
        gap_seconds = perf_counter() - t
        self._emit(
            progress,
            "topology_gap_repair",
            "done",
            gap_seconds,
            candidate_pairs=gap_candidates,
            gaps_repaired=gaps_repaired,
        )

        t = perf_counter()
        degree = defaultdict(int)
        for e in edges:
            degree[e.start_node_id] += 1
            degree[e.end_node_id] += 1
        nodes = []
        for k, xy in sorted(coords.items()):
            n = self._node_id(k)
            d = degree[n]
            kind = "endpoint" if d <= 1 else "pass" if d == 2 else "t_junction" if d == 3 else "cross" if d == 4 else "junction"
            nodes.append(
                TopologyNode(
                    id=n,
                    x=xy[0],
                    y=xy[1],
                    degree=d,
                    kind=kind,
                    source_entity_ids=sorted(sources[n]),
                )
            )
        node_seconds = perf_counter() - t

        t = perf_counter()
        by = {n.id: n for n in nodes}
        graph_lines = []
        for e in edges:
            a, b = by[e.start_node_id], by[e.end_node_id]
            graph_lines.append(LineString([(a.x, a.y), (b.x, b.y)]))

        faces = []
        if graph_lines:
            # Polygonization is global, but attribution is spatially indexed rather
            # than scanning every edge for every face.
            unioned = unary_union(graph_lines)
            edge_tree = STRtree(graph_lines)
            for i, polygon in enumerate(polygonize(unioned), 1):
                if polygon.area <= self.tol * self.tol:
                    continue
                src = []
                candidate_edges = edge_tree.query(polygon.boundary, predicate="intersects")
                for edge_idx_raw in candidate_edges:
                    edge_idx = int(edge_idx_raw)
                    e = edges[edge_idx]
                    if e.synthetic:
                        continue
                    if polygon.boundary.intersection(graph_lines[edge_idx]).length > self.tol:
                        src.append(e.source_entity_id)
                faces.append(
                    TopologyFace(
                        id=f"F{i:04d}",
                        boundary=[(float(x), float(y)) for x, y in list(polygon.exterior.coords)[:-1]],
                        area=float(polygon.area),
                        source_entity_ids=sorted(set(src)),
                    )
                )
        faces.sort(key=lambda f: (round(f.area, 9), f.id))
        face_seconds = perf_counter() - t
        self._emit(progress, "topology_faces", "done", face_seconds, faces=len(faces))

        total_seconds = perf_counter() - total_started
        return TopologyGraph(
            nodes=nodes,
            edges=edges,
            faces=faces,
            metadata={
                "tolerance_m": self.tol,
                "gap_tolerance_m": self.gap_tol,
                "gaps_repaired": gaps_repaired,
                "ignored_entities": ignored_entities,
                "segment_count": len(raw),
                "candidate_pairs": candidate_pairs,
                "intersection_pairs": intersection_pairs,
                "spatial_index_seconds": index_seconds,
                "intersection_seconds": intersection_seconds,
                "edge_build_seconds": edge_build_seconds,
                "gap_repair_seconds": gap_seconds,
                "node_seconds": node_seconds,
                "face_seconds": face_seconds,
                "topology_total_seconds": total_seconds,
            },
        )
