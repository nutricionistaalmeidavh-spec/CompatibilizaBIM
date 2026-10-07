from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,System
from compatibilizabim_core.catalog import CatalogEnricher,load_brazil_seed

def test_brazil_seed_has_four_manufacturers_and_matches_pipe():
    cat=load_brazil_seed(); assert {'Tigre','Amanco Wavin','Krona','Astra'} <= {i.manufacturer for i in cat.items}
    sys=System(name='AF',discipline='plumbing',classification='cold_water')
    pipe=Pipe(path=[Point3D(x=0,y=0),Point3D(x=2,y=0)],diameter=.025,system_id=sys.id,properties={'service':'cold_water'})
    p=CBIMProject(name='x',systems=[sys],elements=[pipe])
    matches=cat.match_element(pipe,preferred_manufacturer='Amanco Wavin'); assert matches and matches[0].manufacturer=='Amanco Wavin' and matches[0].score>=.8
    out=CatalogEnricher(cat).enrich(p,preferred_manufacturer='Amanco Wavin'); assert out.elements[0].properties['catalog_manufacturer']=='Amanco Wavin'
