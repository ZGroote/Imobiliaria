// Preparação: python -I -B -X utf8 viabilidade/revisao/tarefa2/auditar.py
// Servidor: python -I -B -m http.server 8879 --bind 127.0.0.1 --directory viabilidade/revisao/tarefa2/referencia
// Execução: node viabilidade/revisao/tarefa2/browser.cjs
// REVIEW_URL pode substituir a URL da cópia fixada; não apontar para o visual em edição.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const runtime = 'C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
let chromium;
try { ({chromium} = require('playwright')); }
catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; ({chromium} = require(path.join(runtime, 'playwright'))); }
const root = __dirname;
const ref = path.join(root, 'referencia/viabilidade');
const output = path.join(root, 'evidencias');
fs.mkdirSync(path.join(root, 'tmp'), {recursive: true});
process.env.TEMP = process.env.TMP = path.join(root, 'tmp');
const url = process.env.REVIEW_URL || 'http://127.0.0.1:8879/viabilidade/visual/';
const origin = new URL(url).origin;
const read = p => fs.readFileSync(p);
const json = p => JSON.parse(read(p));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const result = {url, commit: '83c107f0', status: 'iniciado', estudos: [], xss: [], avisos: [], externos: [], errosPagina: []};
const save = () => fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(result, null, 2) + '\n');
const formatted = n => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2}).format(n);
const numberBR = t => Number(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.+-]/g, ''));
assert.equal(numberBR('1.234,56 m²'), 1234.56);

async function upload(page, data, name) {
  await page.locator('#arquivo').setInputFiles({name, mimeType: 'application/json', buffer: data});
  await page.waitForFunction(name => document.querySelector('#status').textContent.includes(name)
    || !document.querySelector('#erro').hidden, name);
}

async function clickReport(page, html, expected) {
  const reportUrl = await page.locator('#relatorio').getAttribute('href');
  const absolute = new URL(reportUrl, page.url()).href;
  const context = page.context();
  if (html !== undefined) await context.route(absolute, route => html === null
    ? route.fulfill({status: 404, body: 'não encontrado'})
    : route.fulfill({status: 200, contentType: 'text/html', body: html}));
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#relatorio').click();
  const popup = await popupPromise;
  let opened = false;
  if (expected === 'abre') {
    await popup.waitForURL(absolute);
    await popup.waitForLoadState('domcontentloaded');
    const revision = await page.locator('#revisao').innerText();
    const reportSha = await popup.locator('meta[name="estudo-sha256"]').getAttribute('content');
    assert.equal(revision.split(' ')[1], reportSha.slice(0, 12));
    opened = true;
  }
  else await page.locator('#erro').waitFor({state: 'visible'});
  const error = await page.locator('#erro').isVisible() ? await page.locator('#erro').innerText() : null;
  if (!popup.isClosed()) await popup.close();
  if (html !== undefined) await context.unroute(absolute);
  return {erro: error, abriu: opened};
}

(async () => {
  let browser;
  try {
    const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader']});
    result.chrome = browser.version();
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
    context.setDefaultTimeout(15000);
    context.on('request', req => {
      if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) result.externos.push(req.url());
    });
    await context.route('**/*', route => /^https?:/.test(route.request().url()) && new URL(route.request().url()).origin !== origin
      ? route.abort() : route.continue());
    const page = await context.newPage();
    page.on('pageerror', e => result.errosPagina.push(e.message));
    for (const s of json(path.join(output, 'estudos.json'))) {
      const bytes = read(path.join(ref, s.json));
      const e = JSON.parse(bytes);
      await page.goto(new URL('?estudo=../' + s.json, url).href);
      await page.waitForFunction(() => !document.querySelector('#estudo').hidden);
      await page.locator('canvas').first().waitFor();
      const revision = await page.locator('#revisao').innerText();
      assert.equal(revision, `rev ${sha(bytes).slice(0,12)} · motor ${e.versao_motor}`);
      const committed = await clickReport(page, undefined, s.hash_confere ? 'abre' : 'avisa');
      if (!s.hash_confere) assert.match(committed.erro, /Relatório desatualizado/);
      // Nova carga limpa o erro anterior antes de conferir relatório correto.
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('#estudo').hidden);
      const fresh = await clickReport(page, read(path.join(root, 'gerados', s.id + '.html')).toString('utf8'), 'abre');
      assert.equal(fresh.erro, null);
      const reportPage = await context.newPage();
      const reportRoute = origin + '/__revisor__/relatorio.html';
      await reportPage.route(reportRoute, route => route.fulfill({contentType: 'text/html', body: read(path.join(ref, 'relatorio/saida', s.id + '.html'))}));
      await reportPage.goto(reportRoute);
      const values = await reportPage.locator('[data-campo][data-valor]').evaluateAll(nodes => nodes.map(n => ({campo:n.dataset.campo, valor:n.dataset.valor, texto:n.textContent})));
      const options = [];
      for (const o of e.opcoes) {
        await page.getByRole('button', {name: 'Opção ' + o.id, exact:true}).click();
        const metricas = await page.locator('.metrics dl > div').evaluateAll(rows => Object.fromEntries(rows.map(r => [r.querySelector('dt').textContent, r.querySelector('dd').textContent])));
        const checks = [
          ['unidades_estimadas','Unidades estimadas',1], ['area_privativa_m2','Área privativa',1],
          ['ca_usado','CA utilizado',1], ['to_usada','Taxa de ocupação',100], ['vagas','Vagas',1],
        ].map(([key,label,mult]) => {
          const spans = values.filter(v => v.campo === `opcoes.${o.id}.metricas.${key}`);
          assert(spans.length && spans.every(v => Number(v.valor) === o.metricas[key]));
          assert.equal(numberBR(metricas[label]), numberBR(formatted(o.metricas[key]*mult)));
          return {campo:key,json:o.metricas[key],tela:metricas[label],tela_normalizada:numberBR(metricas[label])/mult,
            relatorio:spans[0].texto,igual_exatamente:Math.abs(numberBR(metricas[label])/mult-o.metricas[key])<1e-9};
        });
        options.push({id:o.id,metricas:checks});
      }
      await reportPage.close();
      const v4bytes = read(path.join(root, 'casos', s.id + '-v4.json'));
      await upload(page, v4bytes, s.id + '-v4.json');
      assert.equal(await page.locator('#erro').isVisible(), false);
      assert.equal(await page.locator('#criterio-escolha').isVisible(), false);
      result.estudos.push({id:s.id,revision,commitado:committed,regenerado:fresh,opcoes:options,v4:true});
      save();
    }
    const examplePath = path.join(ref, 'motor/exemplos/estudo-exemplo.json');
    for (const [nome,html,expected] of [
      ['hash_ausente','<!doctype html><p>sem meta</p>','desatualizado'],
      ['hash_errado','<meta name="estudo-sha256" content="antigo">','desatualizado'],
      ['404',null,'conferir'],
    ]) {
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector('#estudo').hidden);
      const r = await clickReport(page, html, 'avisa');
      assert(r.erro.includes(expected));
      result.avisos.push({nome,...r});
    }
    const dialogs = [];
    page.on('dialog', async d => {dialogs.push(d.message()); await d.dismiss();});
    for (const c of json(path.join(output, 'xss-casos.json'))) {
      const data = read(path.join(root, 'casos', c.id + '.json'));
      const before = dialogs.length;
      await upload(page, data, c.id + '.json');
      const rejected = await page.locator('#erro').isVisible();
      assert.equal(rejected, c.rejeicao_visual_esperada, c.id);
      const tags = await page.locator('img[onerror],script:not([type="module"]):not([type="importmap"]),iframe,object').count();
      assert.equal(tags, 0, c.id);
      assert.equal(dialogs.length - before, 0, c.id + ': alerta na tela');
      const htmlPage = await context.newPage();
      const alertas = [];
      htmlPage.on('dialog', async d => {alertas.push(d.message()); await d.dismiss();});
      const testUrl = origin + '/__revisor__/' + c.id + '.html';
      await htmlPage.route(testUrl, route => route.fulfill({contentType:'text/html',body:read(path.join(root,'casos',c.id+'.html'))}));
      await htmlPage.goto(testUrl, {waitUntil:'networkidle'});
      const active = await htmlPage.locator('img[onerror]').count();
      if (c.tags_ativas.length) {
        assert(alertas.length > 0, c.id + ': markup ativo deve disparar alert neste controle');
        if (c.id.includes('taxa_ocupacao')) await htmlPage.screenshot({path:path.join(output,'xss-relatorio.png'),fullPage:false});
      } else assert.equal(alertas.length, 0, c.id);
      result.xss.push({id:c.id,campo:c.campo,visual_rejeitou:rejected,alertas_visual:dialogs.length-before,imgs_relatorio:active,alertas_relatorio:alertas.length});
      await htmlPage.close();
      save();
    }
    // Janela entre conferência e navegação: respostas diferentes na mesma URL.
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('#estudo').hidden);
    const target = new URL(await page.locator('#relatorio').getAttribute('href'), page.url()).href;
    let accesses = 0;
    await page.route(target, route => { accesses++; return route.fulfill({contentType:'text/html',body:read(path.join(root,'gerados/estudo-exemplo.html'))}); });
    await context.route(target, route => route.fulfill({contentType:'text/html',body:'<meta name="estudo-sha256" content="trocado"><p id="trocado">Relatório trocado após conferência</p>'}));
    const pop = page.waitForEvent('popup');
    await page.locator('#relatorio').click();
    const opened = await pop;
    await opened.waitForURL(target);
    result.troca_entre_conferencia_e_abertura = {avisou:await page.locator('#erro').isVisible(),conteudo:await opened.locator('body').innerText(),consultas:accesses};
    await opened.close();
    assert.deepEqual(result.externos, []);
    assert.deepEqual(result.errosPagina, []);
    result.status = 'concluido';
    save();
    console.log(JSON.stringify({status:result.status,estudos:result.estudos.length,casosXss:result.xss.length,externos:result.externos.length,troca:result.troca_entre_conferencia_e_abertura}));
  } catch (e) {
    result.status = /EPERM|EACCES|not permitted|Access is denied/i.test(String(e)) ? 'bloqueado_por_permissao' : 'falhou';
    result.erro = String(e.stack || e);
    save();
    console.error(result.status, result.erro);
    process.exitCode = 1;
  } finally { if (browser) await browser.close(); }
})();
