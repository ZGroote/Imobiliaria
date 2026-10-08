/* Furniture instances: placing each piece in the interior, rebuilding parametric pieces, recolouring and the saved layout. */
(function(root) {
  "use strict";
  function create({INT, MOVEIS, geoDoMovel, geoDeParts, guarda, CIDADE, sujaLuzes, MOB}) {
const chaveSalva = id => "int_" + CIDADE.slug + "_" + id;
function salvaMoveis() {
  if (!INT.pl) return;
  sujaLuzes();
  try {
    guarda.grava(chaveSalva(INT.pl.id), JSON.stringify(INT.moveis.map(m =>
      ({ t:m.tipo, u:+m.u.toFixed(3), v:+m.v.toFixed(3), r:m.rot,
         w:+m.w.toFixed(3), d:+m.d.toFixed(3), h:+m.h.toFixed(3), c:m.cor }))));
  } catch (e) { /* aba anônima / cota cheia: o layout só não persiste */ }
}
function leMoveis(id) {
  try {
    const s = guarda.le(chaveSalva(id));
    if (!s) return null;
    const a = JSON.parse(s);
    if (!Array.isArray(a) || !a.length) return null;
    return a.filter(m => MOVEIS[m.t]).map(m =>
      ({ tipo:m.t, u:m.u, v:m.v, rot:m.r|0, w:m.w, d:m.d, h:m.h, cor:m.c }));
  } catch (e) { return null; }
}

/* ---- um móvel na cena -------------------------------------------------- */
function poeNaCena(m) {
  const o = geoDoMovel(MOVEIS[m.tipo], m.cor, m);
  m.obj = o; o.userData.movel = m;
  for (const f of o.children) f.userData.movel = m;   // o raio bate na malha, não no grupo
  atualizaMovel(m);
  INT.raiz.add(o);
}
function atualizaMovel(m) {
  const def = MOVEIS[m.tipo], o = m.obj;
  if (!o) return;
  const p = INT.pl.W(m.u, m.v);
  o.position.set(p[0], 0.03, p[1]);
  if (def.param) refazParam(m, def);
  else o.scale.set(m.w/def.b[0], m.h/def.b[1], m.d/def.b[2]);
  o.rotation.y = Math.atan2(-INT.pl.ob.uz, INT.pl.ob.ux) + m.rot * Math.PI/2;
}
/* Peca parametrica nasce na medida, entao a escala fica 1 e quem muda e a MALHA.
   So remonta quando a medida (ou a cor) mudou de verdade: `atualizaMovel` tambem e
   chamado a cada quadro do gesto de MOVER, e ali a geometria e a mesma -- remontar
   ali seria jogar fora uma geometria que o FANTASMA esta usando (ele compartilha a
   malha de proposito; ver `poeFantasma`). */
function refazParam(m, def) {
  const o = m.obj, a = m._b;
  if (a && a[0] === m.w && a[1] === m.h && a[2] === m.d && a[3] === m.cor) return;
  m._b = [m.w, m.h, m.d, m.cor];
  o.scale.set(1, 1, 1);
  const malha = o.children[0];
  if (!malha) return;
  const velha = malha.geometry;
  malha.geometry = geoDeParts(def.param(m), m.cor);
  // `MOB` so existe na variante do MODO MOVEIS; nas outras o `typeof` devolve
  // "undefined" e a geometria velha e liberada sempre.
  if (typeof MOB === "undefined" || !MOB.fantasma) velha.dispose();
}
// Refaz a malha em vez de reescrever a cor vértice a vértice: com chanfro e esfera a
// contagem por peça deixou de ser fixa, e montar de novo custa menos de um milissegundo.
function recolore(m) {
  const novo = geoDoMovel(MOVEIS[m.tipo], m.cor, m);
  m.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.raiz.remove(m.obj);
  novo.userData.movel = m;
  for (const f of novo.children) f.userData.movel = m;
  m.obj = novo;
  atualizaMovel(m);
  INT.raiz.add(novo);
}

    return {chaveSalva, salvaMoveis, leMoveis, poeNaCena, atualizaMovel, refazParam, recolore};
  }
  root.FurnitureInstances = Object.freeze({create});
})(globalThis);
