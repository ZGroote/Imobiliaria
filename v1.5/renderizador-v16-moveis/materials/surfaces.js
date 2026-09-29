/* Shared exterior surface materials; geometry and scene ownership stay with callers. */
(function(root) {
  "use strict";
  function create({THREE, K, TEX_CIDADE, GLSL_RUIDO, AP_LUZ = false, AP_ESPEC = false,
                   GRASS_V2 = false}) {
const BLOCO_MURO = `#include <color_fragment>
    {
      // Direcao ao longo do muro, pela derivada da posicao de mundo (ver a nota do
      // material). O 1e-6 evita o normalize de um vetor nulo no pixel degenerado da
      // borda, que sai como NaN e pinta o muro de preto.
      vec3 fn = normalize(cross(dFdx(vMw), dFdy(vMw)) + vec3(1e-8));
      vec2 dir = normalize(vec2(-fn.z, fn.x) + vec2(1e-6));
      float u = dot(vMw.xz, dir);
      // Detalhe de muro e coisa de perto: a 400 m ele so acrescenta ruido, e muro e
      // a malha mais comprida da cena.
      float fadeM = 1.0 - smoothstep(120.0, 420.0, length(vViewPosition));
      // Pilarete a cada 3,2 m -- o vao de bloco de concreto comum. O que se ve nao e
      // o pilar, e a JUNTA de sombra dos dois lados dele.
      float d = abs(fract(u / 3.2) - 0.5);
      float pil = 1.0 - smoothstep(0.045, 0.075, d);
      float junta = (1.0 - smoothstep(0.075, 0.105, d)) * step(0.06, d);
      diffuseColor.rgb *= 1.0 + pil * 0.055 * fadeM;
      diffuseColor.rgb *= 1.0 - junta * 0.11 * fadeM;
      // Fiada: 11 fiadas em 2,2 m de muro, que e o bloco de 19 cm com junta.
      diffuseColor.rgb *= 1.0 - smoothstep(0.10, 0.0, fract(vMv * 11.0)) * 0.07 * fadeM;
      // Capa por cima: quase todo muro termina em concreto, mais claro e mais
      // dessaturado que a pintura -- e e a capa que desenha a linha do muro contra o
      // fundo, do mesmo jeito que a platibanda desenha o predio contra o ceu.
      vec3 cinza = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(cinza, vec3(1.0), 0.24),
                             smoothstep(0.90, 0.97, vMv) * 0.7);
      // Encardido da base: terra, limo e respingo de chuva. Vai ate 30 cm do chao.
      diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.14, vMv)) * 0.20 * fadeM;
      diffuseColor.rgb *= 0.95 + 0.10 * vnoise(vMw.xz * 0.33);
    }`;

    function chao() {
  const matChao = new THREE.MeshBasicMaterial({ vertexColors:true,
    side:THREE.DoubleSide, fog:true });
  matChao.onBeforeCompile = sh => {
    sh.uniforms.uTexChao = { value: TEX_CIDADE.chao };
    const grassPatch = GRASS_V2 ? `
       // V2 lawn: keep NDVI's brown/green classification, but make green lots read
       // like maintained grass from aerial imagery. Shader-only: no geometry,
       // texture payload, request or draw-call increase.
       float greenScore = smoothstep(0.025, 0.115,
         diffuseColor.g - (diffuseColor.r + diffuseColor.b) * 0.5);
       float broad = vnoise(vXZ * 0.0085);
       float fine = vnoise(vXZ * 0.060);
       vec3 lawn = vec3(0.215, 0.385, 0.165);
       lawn *= 0.88 + broad * 0.20 + fine * 0.07;
       float mow = 0.5 + 0.5 * sin((vXZ.x + vXZ.y * 0.31) * 0.39);
       lawn *= 0.965 + mow * 0.035;
       diffuseColor.rgb = mix(diffuseColor.rgb, lawn, greenScore * 0.74);
    ` : "";
    sh.vertexShader = "varying vec2 vXZ;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvXZ = transformed.xz;");
    sh.fragmentShader = "varying vec2 vXZ;\nuniform sampler2D uTexChao;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>",
      `#include <color_fragment>
       float gc = dot(texture2D(uTexChao, vXZ * 0.125).rgb, vec3(0.299,0.587,0.114)) / 0.557;
       float mc = vnoise(vXZ * 0.028) * 0.65 + vnoise(vXZ * 0.11) * 0.35;
       diffuseColor.rgb *= mix(1.0, gc, 0.55) * (1.0 + (mc - 0.5) * 0.30);` + grassPatch);
  };
  // Sem a chave o three reaproveita o programa do MeshBasic cru e o patch nao entra.
  matChao.customProgramCacheKey = () => GRASS_V2 ? "chaoquadra-grass-v2" : "chaoquadra";
      return matChao;
    }
    function muros() {
  const mat = new THREE.MeshPhongMaterial({
      // Muro e alvenaria pintada, mesma familia do reboco da fachada: brilho fraco e
      // LARGO (10). Com `flatShading` cada quad tem uma normal so, entao o realce nao
      // varia DENTRO do painel -- ele acende o muro virado pro sol e deixa o resto
      // quieto, que e o que uma foto mostra. Portado do v15 com a chave.
      vertexColors:true, side:THREE.DoubleSide,
      shininess: (AP_LUZ && AP_ESPEC) ? 10 : 0,
      specular:  (AP_LUZ && AP_ESPEC) ? 0x0B0B0A : 0x000000,
      flatShading:true });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = "attribute float aDetailHidden;\nvarying float vDetailHidden;\nattribute float aMv;\nvarying float vMv;\nvarying vec3 vMw;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvDetailHidden=aDetailHidden;\nvMv=aMv;\nvMw=transformed;");
    sh.fragmentShader = "varying float vDetailHidden;\nvarying float vMv;\nvarying vec3 vMw;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", "if(vDetailHidden>0.5) discard;\n"+BLOCO_MURO);
  };
  // Sem isto o three usaria o texto da funcao como chave e recompilaria: ver a nota
  // do _compilaVia. Aqui e um material so pra cidade inteira, mas a chave e barata.
  mat.customProgramCacheKey = () => "muro-blender-lod";
      return mat;
    }
    function asfalto() {
  const mat = new THREE.MeshBasicMaterial({ color:K.asfaltoPlano, side:THREE.DoubleSide, fog:true });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = "varying vec3 vAsf;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAsf=transformed;");
    sh.fragmentShader = "varying vec3 vAsf;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + (h21(floor(vAsf.xz * 3.7)) - 0.5) * 0.22;
      diffuseColor.rgb *= 0.84 + 0.32 * vnoise(vAsf.xz * 0.085);`);
  };
  mat.customProgramCacheKey = () => "asfalto";
      return mat;
    }
    function fundo() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide, fog:true });
  mat.onBeforeCompile = sh => {
    // Sem isto o fundo e um lencol de cor unica por centenas de metros. Duas oitavas de
    // ruido em espaco de mundo custam quatro senos por fragmento e nenhum byte.
    sh.vertexShader = "varying vec3 vTer;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTer=transformed;");
    sh.fragmentShader = "varying vec3 vTer;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 0.80 + 0.40 * vnoise(vTer.xz * 0.0055);
      diffuseColor.rgb *= 0.92 + 0.16 * vnoise(vTer.xz * 0.034);`);
  };
  mat.customProgramCacheKey = () => "terrenobase";
      return mat;
    }
    return {chao, muros, asfalto, fundo};
  }
  root.SurfaceMaterials = {create};
})(globalThis);
