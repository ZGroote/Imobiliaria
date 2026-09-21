/* City day/night lighting; interior lighting keeps precedence. */
(function(root) {
  "use strict";
  function create({THREE, NOITE, renderer, sun, hemi, scene, INT, CEU, uNoite,
                   sujaSombra, guarda, frameLoop, el:$}) {
function guardaDia() {
  if (NOITE.dia) return;
  NOITE.dia = { exp: renderer.toneMappingExposure,
                sol: sun.intensity, solCor: sun.color.getHex(),
                hemi: hemi.intensity, ceu: hemi.color.getHex(), chao: hemi.groundColor.getHex(),
                fog: scene.fog.color.getHex(), fundo: renderer.getClearColor(new THREE.Color()).getHex() };
}
function aplicaNoite() {
  if (INT.on) return;         // dentro de casa a iluminação é outra (ver interiorFrame)
  guardaDia();
  const d = NOITE.dia, k = NOITE.t;
  // Exposição é a alavanca: pega prédio (Phong), chão, rua e terreno de fundo
  // (MeshBasic, sem luz nenhuma) na mesma conta. 1,18 -> 0,40 é o que põe o asfalto
  // em luminância de noite sem apagar a silhueta.
  renderer.toneMappingExposure = d.exp * (1 - k) + 0.40 * k;
  sun.intensity = d.sol * (1 - k) + d.sol * 0.16 * k;
  sun.color.setHex(d.solCor).lerp(new THREE.Color(0x8FA8DA), k);
  hemi.intensity = d.hemi * (1 - k) + d.hemi * 0.30 * k;
  hemi.color.setHex(d.ceu).lerp(new THREE.Color(0x2A3A5C), k);
  hemi.groundColor.setHex(d.chao).lerp(new THREE.Color(0x0A0E14), k);
  const noiteCor = new THREE.Color(0x0C1622);
  scene.fog.color.setHex(d.fog).lerp(noiteCor, k);
  renderer.setClearColor(new THREE.Color(d.fundo).lerp(noiteCor, k), 1);
  // A cupula tem toneMapped:false -- a exposicao, que e a alavanca de tudo o mais aqui,
  // nao chega nela. Quem escurece o ceu e a COR do material, que multiplica a textura.
  if (CEU) CEU.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x0E1726), k);
  uNoite.value = k;
  sujaSombra();
}
function setNoite(on, jaVai) {
  NOITE.on = on;
  if (jaVai) NOITE.t = on ? 1 : 0;
  const b = $("tNoite");
  if (b) b.setAttribute("aria-pressed", String(on));
  guarda.grava("mapa3d.noite", on ? "1" : "0");
  aplicaNoite(); frameLoop();
}

    return {aplicaNoite, setNoite};
  }
  root.DayNight = Object.freeze({create});
})(globalThis);
