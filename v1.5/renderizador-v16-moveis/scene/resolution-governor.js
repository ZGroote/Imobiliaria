/* Resolution controller; tracks frame samples and preserves slow-frame exclusions. */
(function(root) {
  "use strict";
  function create({document, getDevicePixelRatio, NIVEL, NIVEL_NOME, streaming, INT,
                   renderer, resize, guarda, atualizaBotaoQual}) {
/* ---- governador de resolução ------------------------------------------- *
   As duas alavancas que sobram depois da criação do contexto: quantos pixels desenhar,
   e com que frequência refazer o mapa de sombra. A resolução é a mais forte que existe
   -- o custo de preenchimento é quadrático nela -- e a única que pode ser mexida a
   cada quadro sem recriar nada.

   A regra é ficar acima de ALVO_MIN e não passar de ALVO_MAX, mexendo devagar: quem
   corrige a cada quadro entra em oscilação visível (a tela "respira"). Mede-se a
   MEDIANA de uma janela, não a média, porque um único engasgo de coleta de lixo puxa
   média e faz o governador reagir a nada.

   Duas janelas são descartadas de propósito -- montagem de quarteirão e voo de entrada
   na casa são picos legítimos e conhecidos, e baixar a resolução por causa deles
   pioraria justamente o momento em que o usuário está olhando. */
const ALVO_MIN = 1000/30, ALVO_MAX = 1000/55;   // ms por quadro: piso de 30, folga a 55
// Teto por amostra. Precisa passar folgado acima do pior quadro REAL (uma máquina a 3
// FPS mede 333 ms, e é exatamente ela que mais precisa do governador) e ficar bem
// abaixo do rAF estrangulado, que chega a ~1.000 ms. 400 ms separa os dois casos sem
// encostar em nenhum. Foi medido: com a aba em segundo plano `document.hidden` continua
// FALSE nesta janela, então a guarda de visibilidade sozinha não bastava -- quem
// segurou o governador foi este teto.
const DT_MAX = 400;
// A janela fecha por contagem OU por tempo. Só por contagem, a 3 FPS, a primeira
// correção sairia 15 segundos depois -- tempo demais justamente na máquina que está
// pegando fogo.
const JANELA = 45, JANELA_MS = 1500;
const _dt = []; let _govAnt = 0, _cpuMed = 0, _somaDt = 0;
let dprAtual = Math.min(getDevicePixelRatio(), NIVEL.dpr);
let rebaixado = false;
function governa(now) {
  const dt = _govAnt ? now - _govAnt : 0;
  _govAnt = now;
  // Aba oculta: o navegador estrangula o rAF pra ~1 Hz. Sem esta guarda o governador
  // leria 1.000 ms por quadro, concluiria "máquina lenta" e jogaria a resolução no
  // piso -- o usuário voltaria de outra aba com a página borrada por um engano. Mesma
  // armadilha que já engana o QA headless (ver [[mapa-3d-raf-aba-oculta]]).
  // O corte por amostra cobre de quebra alt-tab, pausa no depurador e coleta de lixo
  // longa: nada disso é sinal de GPU fraca.
  if (document.hidden) { _dt.length = 0; _somaDt = 0; return; }
  if (dt > 0 && dt < DT_MAX) { _dt.push(dt); _somaDt += dt; }
  if (_dt.length < JANELA && _somaDt < JANELA_MS) return;
  if (_dt.length < 6) { _dt.length = 0; _somaDt = 0; return; }   // amostra pequena não decide
  const ord = _dt.slice().sort((a, b) => a - b);
  const med = ord[ord.length >> 1];
  _dt.length = 0; _somaDt = 0;
  _cpuMed = med;
  // Pico conhecido: não é sinal de máquina fraca, é trabalho agendado.
  if (streaming.pending || INT.voo) return;
  const teto = Math.min(getDevicePixelRatio(), NIVEL.dpr);
  let d = dprAtual;
  if (med > ALVO_MIN)      d = Math.max(NIVEL.dprMin, dprAtual * 0.85);
  else if (med < ALVO_MAX) d = Math.min(teto, dprAtual * 1.08);
  if (Math.abs(d - dprAtual) < 0.02) return;
  dprAtual = d;
  renderer.setPixelRatio(dprAtual);
  resize();
  // Chegou no piso da resolução e AINDA não segura 30: o que falta cortar (antialias,
  // buffer logarítmico) só sai na criação do contexto. Grava o nível de baixo pra
  // próxima abertura, em vez de recarregar por conta própria no meio do uso.
  if (!rebaixado && med > ALVO_MIN && dprAtual <= NIVEL.dprMin + 0.02 && NIVEL_NOME !== "baixo") {
    rebaixado = true;
    guarda.grava("mapa3d.qual", NIVEL_NOME === "alto" ? "medio" : "baixo");
    atualizaBotaoQual();
  }
}


    return {update:governa, get dpr() { return dprAtual; }, get frameMs() { return _cpuMed; }};
  }
  root.ResolutionGovernor = Object.freeze({create});
})(globalThis);
