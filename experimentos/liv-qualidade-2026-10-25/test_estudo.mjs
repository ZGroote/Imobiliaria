import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { studioPixelRatio } from './quality-config.mjs';
import { planSVG } from './plan-svg.mjs';

const units = Object.fromEntries(await Promise.all(['canto', 'meio'].map(async type => [
  type,
  JSON.parse(await readFile(new URL(`../../publicacao/liv-duplo-20261017/payload/liv-classico/interiores/${type}/unidade.json`, import.meta.url), 'utf8')),
])));

test('resolução respeita 3,2M pixels e DPR máximo 2 em telas usuais e extremas', () => {
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [8000, 8000]]) {
    for (const deviceRatio of [1, 1.25, 1.5, 2, 3, 4]) {
      const ratio = studioPixelRatio(width, height, deviceRatio);
      assert.ok(Number.isFinite(ratio) && ratio > 0 && ratio <= 2);
      assert.ok(width * height * ratio ** 2 <= 3_200_000 + 1e-6, `${width}×${height}, DPR ${deviceRatio}`);
    }
  }
  assert.equal(studioPixelRatio(390, 844), 1.5);
  assert.equal(studioPixelRatio(390, 844, 4), 2);
  assert.ok(Number.isFinite(studioPixelRatio(0, 0, 2)));
});

for (const [type, unit] of Object.entries(units)) {
  test(`planta ${type}: SVG mantém polígonos, mobiliário e enquadramento`, () => {
    const svg = planSVG(unit);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /role="img" aria-labelledby="title desc"/);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.equal((svg.match(/<polygon /g) || []).length, unit.planta.comodos.length * 2);
    assert.equal((svg.match(/<g transform=/g) || []).length, unit.planta.moveis.length);
    assert.equal((svg.match(/<text /g) || []).length, unit.planta.comodos.length);
    for (const room of unit.planta.comodos) {
      const points = room.poly.map(point => point.join(',')).join(' ');
      assert.ok(svg.includes(`points="${points}"`), room.nome);
    }
    const [x, y, width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    assert.ok(width > 0 && height > 0);
    for (const [px, py] of unit.planta.comodos.flatMap(room => room.poly)) {
      assert.ok(px > x && px < x + width && py > y && py < y + height, 'polígono dentro da margem');
    }
  });

  test(`planta ${type}: portas e janelas aparecem com cores distintas`, () => {
    const svg = planSVG(unit);
    assert.equal((svg.match(/stroke="#efede5"/g) || []).length, unit.planta.portas.length);
    assert.equal((svg.match(/stroke="#a4c1bb"/g) || []).length, unit.planta.janelas.length);
    assert.equal((svg.match(/stroke="#a39880"/g) || []).length, unit.planta.portas.filter(door => door.largura < 1).length);
  });
}

test('títulos e nomes dos cômodos escapam caracteres XML', () => {
  const unit = structuredClone(units.canto);
  const name = '<script>alert("x")</script> & \'teste\'';
  unit.ficha.titulo = name;
  unit.planta.comodos[0].nome = name;
  const svg = planSVG(unit);
  const escaped = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &apos;teste&apos;';
  assert.ok(svg.includes(`<title id="title">${escaped} — estudo vetorial</title>`));
  assert.ok(svg.includes(`>${escaped}</text>`));
  assert.ok(!svg.includes(name));
  assert.doesNotMatch(svg, /<script\b/);
});

test('aberturas verticais e horizontais respeitam posição e largura', () => {
  const unit = structuredClone(units.canto);
  unit.planta.portas = [
    { wallId: 'c1-east', p: [2, 3], largura: .8 },
    { wallId: 'c1-north', p: [4, 5], largura: .8 },
  ];
  unit.planta.janelas = [
    { wallId: 'c1-west', p: [6, 7], largura: 1 },
    { wallId: 'c1-south', p: [8, 9], largura: 2 },
  ];
  const svg = planSVG(unit);
  assert.ok(svg.includes('<line x1="2" y1="2.6" x2="2" y2="3.4" stroke="#efede5"'));
  assert.ok(svg.includes('<line x1="3.6" y1="5" x2="4.4" y2="5" stroke="#efede5"'));
  assert.ok(svg.includes('<line x1="6" y1="6.5" x2="6" y2="7.5" stroke="#a4c1bb"'));
  assert.ok(svg.includes('<line x1="7" y1="9" x2="9" y2="9" stroke="#a4c1bb"'));
  assert.equal((svg.match(/stroke="#a39880"/g) || []).length, 2);
});

test('planta ausente, vazia ou sem polígonos é rejeitada', () => {
  for (const planta of [undefined, {}, { comodos: [] }, { comodos: [{}] }, { comodos: [{ poly: [] }] }]) {
    assert.throws(() => planSVG({ ficha: { titulo: 'Inválida' }, planta }), /Planta sem polígonos registrados/);
  }
});
