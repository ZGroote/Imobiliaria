/* Furniture editor rules: grid snap, a local axis measured in plan space, one-sided resize and whether a piece fits. */
(function(root) {
  "use strict";
  function create({THREE, INT, MOB, MOVEIS, ESP, dentroDaPlanta, paraUV, atualizaMovel, seleciona, salvaMoveis}) {
const arred = v => Math.round(v / MOB.passo) * MOB.passo;

/* Direcao de um eixo LOCAL do movel expressa em (u,v) da planta. Medida, nao
   deduzida: ver a nota no topo do bloco. */
const _mobEul = new THREE.Euler(), _mobV = new THREE.Vector3();
function dirUV(m, lx, lz) {
  const o = m.obj;
  const a = paraUV(o.position.x, o.position.z);
  _mobEul.set(0, o.rotation.y, 0);
  _mobV.set(lx, 0, lz).applyEuler(_mobEul);
  const b = paraUV(o.position.x + _mobV.x, o.position.z + _mobV.z);
  return [b[0] - a[0], b[1] - a[1]];
}

/* Crescer por UM lado. `sinal` diz qual face anda: a oposta fica onde estava, que
   e a diferenca entre "puxei a lateral do armario" e "o armario inchou no lugar". */
function redimensiona(m, k, novo, sinal) {
  novo = Math.max(k === "h" ? 0.04 : 0.20, Math.min(3.5, novo));
  const d = novo - m[k];
  if (k !== "h") {
    const uv = dirUV(m, k === "w" ? sinal : 0, k === "d" ? sinal : 0);
    m.u += uv[0] * d/2; m.v += uv[1] * d/2;
  }
  m[k] = novo;   // altura cresce sempre pra cima: a base do movel e o chao
  atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
}

/* O destino cabe? Duas perguntas, e nenhuma delas e a colisao de quem anda: um
   movel PODE encostar na parede (e onde ele fica), mas nao pode sair da planta
   nem entrar noutro movel. */
/* O contorno do cômodo corre no EIXO da parede, não na face dela. Testar o canto do
   móvel contra o contorno, portanto, deixa empurrar o móvel 6,5 cm PRA DENTRO da
   parede e o contorno continua verde -- era assim que a bancada e a cortina acabavam
   enterradas. O canto é testado 6,5 cm PRA FORA da caixa: o que se exige não é "o
   móvel está no cômodo", é "o móvel não invade a parede". Mesma constante do
   `MEIA_PAREDE` do `mobiliar.py`. */
const MEIA_PAREDE = ESP/2;
function cabeAqui(m, u, v) {
  const par = m.rot % 2 === 0;
  const eu = (par ? m.w : m.d)/2 + MEIA_PAREDE, ev = (par ? m.d : m.w)/2 + MEIA_PAREDE;
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const p = INT.pl.W(u + su*eu, v + sv*ev);
    if (!dentroDaPlanta(INT.pl, p[0], p[1])) return false;
  }
  const alto = t => MOVEIS[t.tipo] && MOVEIS[t.tipo].alto;
  // A caixa envolvente de todo movel e contada DO CHAO, inclusive a do que fica
  // pendurado (ver a nota do `aereo` no catalogo). Sem esta excecao a coifa,
  // que nasce EM CIMA do fogao, acusa colisao com ele -- e o gesto de mover
  // qualquer um dos dois ja comecava vermelho, dizendo que nao cabe onde esta.
  if (alto(m)) return true;
  for (const o of INT.moveis) {
    if (o === m || alto(o) || o.h < 0.06 || m.h < 0.06) continue;   // tapete convive com tudo
    const opar = o.rot % 2 === 0;
    const ou = (opar ? o.w : o.d)/2, ov = (opar ? o.d : o.w)/2;
    if (Math.abs(u - o.u) < eu + ou - 0.02 && Math.abs(v - o.v) < ev + ov - 0.02)
      return false;
  }
  return true;
}

    return {arred, dirUV, redimensiona, cabeAqui};
  }
  root.FurnitureEditor = Object.freeze({create});
})(globalThis);
