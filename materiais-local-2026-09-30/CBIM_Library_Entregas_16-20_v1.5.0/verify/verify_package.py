from pathlib import Path
import json, xml.etree.ElementTree as ET, re, sys, zipfile
root=Path(__file__).resolve().parents[1]
errors=[]
for p in list(root.rglob('*.csproj'))+[root/'deploy/CBIM.Library.addin.template']:
    try: ET.parse(p)
    except Exception as e: errors.append(f'XML {p}: {e}')
for p in [root/'global.json',root/'config/sample-manifest.json',root/'config/sample-project-kits.json']:
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'JSON {p}: {e}')

def strip_cs(s):
    # Good-enough structural scanner: remove raw strings, verbatim/normal strings, chars and comments.
    s=re.sub(r'\$?""".*?"""','""',s,flags=re.S)
    s=re.sub(r'\$?@"(?:""|[^"])*"','""',s,flags=re.S)
    s=re.sub(r'\$?"(?:\\.|[^"\\])*"','""',s,flags=re.S)
    s=re.sub(r"'(?:\\.|[^'\\])'","''",s)
    s=re.sub(r'/\*.*?\*/','',s,flags=re.S); s=re.sub(r'//.*','',s)
    return s
for p in root.rglob('*.cs'):
    s=strip_cs(p.read_text(encoding='utf-8'))
    for a,b,name in [('{','}','braces'),('(',')','parens'),('[',']','brackets')]:
        if s.count(a)!=s.count(b): errors.append(f'{name} {p}: {s.count(a)} != {s.count(b)}')

readme=(root/'README.md').read_text(encoding='utf-8')
if '1.5.0' not in readme: errors.append('README 1.5.0 version missing')
solution=(root/'CBIM.Library.slnx').read_text(encoding='utf-8')
if 'CBIM.Library.Contracts' not in solution: errors.append('Contracts project missing from solution')
client='\n'.join(p.read_text(encoding='utf-8') for p in (root/'src/CBIM.Library.Revit2027').rglob('*.cs'))
for forbidden in ['UploadFile','files.update','HttpMethod.Post','HttpMethod.Put','HttpMethod.Delete','Google.Apis.Drive']:
    if forbidden in client: errors.append('Client remote-write primitive present: '+forbidden)
required={
 'Entrega16':['MetadataEnrichmentService','QualityScore','LoadFamilySymbol','InspectFamily','CatalogSearchService'],
 'Entrega17':['RemoteFile','ManifestSecurity','UpdateChannel','InstallDifferentialAsync','staging-report'],
 'Entrega18':['SmartInsert','ReplaceSelected','ProjectKit','ImportStandards','PromptForFamilyInstancePlacement'],
 'Entrega19':['LibraryDiagnosticsService','TeamLibraryPath','SinapiCode','IndexStateFile','QuantityCatalogFile'],
 'Entrega20':['CbimBridgeService','LearningObservation','cbim-feedback.jsonl','ExportVocabulary','confirmed']
}
alltext='\n'.join(p.read_text(encoding='utf-8') for p in root.rglob('*') if p.is_file() and p.suffix.lower() in {'.cs','.md','.json','.ps1'})
for delivery,terms in required.items():
    for term in terms:
        if term not in alltext: errors.append(f'{delivery} contract missing: {term}')
# Publisher private-key boundary: private key is accepted only by Publisher project, never Revit client.
publisher=(root/'src/CBIM.Library.Publisher/Program.cs').read_text(encoding='utf-8')
if '--sign-private-key' not in publisher or '--generate-keypair' not in publisher: errors.append('Publisher signing/keypair commands missing')
client_ship=client+'\n'+(root/'src/CBIM.Library.Contracts/Contracts.cs').read_text(encoding='utf-8')
if 'PRIVATE KEY' in client_ship or 'privateKeyPem' in client_ship or 'SignManifest(' in client_ship: errors.append('Private signing capability/key material referenced by shipped client code')
# payload is intentionally build-generated; if present, it must be a healthy zip.
payload=root/'src/CBIM.Library.Installer/Resources/payload.zip'
if payload.exists():
    try:
        with zipfile.ZipFile(payload) as z:
            bad=z.testzip()
            if bad: errors.append('payload.zip bad member: '+bad)
    except Exception as e: errors.append('payload.zip invalid: '+str(e))
# Samples
feedback=(root/'config/sample-cbim-feedback.jsonl').read_text(encoding='utf-8').strip().splitlines()
for i,line in enumerate(feedback,1):
    try: json.loads(line)
    except Exception as e: errors.append(f'feedback JSONL line {i}: {e}')
if errors:
    print('FAIL')
    for e in errors: print('-',e)
    sys.exit(1)
print('OK: XML/JSON, structural C# scan, read-only client boundary, deliveries 16-20 contracts and samples passed')
