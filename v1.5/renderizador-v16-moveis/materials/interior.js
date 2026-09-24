/* Interior materials and ceiling shader; textures are supplied by the caller. */
(function(root) {
  "use strict";
  function create({THREE, ambientePBR, texParede, texPiso, texMadeira,
                   nrmParede, nrmPiso, nrmMadeira, rugParede, rugPiso, rugMadeira}) {
// DoubleSide porque o corte deixa ver o interior de qualquer ângulo, e porque o three
// inverte a normal da face de trás sozinho (a laje preta do v7 custou essa lição).
const matInt = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.72,
  metalness:0.02, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:0.28 });
const matVidro = new THREE.MeshStandardMaterial({ color:0xC4D8E6, roughness:0.05,
  metalness:0.08, envMap:ambientePBR, envMapIntensity:1.4, transparent:true,
  opacity:0.17, side:THREE.DoubleSide, depthWrite:false });
// Esquadria pintada (batente, guarnição, folha de porta) e alumínio anodizado (caixilho,
// trilho, puxador). Dois materiais, não vinte: TODA esquadria da unidade sai em três
// malhas -- pintado, metal e vidro -- pelo mesmo motivo que o piso sai em três. Cor por
// vértice, então porta branca e porta de madeira convivem na mesma chamada de desenho.
const matEsq = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.42,
  metalness:0.03, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:0.34 });
const matAlum = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.34,
  metalness:0.86, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:1.05 });

const matParede = new THREE.MeshStandardMaterial({ vertexColors:true, map:texParede,
  normalMap:nrmParede, normalScale:new THREE.Vector2(0.22, 0.22),
  roughnessMap:rugParede, roughness:1.0, metalness:0.0, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.34 });
const matFrio = new THREE.MeshStandardMaterial({ vertexColors:true, map:texPiso,
  normalMap:nrmPiso, normalScale:new THREE.Vector2(0.55, 0.55),
  roughnessMap:rugPiso, roughness:1.0, metalness:0.04, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.55 });
const matMadeira = new THREE.MeshStandardMaterial({ vertexColors:true, map:texMadeira,
  normalMap:nrmMadeira, normalScale:new THREE.Vector2(0.42, 0.42),
  roughnessMap:rugMadeira, roughness:1.0, metalness:0.0, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.34 });

/* ---- o forro so recebe ricochete, e o ricochete e do piso ---------------
   O forro era o plano MAIS SATURADO e um dos mais escuros do comodo -- bege alaranjado
   num apartamento de parede clara. Medido no quadro Sala->Cozinha de Sao Carlos, com a
   luz de teto apagada (que e como o visitante entra):

     forro    (167,143,112)   saturacao 0,329   luminancia 147
     parede   (195,191,183)   saturacao 0,062   luminancia 191

   Nao e o cadastro e nao e o bake: a cor por vertice que o bake deixa no forro e
   (0,912 / 0,903 / 0,876), saturacao 0,04 -- mais NEUTRA e mais CLARA que a da parede.
   A causa e de onde vem a luz. Com `envMapIntensity = 0` o forro cai pra (39,34,27):
   ~85% do que chega nele e a sonda de ambiente, e a metade de baixo da sonda e o piso
   de madeira (saturacao 0,376), com `SONDA_GANHO` dobrando por cima.

   Fisicamente esta certo -- forro sobre piso de madeira PUXA quente. Errada e a
   amplitude: tinta branca com 90% de albedo nao chega a 0,33 de croma.

   O que NAO resolve, medido: subir a hemisferica com chao neutro. Ela conserta o forro
   (0,329 -> 0,168) destruindo justamente o que a v15 conquistou -- faixa 118,9 -> 73,5,
   escuro 3,1% -> 2,1%, croma 0,150 -> 0,086. E o preenchimento falso voltando pela
   janela, e o portao de `mede_interior.py` existe pra barrar isso.

   Entao o conserto e CIRURGICO: tira o croma do ambiente so na face virada pra baixo,
   devolvendo em luz o que sai em cor. Nao toca em parede (normal horizontal), nem em
   piso (normal pra cima), nem na cidade. Medido depois:

     forro    (173,166,157)   saturacao 0,092   luminancia 167
     quadro   media 140,8 -> 142,0   faixa 118,9 -> 119,0   escuro 3,10% -> 3,10%
              croma 0,150 -> 0,137 (piso do portao: 0,09)                            */
const FORRO_NEUTRO = 0.80;   // quanto do croma do ambiente sai da face virada pra baixo
const FORRO_GANHO  = 0.40;   // e quanto de luz volta no lugar
for (const m of [matParede, matFrio, matMadeira, matInt, matEsq]) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_maps>",
      `#include <lights_fragment_maps>
       /* A SONDA E DE UM COMODO SO, E A PAREDE NAO PODE HERDAR A JANELA DELE.
          sondaDeAmbiente roda UMA CubeCamera, no centro do MAIOR comodo, e o cubemap
          vira a luz ambiente da casa inteira. Na DIFUSA isso e direcional -- a
          irradiancia e amostrada na NORMAL --, entao toda parede da unidade que aponta
          pro rumo em que estava a janela daquele comodo recebe luz de janela, inclusive
          num quarto que nao tem janela nenhuma. E o que o usuario viu como "paredes que
          iluminam sem motivo": um degrau chapado entre duas paredes vizinhas, sem
          gradiente e sem fonte no quadro. Medido no wish-castanheiras-58, quarto: a
          lateral saia 1,20 vez a do fundo; com ?sonda=0 ela cai pra 0,84 -- a sonda
          nao acentuava a hierarquia de luz, ela INVERTIA.

          Aqui a irradiancia de toda face VERTICAL vira a media das quatro direcoes
          horizontais: quatro amostras do mip mais borrado, custo desprezivel. A parede
          para de ter rumo predileto e a sonda continua fazendo o que veio fazer -- o
          reflexo especular do piso, que e radiance e nao se toca aqui. Piso e forro
          (normal vertical) ficam de fora. Medido: 1,20 -> 0,85, o mesmo que desligar a
          sonda, sem perder o reflexo.                                               */
       if (abs(geometryNormal.y) < 0.5) {
         vec3 nIso1 = normalize(vec3(geometryNormal.x, 0.0, geometryNormal.z));
         vec3 nIso2 = vec3(-nIso1.z, 0.0, nIso1.x);
         iblIrradiance = 0.25 * (getIBLIrradiance(nIso1) + getIBLIrradiance(-nIso1)
                               + getIBLIrradiance(nIso2) + getIBLIrradiance(-nIso2));
       }
       float vBaixo = clamp(-geometryNormal.y, 0.0, 1.0);
       float lumAmb = dot(iblIrradiance, vec3(0.2126, 0.7152, 0.0722));
       iblIrradiance = mix(iblIrradiance, vec3(lumAmb), vBaixo * ${FORRO_NEUTRO.toFixed(2)})
                     * (1.0 + vBaixo * ${FORRO_GANHO.toFixed(2)});`);
  };
  // Sem chave propria o three reaproveitaria o programa de um material identico SEM o
  // remendo -- mesma licao do `matVia` e do `muro`.
  m.customProgramCacheKey = () => "forro16iso";
}

    return {matInt, matVidro, matEsq, matAlum, matParede, matFrio, matMadeira};
  }
  root.InteriorMaterials = {create};
})(globalThis);
