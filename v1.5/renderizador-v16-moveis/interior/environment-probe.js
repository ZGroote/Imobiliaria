/* Captura de reflexos do interior; os materiais de base pertencem à composição. */
(function(root) {
  "use strict";
  function create({THREE, renderer, scene, INT, OLHO, QS, ambientePBR, MATS_INT}) {
/* ---- sonda de ambiente: o comodo refletindo a si mesmo ------------------
   O `ambientePBR` acima e um DEGRADE, e degrade nao lê como reflexo: todo ponto da
   parede ve a mesma coisa em toda direcao, o que o olho interpreta como cor, nao
   como reflexo. O porcelanato tem `roughness 0,20` e `envMapIntensity 0,55` -- ele
   ja esta refletindo o tempo todo; so que reflete um degrade cinza.

   Aqui ele passa a refletir o COMODO. Uma `CubeCamera` renderiza a cena de dentro
   uma vez, na entrada, e o PMREM pre-filtra pro mesmo formato que o degrade tinha.
   Custa SEIS renders de 128 px uma vez por unidade -- nao por quadro -- e zero
   chamada de desenho a mais depois disso.

   Tres coisas que dao errado em silencio:

   1. TONEMAPPER. O ACES roda na saida de todo material, inclusive quando se renderiza
      pra um alvo. Um envMap ja tonemapeado passa pelo ACES DE NOVO na tela: o
      meio-tom sobe e o reflexo lava. Por isso o `NoToneMapping` em volta da sonda.
   2. HORA DE RODAR. Antes de `aplicaFuro()` a casca do predio ainda esta inteira, e
      a sonda captura a fachada por dentro no lugar da cidade pela janela -- reflexo
      de uma parede que o morador nao ve.
   3. MATERIAL CLONADO. Com atlas do Unreal, `comLuz()` CLONA os tres materiais base,
      e o clone nasce com o envMap antigo. Por isso a troca varre `INT.raiz` alem da
      lista de materiais compartilhados.                                            */
// `?sonda=0` devolve o degrade. Existe pelo mesmo motivo que `?bake=0`: sem um
// A/B na MESMA pagina, medir se a sonda melhorou exige dois builds.
const SONDA_OFF = QS.get("sonda") === "0";
/* O PREENCHIMENTO FALSO CAI PELA METADE, e a sonda dobra pra repor.

   A hemisferica, a ambiente e as tres pontuais de teto existiam pra FINGIR a luz
   indireta, numa epoca em que nada media indireta nenhuma. Com a sonda elas passam a
   contar a mesma luz duas vezes -- e o sintoma disso e o quadro nao ter PRETO em
   lugar nenhum: medido na foto Cozinha->Sala, 0,00% de pixel abaixo de 70 no
   apartamento inteiro.

   Os dois numeros saem de uma varredura contra a foto do Unreal como alvo
   (`pipeline/compara_ue.py`). Cortar preenchimento SEM subir o ganho so escurece,
   porque o bake em JS e um GANHO sobre o albedo e nao repoe energia: fill 0,25
   sozinho leva a media pra 77,9, fora do portao (105 a 168). Com o ganho junto:

     original            media 146,2   faixa  64,1   croma 0,084
     so a sonda          media 147,6   faixa  82,0   croma 0,129
     0,5 / 2 (este)      media 148,2   faixa  90,4   croma 0,136
     0,5 / 3             media 168,7   faixa  78,2   croma 0,118
     Unreal (alvo)       media 142,1   faixa 156,8   croma 0,120

   Media parada de proposito: se ela subisse, "melhorou" seria so "clareou".        */
const SONDA_GANHO = 2;
let SONDA = null;               // { rt, tex } enquanto houver unidade aberta

function poeAmbiente(tex) {
  // O `envMapIntensity` de cada material foi calibrado contra o DEGRADE, que e
  // escuro e chapado. A sonda e ambiente de verdade -- cubemap pre-filtrado
  // alimenta o termo DIFUSO do MeshStandardMaterial, nao so o especular -- entao
  // ela pode assumir o papel que a hemisferica e a pontual de teto faziam de
  // mentira. Sem subir o ganho junto, cortar o preenchimento so escurece: medido,
  // fill 0,25 leva a media pra 77,9, fora do portao (105 a 168).
  const toca = m => {
    /* v16: SO material PBR, e a diferenca nao e de gosto -- e de SIGNIFICADO do slot.
       `envMap` existe tambem em MeshBasic e MeshPhong, e la ele nao e irradiancia: e
       MULTIPLICADOR da cor (`combine` = MultiplyOperation, `reflectivity` = 1). O mapa
       da sonda e CubeUV (PMREM, `mapping` 306), formato que o caminho nao-PBR nao sabe
       amostrar -- e o produto sai ZERO.

       Quem caiu nisso foi o PLAFOM da secao 12d, que e MeshBasic de proposito (luminaria
       acesa e fonte, nao superficie iluminada). Medido no pixel do centro da calota:

         com o envMap da sonda      (0,0,0) apagado  E  (0,0,0) aceso
         sem ele                    (176,173,168)    E  (255,251,242)

       Ou seja: desde que a sonda entrou, a luminaria era um buraco preto no forro em
       todo comodo, e acender a luz nao mudava a propria luminaria -- o unico retorno
       visual que o interruptor tem. `?sonda=0` nao tinha o defeito, que e o A/B que
       fecha o diagnostico.                                                          */
    if (!m || !m.isMeshStandardMaterial) return;
    if (m._envBase === undefined) m._envBase = m.envMapIntensity;
    m.envMap = tex;
    m.envMapIntensity = m._envBase * (tex === ambientePBR ? 1 : SONDA_GANHO);
    m.needsUpdate = true;
  };
  for (const m of MATS_INT) toca(m);
  if (INT.raiz) INT.raiz.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(toca);
  });
}

function sondaDeAmbiente(pl) {
  soltaSonda();
  if (SONDA_OFF) return;
  const c = pl.comodos[0];                     // o maior comodo; ja vem ordenado
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.08, 400, rt);
  cam.position.set(c.cx, INT.baseY + OLHO, c.cz);
  scene.add(cam);
  const tm = renderer.toneMapping, ex = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
  try { cam.update(renderer, scene); }
  finally { renderer.toneMapping = tm; renderer.toneMappingExposure = ex; scene.remove(cam); }
  const pm = new THREE.PMREMGenerator(renderer);
  const alvo = pm.fromCubemap(rt.texture);
  pm.dispose();
  SONDA = { rt, tex: alvo.texture };
  poeAmbiente(alvo.texture);
}

function soltaSonda() {
  if (!SONDA) return;
  poeAmbiente(ambientePBR);
  SONDA.tex.dispose(); SONDA.rt.dispose();
  SONDA = null;
}

    return {sondaDeAmbiente, soltaSonda};
  }
  root.InteriorEnvironmentProbe = Object.freeze({create});
})(globalThis);
