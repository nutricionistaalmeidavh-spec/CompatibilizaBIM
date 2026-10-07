import pytest
from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D,Site,Wall
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.georef import ProjectedReference,LocalCoordinateFrame,GeoreferencingManager

def test_large_coordinates_roundtrip_preserves_precision():
    r=ProjectedReference(crs='SIRGAS2000 / UTM 23S',origin_easting=203456.238,origin_northing=7658291.472,origin_elevation=612.3,rotation_deg=17.5)
    f=LocalCoordinateFrame(r);g=(203999.123456,7658999.654321,620.123456)
    local=f.to_local_xyz(*g);back=f.to_global_xyz(*local)
    assert back==pytest.approx(g,abs=1e-8)

def test_cad_and_cbim_can_use_local_frame_with_crs_metadata():
    r=ProjectedReference(crs='EPSG:31983',origin_easting=200000,origin_northing=7600000,latitude=-21.17,longitude=-47.81)
    d=CadDocument(source_id='geo',entities=[CadLine(id='L',start=CadPoint(x=200010,y=7600020),end=CadPoint(x=200020,y=7600020))])
    local=GeoreferencingManager().transform_cad(d,r)
    assert local.entities[0].start.x==pytest.approx(10) and local.entities[0].start.y==pytest.approx(20)
    p=CBIMProject(name='geo',sites=[Site(name='s')],elements=[Wall(start=Point3D(x=10,y=20),end=Point3D(x=20,y=20),thickness=.14,height=3)])
    attached=GeoreferencingManager().attach_cbim_reference(p,r)
    assert attached.coordinate_reference=='EPSG:31983' and attached.sites[0].latitude==-21.17
