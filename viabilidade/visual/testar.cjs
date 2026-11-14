// Servidor (na raiz do repositório): python -m http.server 8765 --bind 127.0.0.1
// Teste: node viabilidade/visual/testar.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// shortcut: usa o Playwright já instalado no runtime Codex; rever ao executar fora desta máquina.
const { chromium } = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const url = process.env.VISUAL_URL || 'http://127.0.0.1:8765/viabilidade/visual/';
const output = path.join(__dirname, 'evidencias');
const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../motor/exemplos/estudo-exemplo.json'), 'utf8'));

async function upload(page, contents, name = 'teste.json') {
  await page.locator('#arquivo').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(contents),
  });
}

async function checkWidth(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'A página não pode ultrapassar a largura da tela.');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
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
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      await page.locator('canvas').first().waitFor();
      assert.match(await page.locator('body').innerText(), /estudo preliminar, não substitui projeto nem aprovação/i);
      const snapshots = [];
      for (const { id: option } of example.opcoes) {
        const button = page.getByRole('button', { name: `Opção ${option}`, exact: true });
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true', `Opção ${option} selecionada.`);
        await page.waitForTimeout(150);
        snapshots.push(await page.locator('canvas').first().screenshot());
        await checkWidth(page);
        await page.screenshot({ path: path.join(output, `${profile}-${option}.png`), fullPage: true });
      }
      assert(!snapshots[0].equals(snapshots[1]) && !snapshots[1].equals(snapshots[2]),
        'As opções devem alterar a imagem da maquete.');
      const compare = page.getByRole('button', { name: 'Lado a lado', exact: true });
      await compare.click();
      assert.equal(await compare.getAttribute('aria-pressed'), 'true');
      await checkWidth(page);
      await page.screenshot({ path: path.join(output, `${profile}-comparacao.png`), fullPage: true });
      if (!mobile) {
        for (const width of [320, 768, 1024]) {
          await page.setViewportSize({ width, height: 900 });
          await checkWidth(page);
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }

      const v2 = structuredClone(example);
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
        assert.match(await page.locator('#conferencia').innerText(), /Não conferido/);
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
      await checkWidth(page);
      assert.deepEqual(errors, [], 'Nenhum erro JavaScript/console nos fluxos válidos e inválidos.');
      report.push({ perfil: profile, versaoMotor: example.versao_motor, opcoes: example.opcoes.length, comparacao: true, upload: true, contratoV2: true, jsonInvalido: invalid.length, largurasExtras: mobile ? [] : [320, 768, 1024], errosConsole: errors });
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'teste-browser.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS', JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
