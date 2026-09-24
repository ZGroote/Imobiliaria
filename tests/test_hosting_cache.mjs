// Politica de cache do site do mapa (bloco "hosting" do firebase.json). So pode ficar 1 ano no
// navegador o que tem a versao no nome; URL estavel tem que chegar nova. E redirect de mapa
// antigo aponta pro ponteiro estavel "/", nunca pra outro mapa versionado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const IMUTAVEL = 'public, max-age=31536000, immutable';
const SEM_CACHE = ['/', '/index.html', '/404.html', '/mapa/imovel-*', '/mapa/sao-carlos-v16-moveis*'];
const VERSIONADOS = ['/mapa/sao-carlos-exteriores-*', '/mapa/quintais/**'];
const MAPAS_ANTIGOS = ['bdf9c99b605a', 'abd917c0b117', '95f1f62f6ea3', '64a4258bfc48'];

test('map hosting: immutable only on versioned assets, stable URLs revalidate, old maps redirect to /', () => {
  const {hosting} = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const cacheDe = r => r.headers.filter(h => h.key.toLowerCase() === 'cache-control').map(h => h.value);
  const regra = s => hosting.headers.filter(r => r.source === s).flatMap(cacheDe);
  const destino = s => hosting.redirects.filter(r => r.source === s).map(r => [r.destination, r.type]);

  // "/mapa/**" imutavel congelava por 1 ano o index do imovel e o mapa de nome fixo.
  for (const r of hosting.headers)
    if (cacheDe(r).some(v => /immutable/.test(v)))
      assert.ok(VERSIONADOS.includes(r.source), `${r.source} nao pode ser immutable`);
  for (const s of SEM_CACHE) assert.deepEqual(regra(s), ['no-cache'], s);
  for (const s of VERSIONADOS) assert.deepEqual(regra(s), [IMUTAVEL], s);

  for (const h of MAPAS_ANTIGOS)
    for (const s of [`/mapa/sao-carlos-exteriores-${h}`, `/mapa/sao-carlos-exteriores-${h}.html`])
      assert.deepEqual(destino(s), [['/', 302]], s);
  assert.deepEqual(destino('/sao-carlos'), [['/', 301]], '/sao-carlos');
});
