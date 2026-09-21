/* Bidirectional listing/building resolution; preserves existing anchor keys. */
(function(root) {
  "use strict";
  function create({units:UNIDADES, getGroups, slug, storage:guarda, px, pz,
                   recDoLancamento, recsDoLancamento, forcedPlan:PLANTA_FORCADA}) {
function idDoRegistro(rec) {
  let mx = 0, mz = 0;
  for (const p of rec.r) { mx += p[0]; mz += p[1]; }
  return Math.round(mx/rec.r.length*10) + "_" + Math.round(mz/rec.r.length*10);
}
// Normalmente a unidade acha o predio dela por `predio_id`. `?planta=<id>` forca UMA
// planta em qualquer predio que se clicar: e como se confere uma planta recem-extraida
// antes de decidir em que torre ela mora, sem que isso sequestre a pagina normal --
// sem o parametro, predio sem unidade cadastrada continua caindo no BSP.

/* Predio -> unidade. E a INVERSA de `predioDaUnidade`, e tem que ser mesmo: enquanto
   ela olhava so `predio_id`, a outra ja resolvia por tres fontes (predio fixado a mao,
   `predio_id` e a `ancora` lat/lon do anuncio). O resultado era um mapa em que a
   vitrine achava o predio do imovel e o predio nao achava o imovel de volta -- e a
   unica unidade real do acervo (mirra-114) tem justamente `predio_id: null`.

   Perguntar "de quem e este predio?" percorrendo as unidades e barato porque UNIDADES
   tem uma dezena de itens, nao milhares, e isso so roda no clique.                  */
function unidadeDoPredio(rec) {
  const id = idDoRegistro(rec);
  let forcada = null;
  for (const u of UNIDADES) {
    if (!u.planta || !u.planta.comodos || !u.planta.comodos.length) continue;
    // Lancamento com varios blocos: a torre gemea e o embasamento sao do MESMO
    // empreendimento, e clicar neles tem que abrir a mesma ficha. So o principal e
    // devolvido por `predioDaUnidade`, entao a busca olha a lista inteira.
    if (u.lote && recsDoLancamento(u).some(b => idDoRegistro(b) === id)) return u;
    const alvo = predioDaUnidade(u);
    // `alvo.rec` nulo e unidade de LOTE: ela nao e dona de volume nenhum, entao nao
    // pode ser devolvida por clique em predio -- senao o predio vizinho do terreno
    // abriria a ficha do lancamento como se fosse dele.
    if (alvo && alvo.rec && idDoRegistro(alvo.rec) === id) return u;
    if (PLANTA_FORCADA && u.id === PLANTA_FORCADA) forcada = u;
  }
  return forcada;
}

/* ---- a vitrine leva pra dentro -----------------------------------------
   No mapa de Sao Carlos a lista "Imoveis para inspecao 3D" ja voava a camera ate o
   anuncio e acendia um farol no chao. Uma unidade COM PLANTA merece ir alem: clicar
   nela voa ate o predio e ENTRA. O caminho de volta e o botao Sair, que ja existe.

   O elo fraco e saber em qual predio a unidade mora. Tres fontes, nessa ordem:
   o predio fixado a mao (localStorage), o `predio_id` do cadastro, e a `ancora`
   lat/lon do anuncio -- que resolve pro predio mais proximo. Nenhuma delas e
   confiavel por si so num anuncio que so diz "em frente ao shopping", entao existe o
   "Trocar predio": clica no predio certo uma vez e fica gravado. */
const chaveAncora = id => "ancora_" + slug + "_" + id;

function predioDeId(id) {
  for (const g of getGroups()) for (const b of g.B) if (idDoRegistro(b) === id) return b;
  return null;
}
function predioMaisPerto(x, z, raio) {
  let melhor = null, dm = raio * raio;
  for (const g of getGroups()) {
    if (Math.hypot(g.cx - x, g.cz - z) - g.rad > raio) continue;
    for (const b of g.B) {
      let mx = 0, mz = 0;
      for (const p of b.r) { mx += p[0]; mz += p[1]; }
      mx /= b.r.length; mz /= b.r.length;
      const d = (mx-x)*(mx-x) + (mz-z)*(mz-z);
      if (d < dm) { dm = d; melhor = b; }
    }
  }
  return melhor;
}
/* Unidade de LOTE: o imovel mora num TERRENO, nao num volume da base.

   E o caso do LANCAMENTO, e ele nao e exotico -- e o que um acervo de imobiliaria tem
   de mais comum. A base de edificacao e foto de satelite: se a torre nao estava de pe
   na captura, o que existe no dado e um lote vazio, e nao ha volume nenhum pra vestir.
   Ate aqui isso caia no "clique no predio do empreendimento", que e a resposta pra
   ancora ERRADA, nao pra predio que ainda nao foi construido -- e a ficha nem abria.

   O lote vence as tres fontes de predio (mao, `predio_id`, `ancora`) porque nao e uma
   quarta pista sobre onde o predio esta: e a afirmacao de que predio nao ha.          */
const loteDaUnidade = u =>
  (u.lote && u.lote.lat != null) ? { x: px(u.lote.lon), z: pz(u.lote.lat) } : null;

function predioDaUnidade(u) {
  const lt = loteDaUnidade(u);
  // Com `lote.predio` declarado o lancamento TEM volume na cena (ver recDoLancamento), e
  // o caminho volta a ser o de sempre: registro de verdade, furo de verdade, clique nos
  // dois sentidos. Sem predio, o lote continua sendo so um ponto no chao.
  if (lt) return { rec: recDoLancamento(u), lote: lt, confirmado: u.lote.confirmado === true };
  let fixado = null;
  try { fixado = guarda.le(chaveAncora(u.id)); } catch (e) {}
  if (fixado) { const r = predioDeId(fixado); if (r) return { rec: r, confirmado: true }; }
  if (u.predio_id) { const r = predioDeId(u.predio_id); if (r) return { rec: r, confirmado: true }; }
  const a = u.ancora;
  if (a && a.lat != null) {
    const r = predioMaisPerto(px(a.lon), pz(a.lat), 120);
    if (r) return { rec: r, confirmado: a.confirmado === true };
  }
  return null;
}


    return {idDoRegistro, unidadeDoPredio, chaveAncora, predioDeId,
      predioMaisPerto, loteDaUnidade, predioDaUnidade};
  }
  root.ListingIdentity = Object.freeze({create});
})(globalThis);
