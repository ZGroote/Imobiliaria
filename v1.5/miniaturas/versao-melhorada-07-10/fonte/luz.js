/* Luz calculada em KTX2: carregamento e decodificação no shader.

   O ARQUIVO é Basis UASTC com supercompressão Zstandard (gerador/codificar_ktx2.mjs). O
   KTX2Loader o transcodifica em Web Workers para o formato que a GPU lê comprimido --
   ASTC 4x4 (iPhone, Android recentes), BC7 (computador), ETC2 (qualquer Android WebGL2) --
   então o atlas ocupa 1 byte por texel na memória de vídeo, e não 4 como o RGBM.

   O CONTEÚDO é irradiância em escala logarítmica, sem alfa (gerador/luz.py):
       t = log2(1 + K·v) / log2(1 + K·R)   ->   v = (2^(t·log2(1 + K·R)) - 1) / K
   A troca no shader é a mesma do padrão anterior (o trecho `lights_fragment_maps`), só
   com essa conta no lugar do `RGB × A × 16` do RGBM. */
import * as THREE from 'three';

/* O KTX2Loader (com ktx-parse e o pool de workers) é um pedaço separado: a primeira
   imagem do prédio não espera por ele. */
let carregador = null;

export function criaCarregadorLuz(ren, caminhoTranscoder) {
  if (!carregador) {
    carregador = import('three/examples/jsm/loaders/KTX2Loader.js').then(({ KTX2Loader }) => {
      const l = new KTX2Loader().setTranscoderPath(caminhoTranscoder).detectSupport(ren);
      // Dois workers bastam para dois atlas; mais seria memória sem ganho.
      l.setWorkerLimit(Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)));
      return l;
    });
  }
  return carregador;
}

/* Carrega um atlas. `comMip` falso descarta os níveis menores ANTES do envio à GPU:
   o perfil "alto" amostra como o padrão aprovado (sem mipmap) e não paga a memória deles. */
export function carregaAtlas(ren, caminhoTranscoder, url, comMip) {
  return criaCarregadorLuz(ren, caminhoTranscoder).then(l => new Promise((ok, falha) => {
    l.load(url, tex => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.channel = 1;
      tex.flipY = false;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.magFilter = THREE.LinearFilter;
      if (!comMip && tex.mipmaps && tex.mipmaps.length > 1) tex.mipmaps.length = 1;
      tex.minFilter = tex.mipmaps && tex.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      tex.anisotropy = 1;
      tex.needsUpdate = true;
      ok(tex);
    }, undefined, falha);
  }));
}

/* Expressão GLSL que devolve a irradiância a partir do texel lido. */
export function decodificaGLSL(meta) {
  const L = Math.log2(1 + meta.k * meta.faixa);
  return `((exp2(lightMapTexel.rgb * ${L.toFixed(6)}) - 1.0) * ${(1 / meta.k).toFixed(8)})`;
}
