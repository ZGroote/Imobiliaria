// Site de imoveis (firebase.imoveis.json): a mesma regra do mapa (B1), no site novo. So o que
// tem o conteudo no nome e imutavel: o build (/b/<id>/<build>/) e os tiles (/quintais/<hash>/).
// Ponteiro, estado e raiz chegam novos. CORS so para o painel, e so no que ele le.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const IMUTAVEL = 'public, max-age=31536000, immutable';
const PAINEL = 'https://imobilaria-deccb-painel.web.app';
const VERSIONADOS = ['/b/**/manifest.json', '/b/**', '/quintais/**'];
const SEM_CACHE = ['/', '/index.html', '/404.html', '/estado.json', '/imovel/**', '/maquete/**'];
const COM_CORS = ['/b/**/manifest.json', '/estado.json'];

test('listing site: immutable only on builds and tiles, stable URLs revalidate, CORS only for the panel', () => {
  const {hosting} = JSON.parse(fs.readFileSync(new URL('../firebase.imoveis.json', import.meta.url), 'utf8'));
  const valores = (r, chave) => r.headers.filter(h => h.key.toLowerCase() === chave).map(h => h.value);
  const regra = (s, chave) => hosting.headers.filter(r => r.source === s).flatMap(r => valores(r, chave));

  assert.equal(hosting.target, 'imoveis');
  // O target so aponta pro site certo porque o .firebaserc versionado diz qual e: um deploy
  // nunca depende de um `target:apply` feito numa copia local.
  const rc = JSON.parse(fs.readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
  assert.deepEqual(rc.targets?.['imobilaria-deccb']?.hosting?.imoveis, ['imobilaria-deccb-imoveis']);
  assert.equal(hosting.public, 'publicacao/site');
  // com cleanUrls, pedir /b/<id>/<build>/tour.html daria 301 para .../tour
  assert.equal(hosting.cleanUrls, false);

  for (const r of hosting.headers) {
    if (valores(r, 'cache-control').some(v => /immutable/.test(v)))
      assert.ok(VERSIONADOS.includes(r.source), `${r.source} nao pode ser immutable`);
    for (const v of valores(r, 'access-control-allow-origin')) {
      assert.equal(v, PAINEL, `${r.source}: CORS so para o painel, nunca *`);
      assert.ok(COM_CORS.includes(r.source), `${r.source} nao precisa de CORS`);
    }
  }
  for (const s of VERSIONADOS) assert.deepEqual(regra(s, 'cache-control'), [IMUTAVEL], s);
  for (const s of SEM_CACHE) assert.deepEqual(regra(s, 'cache-control'), ['no-cache'], s);
  for (const s of COM_CORS) assert.deepEqual(regra(s, 'access-control-allow-origin'), [PAINEL], s);
  // A regra do manifest vem antes de /b/** e ja traz o Cache-Control: vale tanto se o Hosting
  // somar as regras que casam (o superstatic soma) quanto se ficar so com a primeira.
  const ordem = hosting.headers.map(r => r.source);
  assert.ok(ordem.indexOf('/b/**/manifest.json') < ordem.indexOf('/b/**'), 'manifest antes de /b/**');

  // O tour nunca e servido por rewrite: /imovel/<id> sera um ponteiro para a URL do build (B4).
  for (const r of hosting.rewrites || []) assert.ok(!/\/b\//.test(r.destination), r.source);
});
