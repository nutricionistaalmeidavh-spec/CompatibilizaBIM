'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { pythonStudioCommand } = require('./studioWindow.cjs');
const activeConversions = new Set();

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

async function runCbimProcess(program, args, { cwd, env, logPath, onProgress = () => {} }) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, env, windowsHide: true });
    activeConversions.add(child);
    let stdout = '', stderr = '';
    child.stdout.on('data', value => {
      stdout += value.toString();
      if (stdout.length > 5_000_000) child.kill();
    });
    child.stderr.on('data', value => {
      const chunk = value.toString();
      stderr = (stderr + chunk).slice(-120_000);
      for (const line of chunk.split(/\r?\n/)) {
        if (line.includes('[CBIM]')) onProgress({ stage: line.trim(), status: 'running' });
      }
    });
    child.on('error', reject);
    child.on('close', code => {
      activeConversions.delete(child);
      resolve({ code, stdout, stderr });
    });
  });
  if (logPath) {
    try {
      fs.appendFileSync(logPath, new Date().toISOString() + ' ' + path.basename(program) + ' exit=' + result.code + '\n' + result.stderr.slice(-50000) + '\n', 'utf8');
    } catch { /* Logging failure cannot corrupt conversion results. */ }
  }
  return result;
}

function cancelConversion() {
  let stopped = 0;
  for (const child of activeConversions) {
    if (!child.killed) { child.kill(); stopped++; }
  }
  return stopped > 0;
}

async function convertDwg({ input, documentsDir, appSourceDir, resourcesDir, pythonExecutable, isPackaged = false, onProgress = () => {} }) {
  const request = parseDwgRequest(input);
  const command = pythonStudioCommand({ appSourceDir, resourcesDir });
  const embedded = path.join(resourcesDir || '', 'runtime', 'cbim-runtime.exe');
  const packedRuntime = fs.existsSync(embedded);
  const bundled = path.join(resourcesDir || '', 'integrations', 'cbim-2.1.0');
  const integrated = fs.existsSync(path.join(bundled, 'compatibilizabim-core', 'src'))
    ? bundled : path.resolve(appSourceDir, '..', 'integrations', 'cbim-2.1.0');
  const core = path.join(integrated, 'compatibilizabim-core');
  const coreSrc = path.join(core, 'src');
  const sdkSrc = path.join(integrated, 'cbim-sdk', 'python', 'src');
  if (!fs.existsSync(coreSrc) || !fs.existsSync(sdkSrc)) throw new Error('Core 2.1 e contratos SDK ausentes nesta instalação.');

  const python = pythonExecutable || command.program;
  const env = command.env;
  if (isPackaged) {
    const publicKey = path.join(resourcesDir, 'license', 'public.pem');
    const customer = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'customer.json');
    const signed = path.join(documentsDir, 'Engenharia360', 'CBIM', 'license', 'license.json');
    if (![publicKey, customer, signed].every(file => fs.existsSync(file))) {
      throw new Error('Conversão CBIM requer ativação offline. Confira licença do cliente e chave pública do emissor.');
    }
    const verifyArgs = [
      ...(packedRuntime ? ['studio'] : ['-m', 'compatibilizabim_core.desktop.p1_launcher']),
      'verify', '--public-key', publicKey, '--customer', customer, '--license', signed,
      '--feature', 'cad_to_cbim'
    ];
    const check = await runCbimProcess(python, verifyArgs, { cwd: core, env });
    if (check.code !== 0) throw new Error('Licença offline não autorizou conversão CAD: ' + (check.stderr || check.stdout || 'verificação recusada'));
  }

  const outputDir = path.join(documentsDir, 'Engenharia360', 'CBIM', 'jobs', 'job-' + Date.now() + '-' + randomBytes(4).toString('hex'));
  fs.mkdirSync(outputDir, { recursive: true });
  const logPath = path.join(outputDir, 'conversion.log');
  const inputPath = path.join(outputDir, request.filename);
  fs.writeFileSync(inputPath, request.bytes);
  const stem = path.parse(request.filename).name;
  const name = request.discipline + '-' + stem;
  const bridge = path.join(resourcesDir || '', 'bridges', 'acadsharp', 'CompatibilizaBIM.ACadSharpBridge.exe');
  const bridgeProject = path.join(integrated, 'dwg-acadsharp-bridge', 'CompatibilizaBIM.ACadSharpBridge.csproj');
  const args = [
    ...(packedRuntime ? ['validate-dwg'] : ['-m', 'compatibilizabim_core.validation.cli']),
    '--' + request.discipline, inputPath, '--output', outputDir
  ];
  if (fs.existsSync(bridge)) args.push('--bridge-exe', bridge);
  else if (process.env.CBIM_ACADSHARP_BRIDGE && fs.existsSync(process.env.CBIM_ACADSHARP_BRIDGE)) args.push('--bridge-exe', process.env.CBIM_ACADSHARP_BRIDGE);
  else if (!isPackaged && fs.existsSync(bridgeProject)) args.push('--bridge-project', bridgeProject);
  else throw new Error('Ponte ACadSharp não empacotada ou indisponível para importar DWG.');
  onProgress({ stage: 'Importação DWG e reconhecimento CBIM', status: 'running' });
  const result = await runCbimProcess(python, args, { cwd: core, env, logPath, onProgress });

  const batchPath = path.join(outputDir, 'validation-batch.json');
  if (!fs.existsSync(batchPath)) {
    throw new Error('Conversão não concluiu. Arquivos preservados em ' + outputDir + '. ' + (result.stderr.trim() || 'Código ' + result.code));
  }
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  const report = parseCbimBatch(batch, request.discipline);
  const ifcName = name + '.ifc';
  const ifcPath = path.join(outputDir, ifcName);
  if (!fs.existsSync(ifcPath) || !report.ifc_exported || !report.ifc_sanity_passed) {
    throw new Error('IFC não validado. Confira pendências e logs preservados em ' + outputDir);
  }

  let workspaceDir = null, studioError = null;
  const cbimPath = path.join(outputDir, name + '.cbim.json');
  const validationPath = path.join(outputDir, name + '.validation.json');
  const workspace = path.join(outputDir, 'studio-workspace');
  if (fs.existsSync(cbimPath) && fs.existsSync(validationPath)) {
    onProgress({ stage: 'Criando workspace revisável', status: 'running' });
    const prepareArgs = [
      ...(packedRuntime ? ['studio'] : ['-m', 'compatibilizabim_core.desktop.p1_launcher']),
      'prepare', '--project', cbimPath, '--source', inputPath, '--discipline', request.discipline,
      '--workspace', workspace, '--validation-report', validationPath
    ];
    const prepared = await runCbimProcess(python, prepareArgs, { cwd: core, env, logPath, onProgress });
    if (prepared.code === 0 && fs.existsSync(path.join(workspace, 'workspace.json'))) workspaceDir = workspace;
    else studioError = 'O IFC foi exportado, mas não foi possível criar o Studio: ' + (prepared.stderr || 'erro de preparação');
  } else {
    studioError = 'CBIM canônico ou relatório de validação não foi produzido.';
  }
  const tooLarge = fs.statSync(ifcPath).size > 64 * 1024 * 1024;
  const needsReview = !report.passed || Number(report.review_pending_count || 0) > 0 || tooLarge || !workspaceDir;
  onProgress({ stage: needsReview ? 'Conversão concluída com pendências' : 'IFC validado e workspace criado', status: needsReview ? 'partial' : 'complete' });
  return {
    ifcName, ifcBase64: tooLarge ? null : fs.readFileSync(ifcPath).toString('base64'),
    report, outputDir, workspaceDir, studioError, validationPassed: batch.all_passed === true,
    needsReview, tooLarge, ifcPath
  };
}

module.exports = { parseDwgRequest, parseCbimBatch, convertDwg, cancelConversion, runCbimProcess };
