/* Do anuncio ate a porta: vitrine, escolha do predio, ficha do imovel e volta do "perto". */
(function(root) {
  "use strict";
  function create({document, $, esc, brl, UNIDADES, listingSheet,
                   usheet, hsheet, housesBox, houseBeacon, target, streamUpdate, flyTo,
                   getGroups, predioDaUnidade, closePoiSheet, abrePerto, enterInterior,
                   setTimeout,
                   // A escada das tres etapas (listings/stage.js). Entram como funcao,
                   // e nao como valor, porque `vaiParaEtapa` so existe depois que o
                   // app.js terminou de montar tudo -- ver a nota de TDZ la.
                   getEtapa, pintaEtapas, vaiParaEtapa, tour, marcaEtapaNaUrl,
                   mostraMaquete, escondeMaquete, predioMaisPerto}) {
const iaviso = $("iaviso");
let escolhendo = null;            // unidade esperando o usuario apontar o predio
function pedePredio(u, texto) {
  escolhendo = u;
  $("iavisoT").textContent = texto ||
    "Clique no prédio do " + ((u.ficha && u.ficha.empreendimento) || "empreendimento");
  iaviso.classList.add("on");
}
function cancelaEscolha() { escolhendo = null; iaviso.classList.remove("on"); }
$("iavisoX").addEventListener("click", cancelaEscolha);

function abreUnidade(u, tentativa) {
  // A vitrine e montada na inicializacao do modulo; a CIDADE chega depois. Clicar no
  // anuncio nesse meio-tempo achava zero predio e caia no "clique no predio certo" --
  // que e a resposta pra ancora ausente, nao pra cidade que ainda nao chegou.
  if (!getGroups().length) {
    if ((tentativa || 0) < 40) return setTimeout(() => abreUnidade(u, (tentativa||0)+1), 400);
    pedePredio(u, "A cidade ainda nao carregou. Clique no predio do empreendimento.");
    return;
  }
  const alvo = predioDaUnidade(u);
  if (!alvo) { pedePredio(u); return; }
  const rec = alvo.rec;
  let mx = 0, mz = 0;
  if (rec) {
    for (const p of rec.r) { mx += p[0]; mz += p[1]; }
    mx /= rec.r.length; mz /= rec.r.length;
  } else {
    // Unidade de LOTE: o alvo e o proprio terreno. O farol de chao (houseBeacon) ja
    // marca ponto, nao volume -- e por isso ele serve pro lote sem nenhuma mudanca.
    mx = alvo.lote.x; mz = alvo.lote.z;
  }
  // Voa igual a vitrine sempre voou e acende o farol -- e PARA AQUI. Ate o v12 o
  // clique caia dentro da casa 980 ms depois; quem so queria saber o que era aquele
  // anuncio se via em primeira pessoa numa sala, sem ter lido metragem nem comodo, e
  // com a cidade sumindo atras do corte. Agora a visita 3D e um botao da ficha.
  houseBeacon.position.set(mx, 0, mz);
  houseBeacon.visible = true;
  target.set(mx, 0, mz);
  streamUpdate(true);
  flyTo(mx, mz, 190);
  abreFichaDoImovel(u, rec, alvo.confirmado, mx, mz);
}

/* ---- a ficha do imovel -------------------------------------------------
   O que o anuncio diz (preco, quartos, vagas) mais o que a PLANTA diz (quantos
   comodos, quais, e quantos metros cada um). Os dois vem do mesmo `unidade.json`, e a
   ficha e o unico lugar da pagina onde eles aparecem juntos. */
let FICHA = null;                       // { u, rec, x, z } -- de quem a ficha e agora

function abreFichaDoImovel(u, rec, confirmado, x, z) {
  FICHA = { u, rec, x, z };
  listingSheet.preenche(u, confirmado);
  usheet.classList.add("on");
  usheet.classList.remove("min");
  hsheet.classList.remove("on");
  closePoiSheet();
  // Abrir a ficha e estar na ETAPA 1. A escada de botoes e pintada aqui porque e aqui
  // que se sabe se a unidade tem planta -- sem ela nao ha etapa 2 nem 3.
  getEtapa().atual = "mapa";
  pintaEtapas();
  // E e aqui que a miniatura nasce. `rec` pode ser nulo em unidade de LOTE (o predio
  // ainda nao existe na base): sem volume nao ha o que modelar, e o painel nao aparece.
  if (rec) mostraMaquete(rec, u, "usheet"); else escondeMaquete();
}
// Voltar do "por perto" e reabrir a ficha exatamente como ela estava, inclusive o voo.
function reabreFicha() {
  if (!FICHA) return;
  usheet.classList.add("on");
  usheet.classList.remove("min");
  houseBeacon.position.set(FICHA.x, 0, FICHA.z);
  houseBeacon.visible = true;
  flyTo(FICHA.x, FICHA.z, 190);
}
$("ux").addEventListener("click", () => {
  usheet.classList.remove("on"); houseBeacon.visible = false;
  tour(false);                       // fechar a ficha encerra a apresentacao
  escondeMaquete();
  FICHA = null; pintaEtapas(); marcaEtapaNaUrl();
});
// O mesmo botao, agora como degrau 2 da escada -- a troca de etapa tem UMA porta.
$("uEnter").addEventListener("click", () => vaiParaEtapa("interior"));
$("uPerto").addEventListener("click", () => {
  if (!FICHA) return;
  abrePerto({ x: FICHA.x, z: FICHA.z, nome: $("uName").textContent, volta: reabreFicha });
});

// A vitrine do HTML e a mesma; muda a origem de um dos itens.
for (const u of UNIDADES) {
  if (!u.planta || !u.planta.comodos || !u.planta.comodos.length) continue;
  if (String(u.id).charAt(0) === "_") continue;   // gabarito de formato nao e imovel
  const f = u.ficha || {};
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hitem";
  // A origem da confirmacao depende de ser lote ou predio; o aviso e sobre localizacao.
  const emLote = !!(u.lote && u.lote.lat != null);
  const conf = emLote ? u.lote.confirmado === true
                      : !!(u.ancora && u.ancora.confirmado === true);
  el.innerHTML = '<div class="t">' + esc(f.empreendimento && f.empreendimento !== "\u2014"
      ? f.empreendimento : (f.titulo || u.id)) + "</div>" +
    '<div class="b">' + esc([f.bairro, (u.andar ? u.andar + "\u00ba andar" : null)]
      .filter(Boolean).join(" \u00b7 ")) +
      (conf ? "" : ' <span class="aviso">\u00b7 Localização aproximada, ainda não confirmada</span>') + "</div>" +
    '<div class="p ' + (f.tipo === "aluguel" ? "rent" : "sale") + '">' +
      (f.preco ? brl(f.preco) + (f.tipo === "aluguel" ? "/m\u00eas" : "") : "Sob consulta") + "</div>";
  el.dataset.unidade = u.id;   // marca o item que tem interior, e nao so farol
  el.addEventListener("click", () => abreUnidade(u));
  housesBox.appendChild(el);
}

    // `abreFichaDoImovel` e `reabreFicha` sao internos: quem os chama e a propria vitrine
    // e o botao "por perto", aqui dentro.
    // `getFicha`/`setFicha`: a escada das etapas (listings/stage.js) precisa saber de
    // quem e a ficha, e a entrada pelo PREDIO precisa escreve-la sem passar por aqui.
    // Sao os dois unicos motivos de `FICHA` sair deste arquivo -- continua sendo `let`
    // privado, e ninguem de fora enxerga a variavel, so estas duas portas.
    return {pedePredio, cancelaEscolha, abreUnidade, getEscolhendo: () => escolhendo,
            getFicha: () => FICHA, setFicha: f => { FICHA = f; }};
  }
  root.ListingFlow = Object.freeze({create});
})(globalThis);
