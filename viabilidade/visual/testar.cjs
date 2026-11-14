// Servidor (na raiz do repositório): python -m http.server 8765 --bind 127.0.0.1
// Teste: node viabilidade/visual/testar.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// shortcut: usa o Playwright já instalado no runtime Codex; rever ao executar fora desta máquina.
const { chromium } = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { PNG } = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/utilsBundle.js');

const url = process.env.VISUAL_URL || 'http://127.0.0.1:8765/viabilidade/visual/';
const output = path.join(__dirname, 'evidencias');
const example = JSON.parse(fs.readFileSync(path.join(__dirname, '../motor/exemplos/estudo-exemplo.json'), 'utf8'));

function pixelDifference(first, second) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  let difference = 0;
  for (let index = 0; index < a.data.length; index++) difference += Math.abs(a.data[index] - b.data[index]);
  return difference / a.data.length;
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
      assert.equal(await page.locator('#relatorio').getAttribute('href'), '../relatorio/saida/estudo-exemplo.html');
      if (!mobile) {
        const twoOptions = structuredClone(example);
        twoOptions.opcoes = [example.opcoes[0], example.opcoes.at(-1)];
        await upload(page, JSON.stringify(twoOptions), 'duas-opcoes.json');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('duas-opcoes.json'));
        assert.equal(await page.locator('#opcoes button').count(), 3, 'Duas opções e o controle de comparação.');
        assert.equal(await page.getByRole('button', { name: 'Lado a lado' }).isDisabled(), false);
      }
      await page.goto(new URL('?estudo=../motor/exemplos/estudo-exemplo.json', url).href);
      await page.getByRole('button', { name: 'Opção A', exact: true }).waitFor();
      assert.match(await page.locator('body').innerText(), /estudo preliminar, não substitui projeto nem aprovação/i);
      assert.equal(example.zona.id, 'SC-Z2', 'Usar o exemplo atualizado da zona real.');
      assert.match(await page.locator('#conferencia-lote').innerText(), /não conferid/i,
        'O exemplo não comprova que o lote pertence à zona escolhida.');
      assert.doesNotMatch(await page.locator('#conferencia-lei').innerText(), /não conferid/i);
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
      await checkWidth(page);
      assert.deepEqual(errors, [], 'Nenhum erro JavaScript/console nos fluxos válidos e inválidos.');
      report.push({ perfil: profile, versaoMotor: example.versao_motor, zona: example.zona.id, estudosPiloto: 7, caNuloSemLimite: !mobile, alertasAreaEspecialDestacados: true, opcoes: example.opcoes.length, degraus: example.caixa_maxima.degraus.length, alturasExplicitasEFallback: !mobile, recuos: true, avisoSemSobreposicao: true, vgvSemCorte: true, comparacao: true, upload: true, contratoV2: true, conferenciaLoteIndependente: mobile ? 1 : zoningCases.length, paredeCega: true, faixaParedeCega: true, jsonInvalido: invalid.length, largurasExtras: mobile ? [] : [320, 768, 1024], errosConsole: errors });
      await page.close();
    }
    fs.writeFileSync(path.join(output, 'teste-browser.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS', JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
