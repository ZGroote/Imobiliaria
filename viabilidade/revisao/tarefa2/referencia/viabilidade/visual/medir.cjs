// Servidor (na raiz do repositório): python -m http.server 8765 --bind 127.0.0.1
// Medição: node viabilidade/visual/medir.cjs (3 execuções por estudo e perfil).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const runtimeModules = 'C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const load = name => {
  try { return require(name); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(runtimeModules, name));
  }
};
const { chromium } = load('playwright');

const baseUrl = process.env.VISUAL_URL || 'http://127.0.0.1:8765/viabilidade/visual/';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = path.join(__dirname, '../motor/exemplos');
const studies = [
  { name: 'Exemplo', file: 'estudo-exemplo.json', opcoes: JSON.parse(fs.readFileSync(path.join(root, 'estudo-exemplo.json'), 'utf8')).opcoes.length },
  ...fs.readdirSync(path.join(root, 'pilotos')).filter(name => name.endsWith('.json')).sort()
    .map(file => ({ name: file.replace(/^SC-completo-/, '').replace(/\.json$/, ''), file: `pilotos/${file}`, opcoes: JSON.parse(fs.readFileSync(path.join(root, 'pilotos', file), 'utf8')).opcoes.length })),
];
const profiles = [
  { name: 'desktop', viewport: { width: 1366, height: 768 }, isMobile: false, deviceScaleFactor: 1 },
  { name: 'celular', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const bytesToMb = bytes => bytes == null ? 'n/d' : (bytes / 1048576).toFixed(1);

async function measure(browser, study, profile, run) {
  const { name: profileName, ...contextOptions } = profile;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  let bytes = 0;
  await cdp.send('Network.enable');
  cdp.on('Network.loadingFinished', event => { bytes += event.encodedDataLength; });
  if (profile.isMobile) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750,
      connectionType: 'cellular3g',
    });
  }
  try {
    const studyUrl = new URL(`../motor/exemplos/${study.file}`, baseUrl);
    await page.goto(new URL(`?estudo=${encodeURIComponent(studyUrl.href)}`, baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__maquetePronta && Number.isFinite(window.__maquetePronta.time), null, { timeout: 120000 });
    const first = await page.evaluate(() => window.__maquetePronta);
    const initialBytes = bytes;
    const fps = await page.evaluate(() => window.__medirOrbita(5000));
    const optionId = await page.evaluate(() => document.querySelector('#opcoes button[aria-pressed="true"]')?.textContent.replace('Opção ', ''));
    const next = await page.locator('#opcoes button').nth(1).textContent();
    const nextId = next?.startsWith('Opção ') ? next.replace('Opção ', '') : null;
    let trocaOpcaoMs = null;
    if (nextId && nextId !== optionId) {
      const start = await page.evaluate(() => performance.now());
      await page.getByRole('button', { name: next, exact: true }).click();
      await page.waitForFunction(id => window.__maquetePronta?.opcao === id, nextId, { timeout: 30000 });
      trocaOpcaoMs = await page.evaluate(startTime => window.__maquetePronta.time - startTime, start);
    }
    const memoria = await page.evaluate(() => performance.memory ? {
      heapUsadoBytes: performance.memory.usedJSHeapSize,
      heapTotalBytes: performance.memory.totalJSHeapSize,
      limiteHeapBytes: performance.memory.jsHeapSizeLimit,
    } : null);
    return {
      estudo: study.name, arquivo: study.file, perfil: profile.name, execucao: run,
      primeiraMaqueteMs: first.time, bytesTransferidos: initialBytes, fpsOrbita5s: fps,
      trocaOpcaoMs, memoria,
    };
  } finally {
    await context.close();
  }
}

function summarize(runs) {
  const fields = ['primeiraMaqueteMs', 'bytesTransferidos', 'fpsOrbita5s', 'trocaOpcaoMs'];
  const results = [];
  for (const study of studies) for (const profile of profiles) {
    const samples = runs.filter(row => row.estudo === study.name && row.perfil === profile.name);
    const result = { estudo: study.name, arquivo: study.file, perfil: profile.name, opcoesDisponiveis: study.opcoes };
    for (const field of fields) {
      const values = samples.map(row => row[field]).filter(Number.isFinite);
      result[field] = values.length ? median(values) : null;
    }
    for (const field of ['heapUsadoBytes', 'heapTotalBytes', 'limiteHeapBytes']) {
      const values = samples.map(row => row.memoria?.[field]).filter(Number.isFinite);
      result[field] = values.length ? median(values) : null;
    }
    results.push(result);
  }
  return results;
}

function report(date, rotulo, arquivo, results) {
  const lines = [
    `## Medição ${date} — ${rotulo}`,
    `JSON: \`medicao/${arquivo}\``,
    '| Estudo | Perfil | Primeira maquete (ms) | Transferidos (bytes) | Órbita (FPS) | Troca A→B (ms) | Heap usado (MB) |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];
  for (const row of results) lines.push(`| ${row.estudo} | ${row.perfil} | ${row.primeiraMaqueteMs?.toFixed(0) ?? 'n/d'} | ${row.bytesTransferidos ?? 'n/d'} | ${row.fpsOrbita5s?.toFixed(1) ?? 'n/d'} | ${row.trocaOpcaoMs?.toFixed(0) ?? (row.opcoesDisponiveis < 2 ? 'n/d (sem B)' : 'n/d')} | ${bytesToMb(row.heapUsadoBytes)} |`);
  return lines.join('\n');
}

(async () => {
  const date = process.env.MEDICAO_DATA || new Date().toISOString().slice(0, 10);
  const hourMinute = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(':', '');
  const label = process.env.MEDIR_ROTULO || `hora-${hourMinute}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('MEDICAO_DATA deve usar AAAA-MM-DD.');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(label)) throw new Error('MEDIR_ROTULO deve ter até 40 caracteres alfanuméricos, hífen ou sublinhado.');
  const directory = path.join(__dirname, 'medicao');
  const filename = `${date}-${label}.json`;
  const outputPath = path.join(directory, filename);
  if (fs.existsSync(outputPath)) throw new Error(`Medição já existe: ${filename}. Escolha outro MEDIR_ROTULO.`);
  const browser = await chromium.launch({
    ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {}),
    headless: true, args: ['--enable-unsafe-swiftshader'],
  });
  const runs = [];
  try {
    for (const study of studies) for (const profile of profiles) for (let run = 1; run <= 3; run++) {
      const result = await measure(browser, study, profile, run);
      runs.push(result);
      console.log(`${study.name} / ${profile.name} / ${run}: ${Math.round(result.primeiraMaqueteMs)} ms, ${Math.round(result.fpsOrbita5s)} FPS`);
    }
  } finally {
    await browser.close();
  }
  const results = summarize(runs);
  assert.equal(runs.length, studies.length * profiles.length * 3, 'Cada estudo e perfil precisa de 3 execuções.');
  assert(results.every(row => runs.filter(sample => sample.estudo === row.estudo && sample.perfil === row.perfil).length === 3), 'Cada mediana precisa de 3 amostras.');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ status: 'concluida', data: date, rotulo: label, repeticoes: 3, execucoes: runs, medianas: results }, null, 2) + '\n', { flag: 'wx' });
  console.log(report(date, label, filename, results));
})().catch(error => { console.error(error); process.exitCode = 1; });
