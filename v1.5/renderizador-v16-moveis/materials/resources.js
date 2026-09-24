/* Shared material resources; parsing the embedded payload remains with the app. */
(function(root) {
  "use strict";
/* O ruido e o mesmo dos dois materiais: hash por celula pro agregado do asfalto
   (uma chamada de sin) e um valor suavizado pra mancha grande (quatro). Foi medido
   contra a alternativa obvia -- textura de imagem em canvas -- e ganha em tudo que
   importa aqui: 0 byte na pagina, 0 uv por vertice, e nenhum problema de costura
   entre malhas de quarteiroes vizinhos, que uma textura repetida em espaco de mundo
   teria nas bordas. */
const GLSL_RUIDO = `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x),
               mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y);
  }
`;
// A quebra de linha antes da crase NAO e enfeite: o shader do three comeca com
// `#define PHONG`, e sem ela a concatenacao produz "}#define PHONG" -- diretiva no
// meio da linha, que o GLSL recusa com "'#' : invalid character".

  function cityTextures({THREE, ImageClass, data, maxAnisotropy}) {
  const carrega = uri => {
    if (!uri) return null;
    const im = new ImageClass();
    const t = new THREE.Texture(im);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // NoColorSpace de proposito: a amostragem aqui e `texture2D` na mao, fora do
    // caminho `map` do three, entao a conversao sRGB->linear que ele injeta nao
    // acontece. Usada como RAZAO em torno da media (e nao como cor), a textura
    // fica no mesmo espaco dos dois lados e a conta se cancela.
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = Math.min(4, maxAnisotropy);
    // `needsUpdate` SO depois do onload: setar antes envia uma imagem de 0x0 pra GPU
    // e a textura fica preta pro resto da sessao, sem erro no console.
    im.onload = () => { t.needsUpdate = true; };
    im.src = uri;
    return t;
  };
  return { reboco: carrega(data.reboco), tijolo: carrega(data.tijolo),
           chao: carrega(data.chao) };
  }
  root.MaterialResources = {GLSL_RUIDO, cityTextures};
})(globalThis);
