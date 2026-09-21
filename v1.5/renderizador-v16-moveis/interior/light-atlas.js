/* Unreal light atlas: embedded lightmap textures and the piece addressing shared with pipeline/unreal_exporta.py. */
(function(root) {
  "use strict";
  function create({THREE, document, sujaSombra}) {
const _LUZUE = (() => {
  try { return JSON.parse(document.getElementById("__luzue").textContent) || {}; }
  catch (e) { return {}; }
})();
const LUZ_MODO = new URLSearchParams(location.search).get("luz") || "auto";
const _texLuz = new Map();

/* A textura do atlas. Vem embutida como data URI, entao nao ha rede nem CORS --
   a pagina continua abrindo com duplo clique. `colorSpace` FICA LINEAR de
   proposito: isto e irradiancia, nao cor de superficie; marcar como sRGB
   aplicaria a curva duas vezes e escureceria o meio-tom. */
function texturaDeLuz(id) {
  if (_texLuz.has(id)) return _texLuz.get(id);
  const d = _LUZUE[id];
  let t = null;
  if (d && d.png) {
    const im = new Image();
    t = new THREE.Texture(im);
    t.flipY = true;
    // CANAL 1, e nao o padrao. Desde a r152 cada textura carrega o `channel` que ela
    // le, e o padrao e 0 -- ou seja `uv`. Sem esta linha o lightMap era amostrado com
    // a UV DE MATERIAL, que aqui esta em METROS (0..3,9 numa parede): a textura
    // clampava e a casa saia com uma faixa do atlas atravessada na parede, listrada.
    // Nada no console, nada de errado na uv1 (medida: u 0,002-0,990, v 0,742-0,998,
    // dentro do atlas) -- so a textura lendo o canal errado.
    t.channel = 1;
    t.colorSpace = THREE.LinearSRGBColorSpace || THREE.LinearEncoding;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;        // atlas: mip mistura peca com peca
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    im.onload = () => { t.needsUpdate = true; sujaSombra && sujaSombra(); };
    im.src = d.png;
  }
  _texLuz.set(id, t);
  return t;
}

/* A peca e endereçada, nao contada. A primeira versao entregava "a proxima peca" e
   dependia de `geoDaCasa` desenhar na mesma ordem em que o exportador escreveu -- e
   ele NAO desenha: o piso sai antes da parede aqui, e depois dela la. Endereçar por
   (tipo, indice, face) tira a ordem de desenho da conta, e o mesmo endereco vale
   nos dois lados.

   O mapa de enderecos, que e o contrato com `pipeline/unreal_exporta.py`:

     parede i, face f  ->  base(i) + f            (5 faces: 4 laterais + tampa)
     rodape i, face f  ->  base(i) + 5 + f        (so quando a parede nasce no chao)
     piso do comodo i  ->  P0 + i
     forro do contorno i -> P0 + n_comodos + i

   `base(i)` soma 5 ou 10 por parede anterior, conforme ela tenha rodape. Se a conta
   nao fechar com o tamanho do atlas, o cursor se recusa a existir e o interior cai
   no bake em JS -- que e o certo pra planta corrigida depois do bake. */
function cursorDeLuz(pl) {
  const d = _LUZUE[pl && pl.id];
  if (!d || !d.rects || LUZ_MODO !== "ue") return null;   // `auto` = bake em JS
  const lado = d.atlas, paredes = pl.paredes;
  const base = new Int32Array(paredes.length);
  let acc = 0;
  for (let i = 0; i < paredes.length; i++) {
    base[i] = acc;
    acc += (paredes[i].y0 < 0.05) ? 10 : 5;
  }
  const P0 = acc, T0 = P0 + pl.comodos.length;
  const esperado = T0 + pl.contorno.length;
  if (esperado !== d.rects.length) {
    if (LUZ_MODO === "ue")
      console.warn("luz: atlas de " + pl.id + " tem " + d.rects.length +
                   " pecas e a planta pede " + esperado);
    return null;
  }
  const de = k => {
    const r = d.rects[k];
    if (!r) return null;
    return (a, b) => [ (r[0] + r[2]*a) / lado, 1 - (r[1] + r[3]*b) / lado ];
  };
  return {
    total: d.rects.length,
    parede: (i, f) => de(base[i] + f),
    rodape: (i, f) => de(base[i] + 5 + f),
    piso: i => de(P0 + i),
    teto: i => de(T0 + i)
  };
}

    return {_LUZUE, LUZ_MODO, texturaDeLuz, cursorDeLuz};
  }
  root.LightAtlas = Object.freeze({create});
})(globalThis);
