from __future__ import annotations
from .model import BrazilianCatalog,CatalogItem


def _family(id,manufacturer,line,category,systems,material=None,diameters=None,source_url=None,domain='hydraulic',**metadata):
    return CatalogItem(id=id,manufacturer=manufacturer,line=line,category=category,systems=systems,material=material,nominal_diameters_mm=diameters or [],source_url=source_url,metadata={'official_source':True,'seed_scope':'family','domain':domain,**metadata})


def load_brazil_seed()->BrazilianCatalog:
    """Curated family-level Brazilian/AEC catalog knowledge.

    This seed does not redistribute manufacturer BIM files and is not a complete SKU database.
    It stores public family semantics used for neutral correspondence/advisory scoring.
    """
    items=[
      # Amanco Wavin — official BIM portal families.
      _family('amanco-agua-fria-system','Amanco Wavin','Água Fria','system',['cold_water'],'PVC',source_url='https://bim.amanco.com.br/librerias-bim/',domain='hydraulic'),
      _family('amanco-ppr-pipe','Amanco Wavin','PPR','pipe',['cold_water','hot_water'],'PPR',[20,25,32,40,50,63,75,90,110],'https://bim.amanco.com.br/librerias-bim/ppr/',domain='hydraulic'),
      _family('amanco-flowguard-cpvc','Amanco Wavin','FlowGuard CPVC','system',['cold_water','hot_water'],'CPVC',source_url='https://bim.amanco.com.br/librerias-bim/',domain='hydraulic'),
      _family('amanco-pex','Amanco Wavin','PEX','system',['cold_water','hot_water'],'PEX',source_url='https://bim.amanco.com.br/librerias-bim/',domain='hydraulic'),
      _family('amanco-esgoto-normal-pipe','Amanco Wavin','Esgoto','pipe',['sanitary','rainwater'],'PVC',[40,50,75,100,150,200],'https://bim.amanco.com.br/librerias-bim/',domain='hydraulic'),
      _family('amanco-quickstream','Amanco Wavin','QuickStream','system',['rainwater'],source_url='https://bim.amanco.com.br/librerias-bim/',domain='hydraulic'),
      _family('amanco-fireblaze-pipe','Amanco Wavin','CPVC Fire BlazeMaster','pipe',['fire','fire_protection'],'CPVC',source_url='https://bim.amanco.com.br/librerias-bim/cpvc-fire-blazemast/',domain='fire'),
      _family('amanco-fireblaze-fitting','Amanco Wavin','CPVC Fire BlazeMaster','fitting',['fire','fire_protection'],'CPVC',source_url='https://bim.amanco.com.br/librerias-bim/cpvc-fire-blazemast/',domain='fire',fitting_types='elbow,tee,reducer,coupling,cross,cap'),
      _family('amanco-electrical-system','Amanco Wavin','Elétrica','system',['electrical'],source_url='https://bim.amanco.com.br/librerias-bim/electrica/',domain='electrical'),
      _family('amanco-gas-system','Amanco Wavin','Gás','system',['gas'],source_url='https://bim.amanco.com.br/librerias-bim/gas/',domain='gas'),

      # Tigre — public TigreBIM product/library ecosystem.
      _family('tigre-soldavel-system','Tigre','Linha Soldável','system',['cold_water'],'PVC',source_url='https://www.tigre.com.br/tigre-bim',domain='hydraulic'),
      _family('tigre-aquatherm-system','Tigre','CPVC Aquatherm','system',['hot_water'],'CPVC',source_url='https://www.tigre.com.br/tigre-bim',domain='hydraulic'),
      _family('tigre-ppr-system','Tigre','PPR','system',['cold_water','hot_water'],'PPR',source_url='https://www.tigre.com.br/tigre-bim',domain='hydraulic'),
      _family('tigre-esgoto-system','Tigre','Esgoto Predial','system',['sanitary','rainwater'],'PVC',source_url='https://www.tigre.com.br/tigre-bim',domain='hydraulic'),
      _family('tigre-fire-system','Tigre','Soluções de Incêndio','system',['fire','fire_protection'],source_url='https://www.tigre.com.br/tigre-bim',domain='fire'),
      _family('tigre-electrical-system','Tigre','Soluções Elétricas','system',['electrical'],source_url='https://www.tigre.com.br/tigre-bim',domain='electrical'),

      # Krona — official BIM search exposes matching DWG 2D / DWG 3D / Revit formats.
      _family('krona-cold-soldavel-system','Krona','Linha Soldável','system',['cold_water'],'PVC',source_url='https://www.krona.com.br/bim/',domain='hydraulic',paired_formats='dwg2d,dwg3d,revit'),
      _family('krona-esgoto-system','Krona','Esgoto','system',['sanitary','rainwater'],'PVC',source_url='https://www.krona.com.br/bim/',domain='hydraulic',paired_formats='dwg2d,dwg3d,revit'),
      _family('krona-hot-ppr-system','Krona','Água Quente PPR','system',['hot_water'],'PPR',source_url='https://www.krona.com.br/bim/',domain='hydraulic',paired_formats='dwg2d,dwg3d,revit'),
      _family('krona-hot-cpvc-system','Krona','Água Quente CPVC','system',['hot_water'],'CPVC',source_url='https://www.krona.com.br/bim/',domain='hydraulic',paired_formats='dwg2d,dwg3d,revit'),
      _family('krona-electrical-system','Krona','Elétrica','system',['electrical'],source_url='https://www.krona.com.br/bim/',domain='electrical',paired_formats='dwg2d,dwg3d,revit'),

      # Additional Brazilian manufacturer knowledge adapters.
      _family('astra-pex-pipe','Astra','PEX Monocamada','pipe',['cold_water','hot_water'],'PEX',[16,20,25,32],'https://bim.astra-sa.com/',domain='hydraulic'),
      _family('astra-hydraulic-system','Astra','Sistemas Hidráulicos','system',['cold_water','hot_water','sanitary'],source_url='https://bim.astra-sa.com/',domain='hydraulic'),
      _family('fortlev-cold-water-system','Fortlev','Água Fria','system',['cold_water'],'PVC',source_url='https://www.fortlev.com.br/atendimento/projetista/',domain='hydraulic'),
      _family('fortlev-water-tank','Fortlev','Reservatórios','equipment',['cold_water'],source_url='https://www.fortlev.com.br/atendimento/projetista/',domain='hydraulic',component='water_tank'),
      _family('docol-plumbing-fixtures','Docol','Metais Sanitários','equipment',['cold_water','hot_water'],source_url='https://www.docol.com.br/br/downloads',domain='hydraulic',component='plumbing_fixture'),

      # Fire-protection adapters; product files are not bundled.
      _family('victaulic-fire-system','Victaulic','Fire Protection','system',['fire','fire_protection'],source_url='https://www.victaulic.com/',domain='fire',paired_formats='dwg2d,dwg3d,revit'),
      _family('victaulic-fire-fitting','Victaulic','FireLock','fitting',['fire','fire_protection'],source_url='https://www.victaulic.com/',domain='fire',fitting_types='elbow,tee,reducer,coupling,cross,cap'),
      _family('viking-sprinkler-system','Viking','Fire Sprinkler','system',['fire','fire_protection'],source_url='https://www.vikinggroupinc.com/',domain='fire'),
      _family('reliable-sprinkler-system','Reliable','Fire Sprinkler','system',['fire','fire_protection'],source_url='https://www.reliablesprinkler.com/',domain='fire'),

      # Electrical knowledge adapters for the upcoming electrical recognizer.
      _family('schneider-electrical-equipment','Schneider Electric','Electrical Distribution','equipment',['electrical'],source_url='https://www.se.com/br/',domain='electrical',component='distribution_equipment'),
      _family('siemens-electrical-equipment','Siemens','Electrical Distribution','equipment',['electrical'],source_url='https://www.siemens.com/pt-br/',domain='electrical',component='distribution_equipment'),
    ]
    return BrazilianCatalog(version='2026.08-v1.41',items=items)
