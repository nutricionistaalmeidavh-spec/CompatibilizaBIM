from __future__ import annotations

import argparse,json
from pathlib import Path
from datetime import datetime, timezone

from .licensing import CustomerConfiguration,LicenseAuthority,LicensePayload,LicenseVerifier,SignedLicense,save_customer_config,save_license,load_customer_config
from .pilot_gate import FirstCommercialPilotGate,PilotEvidence


def main(argv=None):
    p=argparse.ArgumentParser(prog='cbim-commercial',description='CompatibilizaBIM customer licensing and commercial pilot gate');sub=p.add_subparsers(dest='cmd',required=True)
    kc=sub.add_parser('keygen');kc.add_argument('--private',required=True);kc.add_argument('--public',required=True)
    cc=sub.add_parser('customer');cc.add_argument('--id',required=True);cc.add_argument('--name',required=True);cc.add_argument('-o','--output',required=True);cc.add_argument('--organization');cc.add_argument('--channel',default='pilot',choices=['stable','pilot','dev'])
    issue=sub.add_parser('issue');issue.add_argument('--private',required=True);issue.add_argument('--customer',required=True);issue.add_argument('--license-id',required=True);issue.add_argument('--edition',default='pilot',choices=['pilot','standard','professional']);issue.add_argument('--expires');issue.add_argument('--feature',action='append',default=[]);issue.add_argument('-o','--output',required=True)
    verify=sub.add_parser('verify');verify.add_argument('--public',required=True);verify.add_argument('--customer',required=True);verify.add_argument('--license',required=True)
    gate=sub.add_parser('pilot-gate');gate.add_argument('--evidence',required=True);gate.add_argument('-o','--output')
    a=p.parse_args(argv)
    if a.cmd=='keygen':
        private,public=LicenseAuthority.generate_keypair();Path(a.private).write_bytes(private);Path(a.public).write_bytes(public);print(json.dumps({'private':a.private,'public':a.public}))
    elif a.cmd=='customer':
        c=CustomerConfiguration(customer_id=a.id,customer_name=a.name,organization=a.organization,channel=a.channel);save_customer_config(c,a.output);print(c.model_dump_json(indent=2))
    elif a.cmd=='issue':
        c=load_customer_config(a.customer);expires=datetime.fromisoformat(a.expires) if a.expires else None
        if expires is not None and expires.tzinfo is None: expires=expires.replace(tzinfo=timezone.utc)
        features=a.feature or ['cad_to_cbim','ifc_export']
        payload=LicensePayload(license_id=a.license_id,customer_id=c.customer_id,customer_name=c.customer_name,edition=a.edition,expires_at=expires,installation_ids=[c.installation_id],features=features)
        lic=LicenseAuthority.issue(payload,Path(a.private).read_bytes());save_license(lic,a.output);print(lic.model_dump_json(indent=2))
    elif a.cmd=='verify':
        c=load_customer_config(a.customer);lic=SignedLicense.model_validate_json(Path(a.license).read_text(encoding='utf-8'));result=LicenseVerifier(Path(a.public).read_bytes()).verify(lic,c);print(result.model_dump_json(indent=2));raise SystemExit(0 if result.valid else 2)
    else:
        e=PilotEvidence.model_validate_json(Path(a.evidence).read_text(encoding='utf-8'));result=FirstCommercialPilotGate().evaluate(e);text=result.model_dump_json(indent=2)
        if a.output:Path(a.output).write_text(text,encoding='utf-8')
        print(text);raise SystemExit(0 if result.pilot_ready else 3)


if __name__=='__main__':
    main()
