/* Road-strip materials: preserve palette, feature flags and shader cache keys. */
(function(root) {
  "use strict";
  function create({THREE, AP_RUA, K, GLSL_RUIDO}) {
/* O que a `rua_foto` mexe DENTRO do shader. Vai interpolado no fonte, e nao como
   uniform, por dois motivos: e constante pra pagina inteira (a chave e da cidade, nao
   da via), e assim o compilador do GLSL apaga o ramo que sobra em vez de o ramo viajar
   ate a placa de video. `toFixed(2)` nao e enfeite -- "0" solto e int em GLSL e o
   `step(0, base)` nao compila. */
const RUA_MANCHA = (AP_RUA ? 0.16 : 0.42).toFixed(2);
// A trama de 0,62 m e o agregado visto de perto. De cima ela e sub-pixel e vira
// chuvisco: na foto aerea o asfalto e liso, e so a mancha larga sobrevive.
const RUA_TRAMA = (AP_RUA ? 0.10 : 0.20).toFixed(2);
// Meia-pista minima pra via TER faixa central. Zero = todas, que era o desenho ate
// aqui. Na foto a rua de bairro (7,5 m, meia-pista 3,75) nao tem faixa nenhuma, e
// pintar todas era o que fazia o bairro inteiro parecer avenida.
const RUA_EIXO_MIN = (AP_RUA ? 4.5 : 0.0).toFixed(2);
// A divisoria de faixa de ROLAMENTO so existe na `rua_foto`: e ela, e nao a do eixo,
// que a foto mostra na avenida -- que tem duas faixas por sentido. Sai do mesmo u/v da
// faixa central, entao continua custando zero chamada de desenho.
const RUA_ROLAMENTO = AP_RUA ? `
        float rol = step(5.0, base) * smoothstep(0.18, 0.11, abs(abs(v) - base*0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPintura, rol * trac * medio * 0.90);
` : "";

/* Uma funcao SO, compartilhada por todos os materiais de fita. O three usa
   `onBeforeCompile.toString()` como chave de cache de programa: closure nova por
   quarteirao (que e o que a `facadeMaterial` faz, porque precisa capturar o uniform
   da animacao) recompilaria o shader a cada quadra que entra na visao. */
function _compilaVia(sh) {
  sh.vertexShader = "attribute vec3 aVia;\nattribute float aViaSurface;\nvarying float vViaSurface;\nvarying vec3 vVia;\n" +
    sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvVia=aVia;\nvViaSurface=aViaSurface;");
  sh.fragmentShader = "varying vec3 vVia;\nvarying float vViaSurface;\nuniform float uCalcada;\nuniform vec3 uPintura;\nuniform vec3 uEixo;\n" +
    GLSL_RUIDO +
    sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
    {
      float u = vVia.x, v = vVia.y, base = max(vVia.z, 0.5);
      float d2 = length(vViewPosition);
      // Duas distancias, nao uma. O GRAO pode sumir cedo (a 90 m ja e menor que o
      // pixel, e ruido sub-pixel vira cintilacao quando a camera anda). A JUNTA da
      // calcada tem periodo de ~1 m e precisa sumir antes de virar moire, mas depois
      // do grao. Uma so das duas fazia a rua cintilar ou a calcada vibrar.
      float perto = 1.0 - smoothstep(70.0, 230.0, d2);
      float medio = 1.0 - smoothstep(260.0, 780.0, d2);

      // mancha larga: remendo, recapeamento, sombra de idade. E a unica que sobrevive
      // de longe, e e ela que tira o aspecto de papel na vista de cima.
      float mancha = vnoise(vec2(u, v) * 0.075) - 0.5;
      float trama  = vnoise(vec2(u, v) * 0.62) - 0.5;
      float grao   = h21(floor(vec2(u, v) * 9.0)) - 0.5;
      diffuseColor.rgb *= 1.0 + mancha * ${RUA_MANCHA} + trama * ${RUA_TRAMA} * medio + grao * 0.30 * perto;

      if (uCalcada > 0.5) {
        float d = abs(v);
        // junta de placa: transversal a cada 1,15 m, longitudinal a cada 0,95 m --
        // medidas a partir do MEIO-FIO, nao do eixo da rua, senao a fiada anda
        // conforme a largura da via.
        float jl = smoothstep(0.06, 0.0, abs(fract(u/1.15) - 0.5) - 0.46);
        float jt = smoothstep(0.06, 0.0, abs(fract((d - base)/0.95) - 0.5) - 0.46);
        diffuseColor.rgb *= 1.0 - (jl + jt) * 0.20 * medio * (1.0-step(0.5,vViaSurface));
        // meio-fio: faixa clara de concreto na divisa com o asfalto
        float mf = smoothstep(0.34, 0.06, abs(d - base));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.045, mf * medio);
        // Concrete riser and recessed gutter read as different planes even when
        // city shadow maps are off. This complements actual geometry and normals.
        if(vViaSurface>1.5 && vViaSurface<2.5) diffuseColor.rgb*=0.58;
        else if(vViaSurface>0.5 && vViaSurface<1.5) diffuseColor.rgb*=0.78;
      } else {
        // rodado: as duas faixas de pneu, mais escuras e mais lisas que o resto
        float rodado = smoothstep(0.75, 0.0, abs(abs(v) - base*0.52));
        diffuseColor.rgb *= 1.0 - rodado * 0.13 * medio;
        // borda gasta: o asfalto encardido junto da sarjeta
        diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.9, base - abs(v));
        // faixa de bordo continua, so em via larga -- rua de bairro nao tem, e
        // pintar todas fazia o bairro inteiro parecer rodovia
        float bordo = step(5.0, base) * smoothstep(0.13, 0.02, abs(abs(v) - (base - 0.45)));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPintura, bordo * 0.55 * medio);
        // v12: FAIXA CENTRAL TRACEJADA, em toda via. Sai daqui e nao de geometria: a
        // fita ja carrega u (ao longo do eixo) e v (transversal), entao a faixa custa
        // zero chamada de desenho e continua existindo no nivel de grafico baixo --
        // a malha de tracejado que ela substitui era uma chamada por quarteirao e
        // sumia no nivel baixo. Medidas dela: 0,32 m de largura, 3,5 m pintados a
        // cada 7 m, que sao as mesmas da malha antiga.
        // (crase em comentario de GLSL fecha o template literal do JS -- nao usar.)
        float eixo = smoothstep(0.19, 0.13, abs(v)) * step(${RUA_EIXO_MIN}, base);
        float trac = step(fract(u / 7.0), 0.50);
        diffuseColor.rgb = mix(diffuseColor.rgb, uEixo, eixo * trac * medio);
${RUA_ROLAMENTO}      }
    }`);
}

function matVia(cor, mul, calcada) {
  const m = new THREE.MeshPhongMaterial({ color:cor, shininess:0, specular:0x000000,
    polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uCalcada = { value: calcada ? 1 : 0 };
    // A tinta continua morando na paleta (K.mark), nao num literal dentro do GLSL.
    // THREE.Color converte o hex de sRGB pro espaco linear de trabalho, que e onde o
    // `diffuseColor` vive neste ponto do shader -- por isso vai como Color, nao como
    // tres numeros escritos a mao.
    sh.uniforms.uPintura = { value: new THREE.Color(K.mark) };
    // Duas tintas: a do eixo e a de rolamento. Sem `rua_foto` as duas sao a mesma cor,
    // que e o desenho que as outras cidades ja tinham.
    sh.uniforms.uEixo = { value: new THREE.Color(K.markEixo) };
    _compilaVia(sh);
  };
  // Sem isto o three usa `onBeforeCompile.toString()` como chave -- igual pros dois
  // materiais -- e calcada e pista compartilhariam o programa com o uniform errado.
  m.customProgramCacheKey = () => "via" + (calcada ? "c" : "p");
  return m;
}

    return {matVia};
  }
  root.RoadMaterials = {create};
})(globalThis);
