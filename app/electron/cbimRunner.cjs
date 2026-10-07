'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const DISCIPLINES = new Set(['architecture', 'structure', 'hydraulic', 'fire']);

function parseDwgRequest(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Nenhum desenho DWG foi recebido.');
  const original = String(input.name || '').trim();
  if (!/^.{1,180}\.dwg$/i.test(original)) throw new TypeError('Selecione um arquivo DWG válido.');
  const discipline = String(input.discipline || '');
  if (!DISCIPLINES.has(discipline)) throw new TypeError('Informe uma disciplina válida para o DWG.');
  const encoded = String(input.base64 || '').replace(/\s/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new TypeError('Conteúdo DWG em base64 inválido.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) throw new TypeError('Conteúdo DWG não corresponde à codificação informada.');
  const filename = path.basename(original).replace(/[^a-zA-Z0-9._-]/g, '_');
  return { filename, discipline, bytes };
}

function parseCbimBatch(batch, expectedDiscipline) {
  if (!batch || !Array.isArray(batch.reports)) throw new Error('Relatório CBIM inválido ou ausente.');
  const report = batch.reports.find(x => x?.discipline === expectedDiscipline);
  if (!report || report.provider !== 'acadsharp') throw new Error('Relatório CBIM não comprova processamento pelo ACadSharp.');
  if (typeof report.ifc_sanity_passed !== 'boolean' || typeof report.import_coverage !== 'number') throw new Error('Relatório CBIM não contém métricas essenciais.');
  return report;
}

async function convertDwg({ input, documentsDir, appSourceDir, resourcesDir, pythonExecutable, onProgress = () => {} }) {
  const request = parseDwgRequest(input);
  const repoRoot = path.resolve(appSourceDir, '..');
  const bundled = path.join(resourcesDir || '', 'integrations', 'cbim-2.1.0');
  const integrated = fs.existsSync(path.join(bundled, 'compatibilizabim-core', 'src')) ? bundled : path.join(repoRoot, 'integrations', 'cbim-2.1.0');
  const core = path.join(integrated, 'compatibilizabim-core');
  const coreSrc = path.join(core, 'src');
  const sdkSrc = path.join(integrated, 'cbim-sdk', 'python', 'src');
  const bridgeProject = path.join(integrated, 'dwg-acadsharp-bridge', 'CompatibilizaBIM.ACadSharpBridge.csproj');
  if (!fs.existsSync(coreSrc) || !fs.existsSync(sdkSrc)) throw new Error('CBIM Core 2.1.0 não foi incluído neste aplicativo.');
  const outputDir = path.join(documentsDir, 'Engenharia360', 'CBIM', 'jobs', 'job-' + Date.now() + '-' + randomBytes(4).toString('hex'));
  fs.mkdirSync(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, request.filename);
  fs.writeFileSync(inputPath, request.bytes);
  const env = { ...process.env, PYTHONPATH: [coreSrc, sdkSrc, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
  const args = ['-m', 'compatibilizabim_core.validation.cli', '--' + request.discipline, inputPath, '--output', outputDir];
  if (process.env.CBIM_ACADSHARP_BRIDGE) {
    if (!fs.existsSync(process.env.CBIM_ACADSHARP_BRIDGE)) throw new Error('CBIM_ACADSHARP_BRIDGE aponta para executável inexistente.');
    args.push('--bridge-exe', process.env.CBIM_ACADSHARP_BRIDGE);
  } else if (fs.existsSync(bridgeProject)) {
    args.push('--bridge-project', bridgeProject);
  } else {
    throw new Error('Ponte ACadSharp não encontrada. Configure o bridge local antes da conversão.');
  }
  const embedded = path.join(resourcesDir || '', 'runtime', process.platform === 'win32' ? 'python.exe' : 'python');
  const python = pythonExecutable || (fs.existsSync(embedded) ? embedded : (process.env.PYTHON || 'python'));
  if (fs.existsSync(embedded) && !pythonExecutable) env.PYTHONHOME = path.dirname(embedded);
  onProgress({ stage: 'Iniciando importação DWG', status: 'running' });
  const { code, stdout, stderr } = await new Promise((resolve, reject) => {
    const child = spawn(python, args, { cwd: core, env, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); if (stdout.length > 5_000_000) child.kill(); });
    child.stderr.on('data', data => { const chunk = data.toString(); stderr += chunk; if (stderr.length > 200_000) stderr = stderr.slice(-200_000); for (const line of chunk.split(/\r?\n/)) { if (line.includes('[CBIM]')) onProgress({ stage: line.trim(), status: 'running' }); } });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
  const batchPath = path.join(outputDir, 'validation-batch.json');
  if (!fs.existsSync(batchPath)) throw new Error('CBIM não concluiu a conversão (saída ' + code + '). ' + (stderr.trim() || stdout.trim()));
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  const report = parseCbimBatch(batch, request.discipline);
  const stem = path.parse(request.filename).name;
  const ifcName = request.discipline + '-' + stem + '.ifc';
  const ifcPath = path.join(outputDir, ifcName);
  if (!fs.existsSync(ifcPath) || !report.ifc_exported || !report.ifc_sanity_passed) {
    throw new Error('A conversão gerou relatório mas não validou o IFC. Arquivos preservados em ' + outputDir);
  }
  const tooLarge = fs.statSync(ifcPath).size > 64 * 1024 * 1024;
  onProgress({ stage: tooLarge ? 'IFC gerado (muito grande para importar automaticamente)' : 'IFC gerado, pronto para revisão', status: tooLarge ? 'partial' : 'complete' });
  return {
    ifcName, ifcBase64: tooLarge ? null : fs.readFileSync(ifcPath).toString('base64'),
    report, outputDir, validationPassed: batch.all_passed === true,
    needsReview: !report.passed || Number(report.review_pending_count || 0) > 0 || tooLarge,
    tooLarge
  };
}

module.exports = { parseDwgRequest, parseCbimBatch, convertDwg };
