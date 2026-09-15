/* Camera lenses: near/far planes per depth-buffer mode and the interior field of view kept horizontal. */
(function(root) {
  "use strict";
  function create({NIVEL}) {
// v9: 2 m de plano proximo e MEIA SALA. Vendo a cidade de cima nada chega tao
// perto e o corte protege a precisao do buffer de profundidade; dentro de casa
// ele apagaria o chao (1,62 m abaixo do olho) e a parede em que se encosta.
//
// Sem o buffer logaritmico (níveis medio/baixo) quem protege a precisao passa a ser a
// RAZAO near/far, e 0,08 contra 40.000 é 500 mil -- z-fighting até no que está perto.
// Duas frouxidoes resolvem sem custo visivel: o near de dentro de casa sobe pra 15 cm
// (ainda abaixo de encostar numa parede, e o chao fica 1,62 m abaixo do olho), e o far
// de dentro de casa cai pra 6 km -- a NEVOA ja fecha em 5.500 m, entao o que foi
// cortado ali era geometria pintada da cor do fundo. Razao final: 40 mil.
const NEAR_CIDADE = 2, NEAR_CASA = NIVEL.logdepth ? 0.08 : 0.15;
const FAR_CIDADE = 40000, FAR_CASA = NIVEL.logdepth ? 40000 : 6000;
// 40 graus e teleobjetiva pra quem esta dentro de uma sala de 4 m: metade do
// comodo fica fora do quadro e o lugar parece um corredor. Interior de
// arquitetura se fotografa com grande-angular, e e o que a vista de dentro usa.
const FOV_CIDADE = 40;
// Dentro de casa o que importa e o campo HORIZONTAL: `camera.fov` do three e o
// vertical, e numa tela de celular em pe (proporcao 0,46) 62 graus verticais viram
// 30 horizontais -- uma luneta apontada pra parede. Aqui o alvo e horizontal e o
// vertical sai da proporcao da tela, entao o enquadramento e o mesmo deitado ou em pe.
// v12: 78 -> 95 graus horizontais a pedido. E a faixa em que interior de arquitetura e
// fotografado de verdade (16-20 mm em full frame da 90-100); abaixo disso uma sala de
// 3,5 m nao cabe no quadro de quem esta dentro dela. O teto de 80 graus VERTICAIS
// continua valendo e e ele que segura a distorcao numa tela em pe.
const FOV_H_CASA = 95, FOV_H_PLANTA = 72;
function fovInterior(planta) {
  const alvo = planta ? FOV_H_PLANTA : FOV_H_CASA;
  // innerWidth/innerHeight, nao camera.aspect: no primeiro quadro depois de entrar o
  // aspect ainda e o do quadro anterior (quem o atualiza e o resize(), dentro do laco),
  // e o campo saia calculado pra uma tela quadrada que nao existe.
  const a = innerWidth / innerHeight;
  const v = 2 * Math.atan(Math.tan(alvo * Math.PI/360) / a) * 180/Math.PI;
  // Teto de 80 graus VERTICAIS: numa tela em pe manter o campo horizontal exigiria 120,
  // e a distorcao de barril fica pior que o enquadramento apertado que ela resolve.
  return Math.max(40, Math.min(80, v));
}

    return {NEAR_CIDADE, NEAR_CASA, FAR_CIDADE, FAR_CASA, FOV_CIDADE, FOV_H_CASA, FOV_H_PLANTA, fovInterior};
  }
  root.CameraLenses = Object.freeze({create});
})(globalThis);
