from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict

IntegrationStatus = Literal['active','optional','adapter','reference']

class OpenSourceCapability(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str
    name: str
    license: str
    role: str
    source_url: str
    integration_status: IntegrationStatus
    commercial_use_reviewed: bool = True
    bundles_restricted_dataset: bool = False
    notes: str = ''


def open_source_capabilities() -> list[OpenSourceCapability]:
    # Registry is intentionally metadata-only: no model weights or third-party datasets are bundled.
    return [
        OpenSourceCapability(id='acadsharp',name='ACadSharp',license='MIT',role='native_dwg_reader',source_url='https://github.com/DomCR/ACadSharp',integration_status='active'),
        OpenSourceCapability(id='ifcopenshell',name='IfcOpenShell',license='LGPL-3.0-or-later',role='ifc_authoring_validation_geometry',source_url='https://github.com/IfcOpenShell/IfcOpenShell',integration_status='optional',notes='Kept behind the CBIM contract and optional dependency boundary.'),
        OpenSourceCapability(id='bsdd',name='buildingSMART Data Dictionary',license='MIT',role='semantic_dictionary_adapter',source_url='https://github.com/buildingSMART/bSDD',integration_status='adapter',notes='Repository/API documentation and examples are MIT; runtime data terms remain source-attributed.'),
        OpenSourceCapability(id='cadtransformer',name='CADTransformer',license='MIT',role='cad_symbol_spotting_adapter',source_url='https://github.com/VITA-Group/CADTransformer',integration_status='adapter',notes='Model output can be imported through entity ml_* metadata; weights/datasets are not bundled.'),
        OpenSourceCapability(id='vecformer',name='VecFormer',license='Apache-2.0',role='cad_symbol_spotting_adapter',source_url='https://github.com/WesKwong/VecFormer',integration_status='adapter',notes='Model output can be imported through entity ml_* metadata; weights/datasets are not bundled.'),
        OpenSourceCapability(id='sample-test-files',name='buildingSMART Sample-Test-Files',license='CC-BY-4.0',role='ifc_validation_samples',source_url='https://github.com/buildingSMART/Sample-Test-Files',integration_status='reference',notes='Referenced for conformance tests; samples are not redistributed in the commercial bundle.'),
        OpenSourceCapability(id='libredwg',name='GNU LibreDWG',license='GPL-3.0-or-later',role='dwg_fallback_reference',source_url='https://www.gnu.org/software/libredwg/',integration_status='reference',commercial_use_reviewed=False,notes='Not linked or bundled because GPL compatibility requires separate legal/product review.'),
    ]


def get_capability(capability_id: str) -> OpenSourceCapability:
    for item in open_source_capabilities():
        if item.id == capability_id:
            return item
    raise KeyError(capability_id)
