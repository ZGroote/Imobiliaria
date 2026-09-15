/* Graphics quality: the level table, the GPU-string guess and the ?q= / saved / guessed precedence. */
(function(root) {
  "use strict";
  function create({document, guarda, QS}) {
const QUAL_NIVEIS = {
  // dpr: teto de resolução. O custo de preenchimento é quadrático nele, então é a
  // alavanca mais forte que existe -- num notebook a 150% de escala o devicePixelRatio
  // é 1,5, e prendê-lo em 1 corta 55% dos pixels sem mudar mais nada.
  // sombraCidade: medindo a cena montada, `castShadow` é FALSE em prédio, muro, árvore
  // e portão -- os únicos objetos que projetam sombra na página inteira são os móveis
  // do interior (seção 12). Ou seja: fora de casa o mapa de sombra do sol está sempre
  // vazio, e ainda assim 956 malhas o amostram por fragmento, com filtro PCF, pra
  // compor exatamente nada. Custou 5% do quadro na GTX 1650, onde sobra preenchimento;
  // numa iGPU, que é onde o problema aparece, é justamente o recurso que falta. Sai nos
  // níveis fracos. Em "alto" fica, porque lá o custo é irrelevante e a sombra volta a
  // valer no dia em que alguma coisa da cidade projetar.
  // ceuTex: largura da textura do ceu de dentro de casa (secao 12). 2.048 px pros
  // 360 graus da volta dao 0,18 grau por texel; em 1.024 a nuvem magnifica e borra.
  // Sao 8 MB de textura contra 2 -- vale onde sobra memoria, nao numa iGPU.
  alto:  { aa:true,  logdepth:true,  dpr:2,    dprMin:1,    somMap:2048, somSuave:true,  sombraCidade:true,  ceuTex:2048 },
  medio: { aa:false, logdepth:false, dpr:1.25, dprMin:0.75, somMap:1536, somSuave:false, sombraCidade:false, ceuTex:1024 },
  baixo: { aa:false, logdepth:false, dpr:1,    dprMin:0.55, somMap:1024, somSuave:false, sombraCidade:false, ceuTex:1024 },
};
function gpuString() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "";
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? (gl.getParameter(d.UNMASKED_RENDERER_WEBGL) || "") : "";
  } catch (e) { return ""; }
}
const GPU = gpuString();
function palpiteNivel() {
  const g = GPU.toLowerCase();
  // Começar leve em telas de toque; a escolha explícita de gráficos continua valendo.
  if (matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) <= 820) return "baixo";
  // Rasterizador de software: nem "baixo" salva, mas é o menos pior.
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return "baixo";
  // iGPU da Intel e a APU antiga da AMD são exatamente o caso que motivou isto.
  if (/intel|uhd graphics|hd graphics|iris|vega \d|radeon r[2-5]\b/.test(g)) return "baixo";
  if (/nvidia|geforce|quadro|radeon rx|apple m\d/.test(g)) return "alto";
  // Sem string de GPU (extensão bloqueada) o número de núcleos é o que sobra.
  if ((navigator.hardwareConcurrency || 4) <= 4) return "baixo";
  return "medio";
}
// Precedência: ?q= manda (é como se testa), depois o que ficou gravado, depois o palpite.
const NIVEL_NOME = QUAL_NIVEIS[QS.get("q")] ? QS.get("q")
                 : QUAL_NIVEIS[guarda.le("mapa3d.qual")] ? guarda.le("mapa3d.qual")
                 : palpiteNivel();
const NIVEL = QUAL_NIVEIS[NIVEL_NOME];

    return {QUAL_NIVEIS, GPU, palpiteNivel, NIVEL_NOME, NIVEL};
  }
  root.GraphicsQuality = Object.freeze({create});
})(globalThis);
