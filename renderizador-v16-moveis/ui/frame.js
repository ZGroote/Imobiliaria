/* O que o laco de quadro chama na camada de UI: noite, link na URL e minimapa. */
(function(root) {
  "use strict";
  function create({$, INT, FP, NOITE, MM, target, sph, aplicaNoite, frameLoop, escreveLink,
                   desenhaMinimapa, desenhaPlantaMini}) {
    let _linkT = 0;
let _v12Int = false, _v12Ult = 0, _mmDentro = false;
function v12Frame(now) {
  // Sair da casa: o interiorFrame restaurou os valores de DIA que ele guardou na
  // entrada. Se estava de noite, é aqui que a noite volta.
  if (_v12Int && !INT.on) aplicaNoite();
  _v12Int = INT.on;

  // A transicao anda pelo RELOGIO, nao por quadro. Medido no rasterizador de
  // software (o pior caso, e o do QA headless): 8 quadros em 6 s -- com passo por
  // quadro o amanhecer levava 30 s e parecia que o botao nao tinha funcionado.
  // O teto de 400 ms nao e enfeite: no rasterizador de software o quadro leva ~750 ms,
  // e com teto de 120 a transicao andava 0,17 por quadro -- 6 s pra escurecer. O teto
  // existe so pra que uma pausa longa (aba escondida) nao vire um salto seco.
  const dt = Math.min(400, Math.max(0, now - (_v12Ult || now)));
  _v12Ult = now;
  if (NOITE.t !== (NOITE.on ? 1 : 0)) {
    const passo = dt / 700;
    NOITE.t = NOITE.on ? Math.min(1, NOITE.t + passo) : Math.max(0, NOITE.t - passo);
    aplicaNoite();
    frameLoop();
  }
  // v13: dentro da casa o minimapa nao se esconde mais -- ele troca de assunto e
  // desenha a PLANTA do imovel (ver desenhaPlantaMini). Entrar e sair invalida os dois
  // lados: quem entra pode nao ter andado um metro, e quem sai encontra o quadrado com
  // a planta ainda pintada.
  if (INT.on !== _mmDentro) {
    _mmDentro = INT.on;
    $("minimapa").hidden = !MM.on;
    $("minimapa").title = INT.on ? "Planta do im\u00f3vel" : "Clique para ir at\u00e9 o ponto";
    MM.ax = 1e9; MM.px = 1e9;
  }
  if (now - _linkT > 1000) { _linkT = now; escreveLink(); }
  // O minimapa só se redesenha quando o que ele mostra muda: parado, custa zero. É a
  // mesma guarda dos rótulos de rua, com a fonte trocada conforme o assunto -- lá fora
  // a órbita, aqui dentro o passo de quem anda.
  if (!MM.on) { /* desligado: nada a desenhar */ }
  else if (INT.on) {
    if (FP.pos.x !== MM.px || FP.pos.z !== MM.pz || FP.yaw !== MM.pyaw) {
      MM.px = FP.pos.x; MM.pz = FP.pos.z; MM.pyaw = FP.yaw;
      desenhaPlantaMini();
    }
  } else if (MM.pronto &&
      (target.x !== MM.ax || target.z !== MM.az || sph.theta !== MM.ath || sph.radius !== MM.ar)) {
    MM.ax = target.x; MM.az = target.z; MM.ath = sph.theta; MM.ar = sph.radius;
    desenhaMinimapa();
  }
}

    return v12Frame;
  }
  root.UiFrame = Object.freeze({create});
})(globalThis);
