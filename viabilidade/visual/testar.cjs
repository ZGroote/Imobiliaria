// Servidor (na raiz do repositório): python -m http.server 8765 --bind 127.0.0.1
// Teste: node viabilidade/visual/testar.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const runtimeModules = 'C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const load = name => {
  try { return require(name); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(runtimeModules, name));
  }
};
const { chromium } = load('playwright');
const { PNG } = load('playwright-core/lib/utilsBundle');

const url = process.env.VISUAL_URL || 'http://127.0.0.1:8765/viabilidade/visual/';
const output = path.join(__dirname, 'evidencias');
const baselineT22 = path.join(__dirname, '.tarefa22-baseline.html');
const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../motor/exemplos/estudo-exemplo.json'), 'utf8'));
const exampleBytes = fs.readFileSync(path.join(__dirname, '../motor/exemplos/estudo-exemplo.json'));
const revision = sha => `rev ${sha.slice(0, 12)} · motor ${example.versao_motor || 'não informado'}`;

function pixelDifference(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  let difference = 0;
  for (let index = 0; index < a.data.length; index++) difference += Math.abs(a.data[index] - b.data[index]);
  return difference / a.data.length;
}

async function checkAccessibility(page) {
  const visibleFocus = async () => assert(await page.evaluate(() => {
    const node = document.activeElement, style = getComputedStyle(node);
    return node.matches(':focus-visible') && parseFloat(style.outlineWidth) >= 3 && style.outlineStyle !== 'none';
  }), 'O controle deve ter foco visível ao navegar com Tab.');
  await page.keyboard.press('Tab');
  await page.locator('#abrir').focus();
  await visibleFocus();
  const optionCount = await page.locator('#opcoes button').count();
  const order = ['#exemplo', '#piloto', '#relatorio', '#preco-tela', ...Array.from({ length: optionCount }, (_, i) => `#opcoes button:nth-child(${i + 1})`), '#cards canvas', '#cards .view-actions button:first-child', '#cards .view-actions button:last-child', 'details.context:first-of-type summary', 'details.context:last-of-type summary'];
  for (const selector of order) {
    await page.keyboard.press('Tab');
    assert(await page.locator(selector).first().evaluate(node => node === document.activeElement), 'Ordem de Tab: ' + selector);
    await visibleFocus();
  }
  const options = page.locator('#opcoes button');
  await options.nth(1).focus();
  await page.keyboard.press('Enter');
  assert.equal(await options.nth(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await options.first().getAttribute('aria-pressed'), 'false');
  await options.last().focus();
  await page.keyboard.press('Space');
  assert.equal(await options.last().getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#cards canvas').count(), example.opcoes.length);
  await options.first().focus();
  await page.keyboard.press('Space');
  assert.equal(await options.first().getAttribute('aria-pressed'), 'true');
  assert.equal(await options.last().getAttribute('aria-pressed'), 'false');
  const canvas = page.locator('#cards canvas').first();
  assert.equal(await canvas.getAttribute('role'), 'img');
  assert.match(await canvas.getAttribute('aria-label'), /Maquete 3D da opção A.*volumes hipotéticos.*envelope máximo/);
  assert.equal(await canvas.getAttribute('aria-describedby'), 'ajuda-maquete');
  assert(await page.locator('#cards dl dt').count() > 0);
  assert.equal(await page.locator('#cards dl dt').count(), await page.locator('#cards dl dd').count());
  for (const selector of ['.volume-warning', '#conferencia', '#criterio-escolha']) {
    assert.equal(await page.locator(selector).getAttribute('role'), 'note');
    assert.equal(await page.locator(selector).getAttribute('aria-live'), null);
  }
  await canvas.focus();
  const before = await canvas.screenshot();
  const scroll = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => scrollY), scroll, 'Girar não deve rolar a página.');
  assert(pixelDifference(before, await canvas.screenshot()) > .1, 'A seta deve girar a maquete.');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Vista inicial');
  await page.keyboard.press('Enter');
  const initial = await canvas.screenshot();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Vista de cima');
  await page.keyboard.press('Space');
  assert(pixelDifference(initial, await canvas.screenshot()) > .1, 'Vista de cima deve funcionar com espaço.');

  const contrasts = await page.evaluate(() => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const over = (a, b) => a.slice(0, 3).map((v, i) => v * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)));
    const background = node => node ? over(rgb(getComputedStyle(node).backgroundColor), background(node.parentElement)) : [255, 255, 255];
    const luminance = color => color.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    const result = [];
    for (const selector of ['h1', '.muted', '.help', 'button:not(:disabled)', 'select', '.button', '.notice', '.volume-warning', '.highlights dt', '.highlights dd', '.details dt', '.details dd', '.alerts', '.context li', '.domain-badge', '.domain-alert', 'footer']) {
      for (const node of document.querySelectorAll(selector)) {
        if (!node.getClientRects().length) continue;
        const bg = background(node), style = getComputedStyle(node);
        result.push({ selector, kind: 'texto', ratio: ratio(over(rgb(style.color), bg), bg), minimum: 4.5 });
      }
    }
    for (const node of document.querySelectorAll('button:not(:disabled), select, .button')) {
      if (!node.getClientRects().length) continue;
      const bg = background(node), outside = background(node.parentElement), border = over(rgb(getComputedStyle(node).borderTopColor), bg);
      result.push({ selector: node.textContent.trim(), kind: 'borda', ratio: Math.min(ratio(border, bg), ratio(border, outside)), minimum: 3 });
    }
    return result;
  });
  for (const pair of contrasts) assert(pair.ratio >= pair.minimum, `${pair.kind} ${pair.selector}: ${pair.ratio.toFixed(2)}:1`);
  await options.first().focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  return contrasts;
}

async function upload(page, contents, name = 'teste.json') {
  await page.locator('#arquivo').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(contents),
  });
}

async function checkWidth(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'A página não pode ultrapassar a largura da tela.');
  assert(await page.evaluate(() => {
    const footer = document.querySelector('footer');
    return !['fixed', 'sticky'].includes(getComputedStyle(footer).position)
      && footer.getBoundingClientRect().top >= document.querySelector('main').getBoundingClientRect().bottom - 1;
  }), 'O aviso deve ficar depois do conteúdo, sem cobrir maquetes, botões ou alertas.');
  assert(await page.locator('.sem-preco').evaluateAll(nodes => nodes.every(node => {
    const style = getComputedStyle(node);
    return node.scrollWidth <= node.clientWidth + 1
      && node.getBoundingClientRect().height <= parseFloat(style.lineHeight) + 1;
  })), 'Informe o preço deve caber inteiro em uma linha.');
}

// Estudo novo (fora dos pilotos) gerado pelo Motor numa pasta servida pelo mesmo servidor; apagada no fim.
const tmpEstudo = path.join(__dirname, 'tmp-tarefa17');
async function checkNewStudy(page) {
  fs.rmSync(tmpEstudo, { recursive: true, force: true });
  const novo = path.join(tmpEstudo, 'novo'), adulterado = path.join(tmpEstudo, 'adulterado');
  execFileSync('python', ['-I', '-X', 'utf8', path.join(__dirname, '../motor/estudar.py'), '--base', 'completo', '--indices', '8697', '--zona', 'SC-Z4', '--pasta', novo], { stdio: 'ignore' });
  fs.cpSync(novo, adulterado, { recursive: true });
  const bytes = fs.readFileSync(path.join(novo, 'estudo.json')), sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const versao = JSON.parse(bytes.toString('utf8')).versao_motor;
  assert.equal(/<meta name="estudo-sha256" content="([0-9a-f]{64})"/.exec(fs.readFileSync(path.join(novo, 'relatorio.html'), 'utf8'))[1], sha);
  const trocado = Buffer.from(bytes); trocado[trocado.indexOf(0x20)] = 0x09; // um espaço vira tab: JSON válido, sha diferente
  fs.writeFileSync(path.join(adulterado, 'estudo.json'), trocado);

  await page.goto(new URL('?estudo=tmp-tarefa17/novo/estudo.json', url).href);
  await page.locator('#relatorio').waitFor();
  assert.equal(await page.locator('#relatorio').getAttribute('href'), new URL('tmp-tarefa17/novo/relatorio.html', url).href);
  assert.equal(await page.locator('#relatorio-aviso').isVisible(), false);
  assert.equal(await page.locator('#revisao').innerText(), `rev ${sha.slice(0, 12)} · motor ${versao}`);
  assert((await page.locator('#conferencia-lote').innerText()).includes('zona informada por quem pediu o estudo · não conferida'));

  await page.goto(new URL('?estudo=tmp-tarefa17/adulterado/estudo.json', url).href);
  await page.locator('#relatorio-aviso').waitFor();
  assert.match(await page.locator('#relatorio-aviso').innerText(), /relatório desatualizado para esta revisão/i);
  assert.equal(await page.locator('#relatorio').isVisible(), false);

  for (const recusado of ['https://exemplo.com/x.json', '//exemplo.com/x.json', 'javascript:alert(1)', 'data:application/json,{}']) {
    await page.goto(new URL('?estudo=' + encodeURIComponent(recusado), url).href);
    await page.locator('#erro').waitFor();
    assert.match(await page.locator('#erro').innerText(), /Estudo recusado: use um caminho relativo/, recusado);
    assert.equal(await page.locator('#estudo').isVisible(), false, recusado);
  }
}

// Página da varredura (tarefa 20): contagens, link da maquete, ordenação, filtros, CSV adulterado e pasta de fora.
const tmpVarredura = path.join(__dirname, 'tmp-tarefa20');
const payloadVarredura = '<img src=x onerror="window.__xss=1;alert(1)">, com "aspas", vírgula; e\nquebra de linha';
let varreduraPronta = false;
async function checkSweep(page, dialogs, mobile) {
  const pasta = path.join(tmpVarredura, 'varredura');
  if (!varreduraPronta) {
    fs.rmSync(tmpVarredura, { recursive: true, force: true });
    // mesmo recorte de motor/test_varrer.py: 40 m em volta do lote 30516
    execFileSync('python', ['-I', '-X', 'utf8', path.join(__dirname, '../motor/varrer.py'), '--base', 'completo', '--ponto', '-22.041484, -47.894953', '--raio', '40', '--saida', pasta], { stdio: 'ignore' });
    const adulterada = path.join(tmpVarredura, 'adulterada');
    fs.mkdirSync(adulterada);
    execFileSync('python', ['-I', '-X', 'utf8', '-c', [
      'import csv, sys',
      'linhas = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig", newline="")))',
      'for l in linhas: l["motivo"] = sys.argv[3] if l["status"] == "recusa" else l["motivo"]',
      'w = csv.DictWriter(open(sys.argv[2], "w", encoding="utf-8-sig", newline=""), fieldnames=list(linhas[0]))',
      'w.writeheader(); w.writerows(linhas)',
    ].join('\n'), path.join(pasta, 'varredura.csv'), path.join(adulterada, 'varredura.csv'), payloadVarredura]);
    varreduraPronta = true;
  }
  // referência: o leitor de CSV do próprio Python
  const csvPython = JSON.parse(execFileSync('python', ['-I', '-X', 'utf8', '-c',
    'import csv, json, sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig", newline="")))))',
    path.join(pasta, 'varredura.csv')], { encoding: 'utf8' }));
  const conta = s => csvPython.filter(l => l.status === s).length;
  const contagem = `${conta('estudo')} estudados · ${conta('recusa')} recusados · ${conta('erro')} erros`;
  assert(conta('estudo') >= 2 && conta('recusa') >= 1, contagem);
  const indices = () => page.locator('#linhas tr').evaluateAll(trs => trs.map(tr => tr.dataset.indice));

  await page.goto(new URL('varredura.html?pasta=tmp-tarefa20/varredura', url).href);
  await page.locator('#linhas tr').first().waitFor();
  assert.equal(await page.locator('#contagem').innerText(), contagem);
  const aviso = await page.locator('#aviso').boundingBox();
  assert(aviso.y >= 0 && aviso.y + aviso.height <= page.viewportSize().height, 'Aviso da varredura visível sem rolar');
  assert((await page.locator('#aviso').innerText()).startsWith('Varredura automática: zona e áreas especiais sugeridas pela leitura do mapa, não conferidas. Não é lista de lotes à venda nem garantia de aprovação.'));
  assert.deepEqual(await indices(), csvPython.map(l => l.indice), 'Uma linha por lote, na ordem do CSV');
  for (const lote of csvPython) {
    const tr = page.locator(`#linhas tr[data-indice="${lote.indice}"]`);
    assert.equal(await tr.locator('td.motivo').textContent(), lote.motivo, `Motivo completo do lote ${lote.indice}`);
    assert.equal(await tr.getByRole('link', { name: 'abrir maquete' }).count(), lote.status === 'estudo' ? 1 : 0, lote.indice);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Varredura sem rolagem lateral da página');
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(200);
  assert.equal((await page.locator('#aviso').boundingBox()).y, 0, 'Aviso fixo ao rolar');
  if (mobile) return;

  const link = page.locator('#linhas tr[data-indice="30516"]').getByRole('link', { name: 'abrir maquete' });
  assert.equal(await link.getAttribute('href'), 'index.html?estudo=tmp-tarefa20/varredura/lotes/30516/estudo.json');
  await link.click();
  await page.waitForFunction(() => document.querySelector('#lote').textContent.includes('30516'));
  assert.equal(new URL(page.url()).searchParams.get('estudo'), 'tmp-tarefa20/varredura/lotes/30516/estudo.json');

  await page.goto(new URL('varredura.html?pasta=tmp-tarefa20/varredura/', url).href);
  await page.locator('#linhas tr').first().waitFor();
  const area = page.getByRole('button', { name: 'Área (m²)' });
  const porArea = csvPython.map(l => [l.indice, Number(l.area_m2)]);
  await area.click();
  assert.deepEqual(await indices(), [...porArea].sort((a, b) => a[1] - b[1]).map(l => l[0]));
  assert.equal(await page.locator('th[data-coluna="area_m2"]').getAttribute('aria-sort'), 'ascending');
  await area.click();
  assert.deepEqual(await indices(), [...porArea].sort((a, b) => b[1] - a[1]).map(l => l[0]));
  assert.equal(await page.locator('th[data-coluna="area_m2"]').getAttribute('aria-sort'), 'descending');
  await page.getByRole('button', { name: 'Lote', exact: true }).click();
  assert.deepEqual(await indices(), csvPython.map(l => l.indice).sort((a, b) => a - b));
  assert.equal(await page.locator('th[aria-sort]').count(), 1);

  for (const status of ['estudo', 'recusa', 'erro']) {
    await page.getByLabel('Status').selectOption(status);
    assert.deepEqual((await indices()).sort(), csvPython.filter(l => l.status === status).map(l => l.indice).sort(), status);
  }
  await page.getByLabel('Status').selectOption('');
  await page.getByLabel('Zona').selectOption({ label: '(sem zona)' });
  assert.deepEqual((await indices()).sort(), csvPython.filter(l => !l.zona).map(l => l.indice).sort());
  const zona = csvPython.find(l => l.zona).zona;
  await page.getByLabel('Zona').selectOption(zona);
  assert.deepEqual((await indices()).sort(), csvPython.filter(l => l.zona === zona).map(l => l.indice).sort());
  await page.getByLabel('Status').selectOption('recusa');
  assert.equal(await page.locator('#linhas tr').count(), 0, 'Filtros combinados: recusa não tem zona');

  await page.goto(new URL('varredura.html?pasta=tmp-tarefa20/adulterada', url).href);
  await page.locator('#linhas tr').first().waitFor();
  const recusada = csvPython.find(l => l.status === 'recusa').indice;
  assert.equal(await page.locator(`#linhas tr[data-indice="${recusada}"] td.motivo`).textContent(), payloadVarredura);
  assert.equal(await page.locator('#linhas img, #linhas svg').count(), 0, 'CSV adulterado não cria elemento');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(dialogs, [], 'CSV adulterado não executa nada');

  for (const recusado of ['https://exemplo.com/x', '//exemplo.com/x', 'javascript:alert(1)', 'data:text/csv,a']) {
    await page.goto(new URL('varredura.html?pasta=' + encodeURIComponent(recusado), url).href);
    await page.locator('#erro').waitFor();
    assert.match(await page.locator('#erro').innerText(), /Pasta recusada: use um caminho relativo/, recusado);
    assert.equal(await page.locator('#resultado').isVisible(), false, recusado);
  }
}

// VGV simulado pelo preço digitado na tela: área privativa × preço, sem mexer no estudo nem na revisão.
async function checkPriceSimulation(page) {
  const revisao = await page.locator('#revisao').innerText();
  const valores = async () => (await page.locator('.vgv-tela dd').allInnerTexts()).map(t => Number(t.replace(/\D/g, '')));
  const conferir = async (preco, opcoes) => {
    const vgv = await valores();
    assert.equal(vgv.length, opcoes.length);
    opcoes.forEach((o, i) => assert(Math.abs(vgv[i] - o.metricas.area_privativa_m2 * preco) <= 1, `VGV ${o.id}: ${vgv[i]} x ${o.metricas.area_privativa_m2 * preco}`));
    await avisoVisivel(opcoes.length);
  };
  const frase = 'VGV = área privativa × preço por m² informado pelo usuário. Não é lucro, receita garantida nem valor de mercado validado.';
  const avisoVisivel = async quantos => {
    const avisos = page.locator('.vgv-aviso');
    assert.equal(await avisos.count(), quantos);
    for (let i = 0; i < quantos; i++) {
      assert.equal(await avisos.nth(i).innerText(), frase);
      assert(await avisos.nth(i).isVisible(), 'A frase do VGV fica visível sem hover.');
      assert(await avisos.nth(i).evaluate(node => node.previousElementSibling.classList.contains('highlights')), 'A frase fica logo abaixo dos números.');
    }
  };
  assert.equal(await page.locator('.vgv-tela').first().isVisible(), false, 'Campo vazio: sem VGV simulado.');
  assert.equal(await page.locator('.vgv-aviso').first().isVisible(), false, 'Sem VGV, sem a frase.');
  for (const [texto, preco] of [['8.500', 8500], ['8500', 8500], ['8500,50', 8500.5], ['R$ 8.500,50', 8500.5]]) {
    await page.locator('#preco-tela').fill(texto);
    assert.equal(await page.locator('#preco-tela').getAttribute('aria-invalid'), 'false', texto);
    assert.match(await page.locator('.vgv-tela dt').first().innerText(), /VGV estimado \(preço informado pelo usuário na tela\)/);
    await conferir(preco, [example.opcoes[0]]);
  }
  await page.getByRole('button', { name: 'Lado a lado', exact: true }).click();
  await conferir(8500.5, example.opcoes);
  for (const [texto, mensagem] of [['-8500', /maior que zero/], ['0', /maior que zero/], ['abc', /Digite só números/], ['8.5', /Digite só números/], ['250.000', /Acima de R\$ 200\.000/]]) {
    await page.locator('#preco-tela').fill(texto);
    assert.match(await page.locator('#preco-ajuda').innerText(), mensagem, texto);
    assert.equal(await page.locator('#preco-tela').getAttribute('aria-invalid'), 'true', texto);
    assert.equal(await page.locator('.vgv-tela').first().isVisible(), false, texto + ': sem VGV com preço inválido.');
    assert.equal(await page.locator('.vgv-aviso').first().isVisible(), false, texto + ': sem a frase com preço inválido.');
  }
  assert.equal(await page.locator('#revisao').innerText(), revisao, 'O preço da tela não muda a revisão.');
  const comPreco = structuredClone(example);
  comPreco.premissas.preco_venda_m2_privativo = 7000;
  comPreco.opcoes.forEach(o => { o.metricas.vgv_estimado = o.metricas.area_privativa_m2 * 7000; });
  await page.locator('#preco-tela').fill('9000');
  await upload(page, JSON.stringify(comPreco), 'estudo-com-preco.json');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('estudo-com-preco.json'));
  const destaques = await page.locator('.highlights').innerText();
  assert.match(destaques, /VGV estimado \(preço informado no estudo\)/);
  assert.match(destaques, /VGV estimado \(preço informado pelo usuário na tela\)/);
  assert(destaques.includes(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(comPreco.opcoes[0].metricas.vgv_estimado)));
  await conferir(9000, [comPreco.opcoes[0]]);
  await page.locator('#preco-tela').fill('');
  assert.equal(await page.locator('.vgv-tela').first().isVisible(), false);
  await avisoVisivel(1); // o preço do estudo continua com a frase
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(baselineT22, execFileSync('git', ['show', 'HEAD:viabilidade/visual/index.html']));
  const winChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.CHROME_PATH || (fs.existsSync(winChrome) ? winChrome : undefined);
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true, args: ['--enable-unsafe-swiftshader'],
  });
  const report = [];
  try {
    for (const mobile of [false, true]) {
      const profile = mobile ? 'celular' : 'desktop';
      const page = await browser.newPage({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1,
      });
      const errors = [];
      const dialogs = [];
      let captureTiles = false;
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) errors.push(message.text()); });
      await page.route('**/fundo.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mobile ? { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', atribuicao: '© colaboradores do OpenStreetMap', zoom_max: 17 } : {}) }));
      await page.route('https://tile.openstreetmap.org/**', route => captureTiles ? route.continue() : route.abort());
      page.on('request', request => {
        const requestUrl = new URL(request.url());
        if (['http:', 'https:'].includes(requestUrl.protocol) && requestUrl.origin !== new URL(url).origin && requestUrl.hostname !== 'tile.openstreetmap.org') {
          errors.push('Recurso fora da origem: ' + request.url());
        }
      });
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      const payload = '</title><img src=x onerror=alert(1)><svg>';
      const pilotoOrigem = JSON.parse(fs.readFileSync(path.join(__dirname, '../motor/exemplos/pilotos/SC-completo-22421.json'), 'utf8'));
      for (const [origem, rotulo] of Object.entries({
        informada_pelo_usuario: 'zona informada por quem pediu o estudo · não conferida',
        sugerida_pelo_mapa: 'zona sugerida pela leitura automática do mapa do Plano Diretor · não conferida',
      })) {
        const fixture = structuredClone(pilotoOrigem);
        fixture.lote.zona_origem = origem;
        await upload(page, JSON.stringify(fixture), origem + '.json');
        await page.waitForFunction(origem => document.querySelector('#status').textContent.includes(origem + '.json'), origem);
        assert((await page.locator('#conferencia-lote').innerText()).includes(rotulo));
        assert.doesNotMatch(await page.locator('#conferencia-lote').innerText(), /· conferida no arquivo/);
        assert(await page.locator('#conferencia-lote').evaluate(node => node.getBoundingClientRect().top >= 0 && node.getBoundingClientRect().bottom <= innerHeight));
        assert.equal(await page.evaluate(() => scrollY), 0);
        if (origem === 'sugerida_pelo_mapa') {
          fixture.lote.zona_conferida = true;
          fixture.lote.zona_sugestao = { metodo: payload, alternativas: [payload], motivo_duvida: payload, proporcao_por_zona: { 'SC-Z1': 0.8 }, distancia_divisa_m: null };
          await upload(page, JSON.stringify(fixture), 'sugestao-maliciosa.json');
          await page.waitForFunction(() => document.querySelector('#status').textContent.includes('sugestao-maliciosa.json'));
          assert((await page.locator('#conferencia-lote').innerText()).includes('Alternativas: ' + payload));
          assert((await page.locator('#conferencia-lote').innerText()).includes('Motivo de dúvida: ' + payload));
          assert.doesNotMatch(await page.locator('#conferencia-lote').innerText(), /· conferida no arquivo/);
          assert.equal(await page.locator('#conferencia img').count(), 0);
          assert.equal(dialogs.length, 0);
          fixture.lote.zona_sugestao.distancia_divisa_m = payload;
          await upload(page, JSON.stringify(fixture), 'sugestao-invalida.json');
          await page.waitForFunction(() => !document.querySelector('#erro').hidden);
          assert.match(await page.locator('#erro').innerText(), /lote.zona_sugestao.distancia_divisa_m/);
        }
      }
      for (const campo of ['volume', 'incerteza', 'lote']) {
        const mutacao = structuredClone(example);
        if (campo === 'volume') mutacao.opcoes[0].volumes[0].pavimentos = payload;
        if (campo === 'incerteza') mutacao.incertezas = [payload];
        if (campo === 'lote') mutacao.lote.id = payload;
        const nome = 'xss-' + campo + '.json';
        await upload(page, JSON.stringify(mutacao), nome);
        await page.waitForFunction(nome => document.querySelector('#status').textContent.includes(nome) || !document.querySelector('#erro').hidden, nome);
        await page.waitForTimeout(100);
        assert.equal(dialogs.length, 0, campo + ': nenhum dialog deve disparar');
        assert.equal(await page.locator('#cards img, #incertezas img, #lote img').count(), 0);
      }
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();

      if (!mobile) {
        const previa = '../projetista/exemplo-22421/estudo-previa.json';
        await page.goto(new URL('?estudo=' + encodeURIComponent(previa), url).href);
        await page.waitForFunction(() => !document.querySelector('#erro').hidden || document.querySelector('#opcoes button')?.textContent === 'Opção projetista');
        assert.equal(await page.locator('#erro').isVisible(), false, await page.locator('#erro').innerText());
        assert.equal(await page.locator('#painel-avaliacao').isVisible(), false);
        for (const label of ['Unidade', 'Circulação', 'Núcleo']) assert((await page.locator('#legenda-usos').innerText()).includes(label));
        await page.screenshot({ path: path.join(output, 'tarefa21-22421-sem-avaliacao.png'), fullPage: true });
        await page.goto(new URL('?estudo=' + encodeURIComponent(previa) + '&avaliacao=' + encodeURIComponent('avaliacao-01.json'), url).href);
        await page.getByText('Selo não conferido aqui; confira com avaliacao_valida').waitFor();
        assert.equal(await page.locator('#sintese-avaliacao').innerText(), 'HIPOTESE_PRELIMINAR');
        assert(await page.locator('#dominios-avaliacao tr').count() > 0);
        assert.match(await page.locator('#fora-escopo').innerText(), /estrutural: Fora do escopo declarado/);
        assert.doesNotMatch(await page.locator('#fora-escopo').innerText(), /\{\s*"contagem"/);
        assert.equal(await page.locator('#painel-avaliacao').getByText('Resultado preliminar e automático', { exact: false }).count(), 1);
        assert.equal(await page.locator('#painel-avaliacao').getByText(/viável|aprovado/i).count(), 0);
        await page.screenshot({ path: path.join(output, 'tarefa21-22421-com-avaliacao.png'), fullPage: true });
        await page.goto(new URL('?estudo=' + encodeURIComponent(previa) + '&avaliacao=' + encodeURIComponent('https://example.invalid/avaliacao.json'), url).href);
        await page.waitForFunction(() => document.querySelector('#erro').textContent.includes('Avaliação não carregada'));
        assert.match(await page.locator('#erro').innerText(), /use um caminho relativo/);
        assert.equal(await page.locator('#painel-avaliacao').isVisible(), false);
        await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole('button', { name: 'Vista inicial' }).click();
        const canvasMotor = await page.locator('canvas').first().screenshot({ path: path.join(output, 'tarefa22-estudo-motor.png') });
        await page.goto(new URL('.tarefa22-baseline.html?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
        await page.waitForFunction(() => window.__maquetePronta);
        await page.getByRole('button', { name: 'Vista inicial' }).click();
        const diferencaCanvas = pixelDifference(canvasMotor, await page.locator('canvas').first().screenshot());
        assert(diferencaCanvas < .001, `O canvas Motor sem estilo=maquete deve manter o HTML anterior (diferença ${diferencaCanvas}; limite 0,1%).`);
        await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
        await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();

        const resumo = '../projetista/vitrine/terreno-1/resumo.json';
        await page.goto(new URL('?resumo=' + encodeURIComponent(resumo) + '&estilo=maquete', url).href);
        await page.getByRole('button', { name: 'Opção projetista', exact: true }).waitFor();
        assert.equal(await page.locator('#acoes-maquete').isVisible(), true);
        assert.equal(await page.locator('#numeros-resumo div').count(), 6);
        assert.match(await page.locator('#numeros-resumo').innerText(), /Apartamentos\s+12 un/);
        assert.match(await page.locator('.aviso-resumo').innerText(), /Estudo preliminar — números não conferidos com a prefeitura/);
        await page.screenshot({ path: path.join(output, 'tarefa22-22421-maquete.png'), fullPage: true });
        await page.getByRole('button', { name: 'Ligar térreo' }).click();
        await page.getByRole('button', { name: 'Desligar térreo' }).waitFor();
        assert.match(await page.locator('#numeros-resumo').innerText(), /Apartamentos\s+6 un/);
        await page.screenshot({ path: path.join(output, 'tarefa22-22421-terreo.png'), fullPage: true });
        const vistaInicial = await page.locator('canvas').first().screenshot();
        await page.getByRole('button', { name: 'Vista de cima' }).click();
        assert(pixelDifference(vistaInicial, await page.locator('canvas').first().screenshot()) > .01, 'A vista de cima deve mudar a câmera.');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, 'tarefa22-22421-cima.png'), fullPage: true });
        const envelope = page.getByRole('button', { name: 'Envelope tracejado: ligado' });
        await envelope.click();
        assert.equal(await page.getByRole('button', { name: 'Envelope tracejado: desligado' }).getAttribute('aria-pressed'), 'false');
        await page.route('**/invalid-summary.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"numeros":{}}' }));
        await page.goto(new URL('?resumo=invalid-summary.json&estilo=maquete', url).href);
        await page.waitForFunction(() => document.querySelector('#erro').textContent.startsWith('Resumo inválido:'));
        assert.match(await page.locator('#erro').innerText(), /id, nome, estudo e numeros/);
        await page.unroute('**/invalid-summary.json');
        await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      }

      await page.locator('canvas').first().waitFor();
      const contrasts = await checkAccessibility(page);
      fs.writeFileSync(path.join(output, `${profile}-contraste.json`), JSON.stringify(contrasts, null, 2) + '\n');
      assert.equal(await page.locator('#relatorio').getAttribute('href'), '../relatorio/saida/estudo-exemplo.html');
      const exampleSha = crypto.createHash('sha256').update(exampleBytes).digest('hex');
      assert.equal(await page.locator('#revisao').innerText(), revision(exampleSha));
      assert.equal(await page.locator('.volume-warning').innerText(), 'Volumes hipotéticos de potencial construtivo. Não são o projeto nem a fachada do edifício e não indicam aprovação.');
      assert(await page.locator('.volume-warning').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight),
        `${profile}: o aviso da maquete precisa aparecer sem rolar a página.`);
      if (!mobile) {
        await page.route('**/relatorio/saida/estudo-exemplo.html', route => route.fulfill({
          status: 200, contentType: 'text/html', body: '<meta name="estudo-sha256" content="revisao-antiga">',
        }));
        await page.locator('#relatorio').click();
        await page.waitForFunction(() => document.querySelector('#erro').textContent.includes('Relatório desatualizado'));
        await page.unroute('**/relatorio/saida/estudo-exemplo.html');
        await checkPriceSimulation(page);
        await checkNewStudy(page);
        await checkSweep(page, dialogs, false);
        await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      }
      if (!mobile) {
        const twoOptions = structuredClone(example);
        twoOptions.opcoes = [example.opcoes[0], example.opcoes.at(-1)];
        await upload(page, JSON.stringify(twoOptions), 'duas-opcoes.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('duas-opcoes.json'));
        assert.equal(await page.locator('#revisao').innerText(), revision(crypto.createHash('sha256').update(JSON.stringify(twoOptions)).digest('hex')));
        assert.equal(await page.locator('#opcoes button').count(), 3, 'Duas opções e o controle de comparação.');
        assert.equal(await page.getByRole('button', { name: 'Lado a lado' }).isDisabled(), false);
        const noOptions = structuredClone(example);
        noOptions.opcoes = [];
        noOptions.opcoes_ausentes = [{ id: 'A', nome: 'Teste', motivo: 'impossivel', detalhe: 'Limite do lote' }];
        await upload(page, JSON.stringify(noOptions), 'sem-opcoes.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('sem-opcoes.json'));
        assert.match(await page.locator('#cards').innerText(), /Nenhuma opção coube neste lote/);
        assert.match(await page.locator('#incertezas').innerText(), /impossível pelas regras informadas.*Limite do lote/);
      }
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      assert.match(await page.locator('body').innerText(), /estudo preliminar, não substitui projeto nem aprovação/i);
      assert.equal(example.zona.id, 'SC-Z2', 'Usar o exemplo atualizado da zona real.');
      assert.match(await page.locator('#conferencia-lote').innerText(), /não conferid/i,
        'O exemplo não comprova que o lote pertence à zona escolhida.');
      assert.doesNotMatch(await page.locator('#conferencia-lei').innerText(), /não conferid/i);
      const dominios = [
        { status: 'dentro', motivos: [], versao: 'dominio-0.8' },
        { status: 'fora', motivos: ['área acima da faixa testada'], versao: 'dominio-0.8' },
        { status: 'dados_insuficientes', motivos: ['falta zona conferida'], versao: 'dominio-0.8' },
        null,
      ];
      for (const dominio of dominios) {
        const fixture = structuredClone(example);
        if (dominio) fixture.dominio = dominio;
        else delete fixture.dominio;
        const nome = `dominio-${dominio?.status || 'ausente'}.json`;
        await upload(page, JSON.stringify(fixture), nome);
        await page.waitForFunction(nome => document.querySelector('#status').textContent.includes(nome), nome);
        const selo = page.locator('#dominio');
        if (!dominio) {
          assert.equal(await selo.isVisible(), false, `${profile}: estudo antigo não deve mostrar selo.`);
        } else if (dominio.status === 'dentro') {
          assert.equal(await selo.getAttribute('class'), 'domain-badge');
          assert.equal(await selo.getAttribute('role'), 'status');
          assert.match(await selo.innerText(), /Dentro do domínio testado do motor \(dominio-0\.8\)/);
        } else {
          assert.equal(await selo.getAttribute('class'), 'domain-alert');
          assert.equal(await selo.getAttribute('role'), 'alert');
          for (const motivo of dominio.motivos) assert((await selo.innerText()).includes(motivo));
          if (dominio.status === 'fora') {
            assert.match(await selo.innerText(), /Fora do domínio testado: resultado não validado; encaminhar a profissional/);
            assert(await selo.evaluate(node => {
              const box = node.getBoundingClientRect();
              return box.top >= 0 && box.bottom <= innerHeight;
            }), `${profile}: alerta de domínio fora precisa aparecer sem rolar.`);
            assert.equal(await page.evaluate(() => scrollY), 0, `${profile}: a tela não deve rolar para o alerta.`);
          } else assert.match(await selo.innerText(), /Dados insuficientes para validar o domínio testado do motor/);
        }
      }
      await upload(page, JSON.stringify(example), 'dominio-exemplo-restaurado.json');
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      if (!mobile) {
        const v4 = structuredClone(example);
        delete v4.opcoes_ausentes;
        delete v4.criterio_escolha;
        await upload(page, JSON.stringify(v4), 'contrato-v4.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('contrato-v4.json'));
        assert.doesNotMatch(await page.locator('#incertezas').innerText(), /impossível pelas regras informadas|erro de cálculo/);
        assert.equal(await page.locator('#criterio-escolha').count(), 1);
        assert.equal(await page.locator('#criterio-escolha').isVisible(), false);

        const v5 = structuredClone(example);
        v5.lote.relevo = { cota_min_m: 10, cota_max_m: 20, declividade_pct: 5, fonte: 'Fonte teste', resolucao_m: 30 };
        v5.opcoes_ausentes = ['impossivel', 'busca_inconclusiva', 'dados_insuficientes', 'erro'].map((motivo, i) => ({ id: String.fromCharCode(65 + i), nome: `Ausente ${i}`, motivo, detalhe: `Detalhe ${i}` }));
        v5.criterio_escolha = { ordem: ['unidades_estimadas desc', 'area_privativa_m2 desc', 'pavimentos asc'], texto: 'Ordena variantes pelos critérios informados.' };
        await upload(page, JSON.stringify(v5), 'contrato-v5.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('contrato-v5.json'));
        const avisosV5 = await page.locator('#incertezas').innerText();
        for (const label of ['impossível pelas regras informadas', 'a busca não encontrou (não está provado que não existe)', 'faltam dados', 'erro de cálculo', 'Detalhe 0', 'Fonte teste', '30 m', 'Relevo aproximado (modelo de superfície de ~30 m): não substitui levantamento topográfico; a maquete assenta os volumes em terreno plano.']) assert(avisosV5.includes(label), `Aviso v5 ausente: ${label}`);
        assert.match(await page.locator('#criterio-escolha').innerText(), /Como cada opção foi montada: Ordena variantes pelos critérios informados\./);
        assert.doesNotMatch(await page.locator('#criterio-escolha').innerText(), /Opção principal|Opção A/);
      }
      for (const pilot of await page.locator('#piloto option').evaluateAll(options => options.slice(1).map(option => ({ value: option.value })))) {
        await page.locator('#piloto').selectOption(pilot.value);
        const filename = pilot.value.split('/').at(-1);
        await page.waitForFunction(filename => document.querySelector('#status').textContent.includes(filename), filename);
        assert.equal(await page.locator('#relatorio').getAttribute('href'), '../relatorio/saida/' + filename.replace(/\.json$/, '') + '.html');
        assert.match(await page.locator('#lote').innerText(), /m²/);
        if (/22421|22426|30516|37607|q1382/.test(filename)) {
          assert.equal(await page.locator('#incertezas.critical').count(), 1, `${filename}: alerta de área especial destacado.`);
          assert.match(await page.locator('#incertezas').innerText(), /sem n.mero de altura.*n.o aplicada/i);
        }
        await checkWidth(page);
        await page.screenshot({ path: path.join(output, `${profile}-piloto-${filename.replace('.json', '')}.png`), fullPage: true });
      }
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      if (!mobile) {
        const noCa = structuredClone(example);
        noCa.caixa_maxima.area_computavel_max_m2 = null;
        await upload(page, JSON.stringify(noCa), 'zona-sem-ca.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('zona-sem-ca.json'));
        assert.match(await page.locator('.details').first().innerText(), /Sem limite na lei/);
        assert.equal(await page.getByRole('alert').isVisible(), false);
        await upload(page, JSON.stringify(example), 'exemplo-restaurado.json');
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      }
      const snapshots = [];
      for (const { id: option, volumes } of example.opcoes) {
        const button = page.getByRole('button', { name: `Opção ${option}`, exact: true });
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true', `Opção ${option} selecionada.`);
        await page.waitForTimeout(150);
        snapshots.push(await page.locator('canvas').first().screenshot());
        const recuos = await page.locator('.recuos').innerText();
        assert.match(recuos, /frontal/i);
        assert.match(recuos, /premissa/i);
        for (const volume of volumes) {
          for (const field of ['recuo_lateral_m', 'recuo_fundos_m']) {
            if (typeof volume[field] === 'number') assert(recuos.includes(volume[field].toLocaleString('pt-BR') + ' m'), `${option}: recuo ${field} visível.`);
          }
        }
        await checkWidth(page);
        await page.screenshot({ path: path.join(output, `${profile}-${option}.png`), fullPage: true });
      }
      assert(!snapshots[0].equals(snapshots[1]) && !snapshots[1].equals(snapshots[2]),
        'As opções devem alterar a imagem da maquete.');
      const compare = page.getByRole('button', { name: 'Lado a lado', exact: true });
      await compare.click();
      assert.equal(await compare.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.sem-preco').count(), example.opcoes.length);
      await checkWidth(page);
      await page.screenshot({ path: path.join(output, `${profile}-comparacao.png`), fullPage: true });
      if (!mobile) {
        for (const width of [320, 768, 1024]) {
          await page.setViewportSize({ width, height: 900 });
          await checkWidth(page);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }

      if (!mobile) {
        const explicit = structuredClone(example);
        explicit.caixa_maxima.degraus.forEach((step, index, steps) => {
          step.altura_m = (steps[index + 1]?.z0_m ?? explicit.caixa_maxima.altura_m) - step.z0_m;
        });
        await upload(page, JSON.stringify(explicit), 'degraus-altura-explicita.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('degraus-altura-explicita.json'));
        const explicitSnapshot = await page.locator('canvas').first().screenshot();
        fs.writeFileSync(path.join(output, 'degraus-inferidos.png'), snapshots[0]);
        fs.writeFileSync(path.join(output, 'degraus-explicitos.png'), explicitSnapshot);
        // O antialiasing do Chrome pode variar poucos canais em renderizações equivalentes.
        assert(pixelDifference(explicitSnapshot, snapshots[0]) < .01,
          'Degraus com alturas explícitas devem renderizar igual às alturas inferidas.');
        const legacy = structuredClone(example);
        delete legacy.caixa_maxima.degraus;
        await upload(page, JSON.stringify(legacy), 'caixa-sem-degraus.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('caixa-sem-degraus.json'));
        assert(pixelDifference(await page.locator('canvas').first().screenshot(), snapshots[0]) > .01,
          'Fallback sem degraus deve renderizar caixa contínua diferente da escalonada.');
        const empty = structuredClone(example);
        empty.caixa_maxima.degraus[0].projecao_utm = [];
        empty.opcoes[0].volumes[0].recuo_lateral_m = 0;
        empty.opcoes[0].volumes[0].recuo_fundos_m = null;
        await upload(page, JSON.stringify(empty), 'degrau-vazio-recuo-zero.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('degrau-vazio-recuo-zero.json'));
        assert.match(await page.locator('.recuos').innerText(), /0 m/);
        assert.match(await page.locator('.recuos').innerText(), /Não informado/);
        assert.equal(await page.getByRole('alert').isVisible(), false);
      }

      const zoningCases = [
        { lei: true, origem: 'oficial', conferida: false, esperado: false },
        { lei: true, esperado: false },
        { lei: false, origem: 'oficial', conferida: true, esperado: true },
        { lei: true, origem: 'teste', conferida: true, esperado: false },
        { lei: true, origem: 'anotada_a_mao', conferida: false, esperado: false },
        { lei: true, conferida: true, esperado: false },
        { lei: false, origem: 'anotada_a_mao', conferida: true, esperado: true },
        { lei: true, origem: 'oficial', conferida: true, zonaId: 'SC-OUTRA', esperado: false },
        { lei: true, origem: 'oficial', conferida: true, idsAusentes: true, esperado: false },
        { lei: true, origem: 'oficial', conferida: true, idsVazios: true, esperado: false },
      ];
      if (!mobile) {
        for (const [index, testCase] of zoningCases.entries()) {
          const zoning = structuredClone(example);
          zoning.lote.id = 'TESTE SINTÉTICO — conferência da lei e do lote independentes';
          zoning.zona.conferido = testCase.lei;
          delete zoning.lote.zona_origem;
          delete zoning.lote.zona_conferida;
          if (testCase.origem !== undefined) zoning.lote.zona_origem = testCase.origem;
          if (testCase.conferida !== undefined) zoning.lote.zona_conferida = testCase.conferida;
          if (testCase.zonaId) zoning.lote.zona_id = testCase.zonaId;
          if (testCase.idsAusentes) { delete zoning.zona.id; delete zoning.lote.zona_id; }
          if (testCase.idsVazios) { zoning.zona.id = ''; zoning.lote.zona_id = ''; }
          const name = `conferencia-${index}.json`;
          await upload(page, JSON.stringify(zoning), name);
          await page.waitForFunction(name => document.querySelector('#status').textContent.includes(name), name);
          const lawUnverified = /não conferid/i.test(await page.locator('#conferencia-lei').innerText());
          const lotUnverified = /não conferid/i.test(await page.locator('#conferencia-lote').innerText());
          assert.equal(lawUnverified, !testCase.lei, `Conferência da lei: caso ${index}.`);
          assert.equal(lotUnverified, !testCase.esperado, `Conferência do lote: caso ${index}.`);
        }
      }
      const wall = structuredClone(example);
      wall.lote.id = 'TESTE SINTÉTICO — parede cega e faixa na divisa';
      wall.lote.zona_origem = 'teste';
      wall.lote.zona_conferida = false;
      wall.opcoes = [wall.opcoes[0]];
      Object.assign(wall.opcoes[0].volumes[0], {
        z0_m: 0, altura_m: 8, base_utm: wall.caixa_maxima.projecao_parede_cega_utm,
        recuo_lateral_m: 0, recuo_fundos_m: 0, parede_cega: false,
      });
      await upload(page, JSON.stringify(wall), 'parede-desmarcada.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('parede-desmarcada.json'));
      const unmarkedWall = await page.locator('canvas').first().screenshot();
      wall.opcoes[0].volumes[0].parede_cega = true;
      await upload(page, JSON.stringify(wall), 'parede-cega.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('parede-cega.json'));
      assert(await page.locator('.parede-cega').filter({ hasText: /parede cega/i }).count() > 0,
        'Volume com parede cega precisa de identificação textual.');
      assert(pixelDifference(await page.locator('canvas').first().screenshot(), unmarkedWall) > .01,
        'Parede cega deve ter uma cor diferente do volume comum.');
      await page.screenshot({ path: path.join(output, `${profile}-parede-cega.png`), fullPage: true });
      wall.opcoes[0].volumes[0].parede_cega = false;
      delete wall.caixa_maxima.parede_cega_ate_m;
      delete wall.caixa_maxima.projecao_parede_cega_utm;
      await upload(page, JSON.stringify(wall), 'sem-faixa-parede-cega.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('sem-faixa-parede-cega.json'));
      assert(pixelDifference(await page.locator('canvas').first().screenshot(), unmarkedWall) > .01,
        'A faixa da parede cega deve mudar a maquete; sua ausência continua compatível.');
      wall.caixa_maxima.parede_cega_ate_m = null;
      wall.caixa_maxima.projecao_parede_cega_utm = null;
      await upload(page, JSON.stringify(wall), 'faixa-nula.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('faixa-nula.json'));
      assert.equal(await page.getByRole('alert').isVisible(), false, 'Faixa nula significa ausente.');

      const v2 = structuredClone(example);
      v2.lote.id = 'TESTE SINTÉTICO — valores inventados para validar a interface';
      v2.premissas.preco_venda_m2_privativo = null;
      Object.assign(v2.opcoes[0].metricas, {
        area_privativa_m2: 4321, vagas: 68, area_nao_computavel_m2: 120,
        area_acima_ca_basico_m2: 550, area_garagem_m2: 1836,
        area_permeavel_m2: 300, vgv_estimado: null,
      });
      await upload(page, JSON.stringify(v2), 'contrato-v2-sem-preco.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('contrato-v2-sem-preco.json'));
      assert.match(await page.locator('.highlights').innerText(), /4\.321 m²/);
      assert.match(await page.locator('.highlights').innerText(), /68/);
      assert.match(await page.locator('.highlights').innerText(), /Informe o preço/);
      v2.premissas.preco_venda_m2_privativo = 7000;
      v2.opcoes[0].metricas.vgv_estimado = 30247000;
      await upload(page, JSON.stringify(v2), 'contrato-v2-com-preco.json');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('contrato-v2-com-preco.json'));
      assert.match(await page.locator('.highlights').innerText(), /R\$\s*30\.247\.000/);
      await page.screenshot({ path: path.join(output, `${profile}-v2.png`), fullPage: true });

      const invalid = ['{ JSON quebrado', '{}'];
      if (!mobile) {
        for (const mutate of [
          study => { study.zona.fontes = [null]; },
          study => { study.opcoes[0].metricas.area_privativa_m2 = -1; },
          study => { study.opcoes[0].metricas.vagas = 1.5; },
          study => { study.premissas.preco_venda_m2_privativo = -1; },
          study => { study.lote.poligono_utm = [[0, 0], [1e308, 0], [1e308, 1e308]]; },
          study => { study.caixa_maxima.degraus = {}; },
          study => { study.caixa_maxima.degraus[0] = null; },
          study => { study.caixa_maxima.degraus[0].altura_m = -1; },
          study => { study.caixa_maxima.degraus[1].z0_m = 0; },
          study => { study.caixa_maxima.degraus[0].projecao_utm = [[0, 0], [1, 0], [2, 0]]; },
          study => { study.caixa_maxima.recuo_frontal_m = -1; },
          study => { study.opcoes[0].volumes[0].recuo_lateral_m = -1; },
          study => { study.caixa_maxima.parede_cega_ate_m = -1; },
          study => { study.caixa_maxima.parede_cega_ate_m = '12'; },
          study => { study.caixa_maxima.projecao_parede_cega_utm = {}; },
          study => { study.caixa_maxima.projecao_parede_cega_utm = [[0, 0], [1, 0], [2, 0]]; },
          study => { study.opcoes[0].volumes[0].parede_cega = 'sim'; },
          study => { study.dominio = { status: 'fora', motivos: [null], versao: 'dominio-0.8' }; },
          study => { study.dominio = { status: 'fora', motivos: [], versao: 'dominio-0.8' }; },
        ]) {
          const bad = structuredClone(v2);
          mutate(bad);
          invalid.push(JSON.stringify(bad));
        }
      }
      for (const contents of invalid) {
        await upload(page, contents);
        const alert = page.getByRole('alert');
        await alert.waitFor({ state: 'visible' });
        assert((await alert.innerText()).trim().length > 10, 'Erro deve orientar o usuário.');
        assert.match(await page.locator('.highlights').innerText(), /R\$\s*30\.247\.000/,
          'Arquivo inválido deve preservar o último estudo válido.');
      }
      await page.screenshot({ path: path.join(output, `${profile}-erro.png`), fullPage: true });
      if (!mobile) {
        const unsourced = structuredClone(example);
        unsourced.zona.conferido = true;
        unsourced.zona.fontes = [{}];
        await upload(page, JSON.stringify(unsourced), 'fonte-vazia.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('fonte-vazia.json'));
        assert.match(await page.locator('#conferencia-lei').innerText(), /não conferid/i);
      }
      await upload(page, JSON.stringify(example), 'exemplo-valido.json');
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      await page.getByRole('alert').waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('alert').isVisible(), false, 'Upload válido limpa o erro.');
      if (!mobile) {
        const dropped = structuredClone(example);
        dropped.opcoes[0].nome = 'Arquivo arrastado de teste';
        const transfer = await page.evaluateHandle(contents => {
          const data = new DataTransfer();
          data.items.add(new File([contents], 'arrastado.json', { type: 'application/json' }));
          return data;
        }, JSON.stringify(dropped));
        await page.locator('body').dispatchEvent('drop', { dataTransfer: transfer });
        await transfer.dispose();
        await page.waitForFunction(() => document.body.innerText.includes('Arquivo arrastado de teste'));
        await page.goto(url);
        await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
        await page.locator('canvas').first().waitFor();
      }
      await page.goto(new URL('vitrine.html', url).href);
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.card').count(), 7, `Vitrine carregada. Console: ${errors.join(' | ')}`);
      assert(await page.evaluate(() => document.querySelector('#map').clientHeight <= innerHeight * .7 + 1), 'Mapa limitado a 70% da janela.');
      assert(await page.evaluate(() => document.querySelector('.preliminar').getBoundingClientRect().top >= document.querySelector('#map').getBoundingClientRect().bottom), 'Aviso não deve cobrir o mapa.');
      await page.locator('.card').nth(6).waitFor();
      assert.equal(await page.locator('.card').count(), 7);
      assert.equal(await page.locator('.card.failed').count(), 2);
      assert.match(await page.locator('.card.failed').first().innerText(), /não cabe/i);
      assert.match(await page.locator('.preliminar').innerText(), /Estudo preliminar.*números não conferidos com a prefeitura/);
      assert.match(await page.locator('#attribution').innerText(), /OpenStreetMap/);
      captureTiles = process.env.VISUAL_CAPTURE_MAP === '1' && !mobile;
      await page.getByRole('button', { name: /Terreno 6/ }).click();
      await page.locator('#fiche-title').getByText('Terreno 6').waitFor();
      assert.equal(await page.locator('#map').getAttribute('data-zoom'), mobile ? '17' : '18');
      assert.equal(await page.locator('#map').getAttribute('data-tiles-requested'), mobile ? '9' : '25');
      assert.match(await page.locator('#numbers').innerText(), /93 un/);
      await page.locator('#modo').click();
      assert.match(await page.locator('#numbers').innerText(), /87 un/);
      if (process.env.VISUAL_CAPTURE_MAP !== '1' || mobile) assert.match(await page.locator('#map-state').innerText(), /mapa indisponível/);
      else await page.waitForFunction(() => Number(document.querySelector('#map').dataset.tilesLoaded) >= 25 || !document.querySelector('#map-state').hidden, { timeout: 30000 });
      if (process.env.VISUAL_CAPTURE_MAP === '1' && !mobile) assert.equal(Number(await page.locator('#map').getAttribute('data-tiles-loaded')), 25, 'O print deve carregar os 25 ladrilhos OSM.');
      if (mobile) {
        await page.screenshot({ path: path.join(output, 'tarefa23-celular.png'), fullPage: true });
        await page.screenshot({ path: path.join(output, 'tarefa23-sem-mapa.png'), fullPage: true });
      } else if (process.env.VISUAL_CAPTURE_MAP === '1') await page.screenshot({ path: path.join(output, 'tarefa23-terreno-6.png'), fullPage: true });
      if (!mobile) {
        await page.getByRole('button', { name: /Terreno 1/ }).click();
        if (process.env.VISUAL_CAPTURE_MAP === '1') {
          await page.waitForFunction(() => Number(document.querySelector('#map').dataset.tilesLoaded) >= 25 || !document.querySelector('#map-state').hidden, { timeout: 30000 });
          assert.equal(Number(await page.locator('#map').getAttribute('data-tiles-loaded')), 25, 'Terreno 1 deve carregar os 25 ladrilhos OSM.');
        }
        if (process.env.VISUAL_CAPTURE_MAP === '1') await page.screenshot({ path: path.join(output, 'tarefa23-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Vitrine sem rolagem horizontal a 390 px.');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Vitrine sem rolagem lateral.');
      if (mobile) await checkSweep(page, dialogs, true);
      assert.deepEqual(errors, [], 'Nenhum erro JavaScript/console nos fluxos válidos e inválidos.');
      report.push({ perfil: profile, versaoMotor: example.versao_motor, zona: example.zona.id, estudosPiloto: 7, caNuloSemLimite: !mobile, alertasAreaEspecialDestacados: true, opcoes: example.opcoes.length, degraus: example.caixa_maxima.degraus.length, alturasExplicitasEFallback: !mobile, recuos: true, avisoSemSobreposicao: true, vgvSemCorte: true, comparacao: true, upload: true, contratoV2: true, conferenciaLoteIndependente: mobile ? 1 : zoningCases.length, paredeCega: true, faixaParedeCega: true, jsonInvalido: invalid.length, largurasExtras: mobile ? [] : [320, 768, 1024], errosConsole: errors });
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'teste-browser.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS', JSON.stringify(report));
  } finally {
    await browser.close();
    fs.rmSync(baselineT22, { force: true });
    fs.rmSync(tmpEstudo, { recursive: true, force: true });
    fs.rmSync(tmpVarredura, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
