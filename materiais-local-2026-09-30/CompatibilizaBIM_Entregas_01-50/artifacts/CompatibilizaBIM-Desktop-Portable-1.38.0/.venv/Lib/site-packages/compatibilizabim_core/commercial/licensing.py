from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from pydantic import BaseModel, ConfigDict, Field


def _now() -> datetime: return datetime.now(timezone.utc)


class LicenseModel(BaseModel): model_config=ConfigDict(extra='forbid')


class CustomerConfiguration(LicenseModel):
    customer_id:str
    customer_name:str
    organization:str|None=None
    installation_id:str=Field(default_factory=lambda: secrets.token_hex(16))
    channel:Literal['stable','pilot','dev']='stable'


class LicensePayload(LicenseModel):
    license_id:str
    customer_id:str
    customer_name:str
    product:Literal['CompatibilizaBIM']='CompatibilizaBIM'
    edition:Literal['pilot','standard','professional']='pilot'
    issued_at:datetime=Field(default_factory=_now)
    not_before:datetime|None=None
    expires_at:datetime|None=None
    installation_ids:list[str]=Field(default_factory=list)
    features:list[str]=Field(default_factory=lambda:['cad_to_cbim','ifc_export'])

    def canonical_bytes(self)->bytes:
        return json.dumps(self.model_dump(mode='json'),ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')


class SignedLicense(LicenseModel):
    algorithm:Literal['Ed25519']='Ed25519'
    payload:LicensePayload
    signature_b64:str


class LicenseValidation(LicenseModel):
    valid:bool
    reason:str
    customer_id:str|None=None
    edition:str|None=None
    features:list[str]=Field(default_factory=list)


class LicenseAuthority:
    @staticmethod
    def generate_keypair() -> tuple[bytes,bytes]:
        private=Ed25519PrivateKey.generate(); public=private.public_key()
        private_pem=private.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
        public_pem=public.public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo)
        return private_pem,public_pem

    @staticmethod
    def issue(payload:LicensePayload,private_pem:bytes)->SignedLicense:
        private=serialization.load_pem_private_key(private_pem,password=None)
        if not isinstance(private,Ed25519PrivateKey): raise TypeError('Expected Ed25519 private key')
        sig=private.sign(payload.canonical_bytes())
        return SignedLicense(payload=payload,signature_b64=base64.b64encode(sig).decode('ascii'))


class LicenseVerifier:
    def __init__(self,public_pem:bytes):
        key=serialization.load_pem_public_key(public_pem)
        if not isinstance(key,Ed25519PublicKey): raise TypeError('Expected Ed25519 public key')
        self.key=key

    def verify(self,license:SignedLicense,customer:CustomerConfiguration,*,now:datetime|None=None)->LicenseValidation:
        try:self.key.verify(base64.b64decode(license.signature_b64),license.payload.canonical_bytes())
        except Exception:return LicenseValidation(valid=False,reason='invalid_signature')
        p=license.payload; now=now or _now()
        if p.customer_id!=customer.customer_id:return LicenseValidation(valid=False,reason='customer_mismatch')
        if p.installation_ids and customer.installation_id not in p.installation_ids:return LicenseValidation(valid=False,reason='installation_not_licensed')
        if p.not_before and now<p.not_before:return LicenseValidation(valid=False,reason='not_yet_valid')
        if p.expires_at and now>p.expires_at:return LicenseValidation(valid=False,reason='expired')
        return LicenseValidation(valid=True,reason='ok',customer_id=p.customer_id,edition=p.edition,features=p.features)


def save_customer_config(config:CustomerConfiguration,path:str|Path)->Path:
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(config.model_dump_json(indent=2),encoding='utf-8');return path

def load_customer_config(path:str|Path)->CustomerConfiguration:return CustomerConfiguration.model_validate_json(Path(path).read_text(encoding='utf-8'))
def save_license(license:SignedLicense,path:str|Path)->Path:
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(license.model_dump_json(indent=2),encoding='utf-8');return path

def verify_license_files(public_key_path:str|Path,customer_path:str|Path,license_path:str|Path,*,required_feature:str|None=None)->LicenseValidation:
    customer=load_customer_config(customer_path)
    license=SignedLicense.model_validate_json(Path(license_path).read_text(encoding='utf-8'))
    result=LicenseVerifier(Path(public_key_path).read_bytes()).verify(license,customer)
    if result.valid and required_feature and required_feature not in result.features:
        return LicenseValidation(valid=False,reason=f'missing_feature:{required_feature}',customer_id=result.customer_id,edition=result.edition,features=result.features)
    return result
