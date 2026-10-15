// Tour em Gaussian Splatting para o apartamento de meio (experimento de 15/10/2026).
// O Tour do Liv continua cuidando de tudo (setas, arrastar, ambientes, colisão); este módulo só cobre o
// canvas com splat/visita.html, copia a câmera a cada quadro e pausa o desenho da malha enquanto o splat
// estiver à vista. Um splat por cômodo, escolhido pela posição da câmera. ?splat=0 desliga.
const query = new URLSearchParams(location.search);
const st = window.__livInterior;

// Cômodos no espaço do Blender (Z para cima); o three do interior usa (x, z, -y). As mesmas zonas
// separaram as vistas do treino (piloto-render/nuvem/comodos.sh). Fora de todas, volta a malha.
const COMODOS = [
  ["sala",         (x, y) => x < -0.3 && y < 1.25 && !(x > -1.9 && y > -0.26)],
  ["varanda",      (x, y) => x < -1.9 && y >= 1.25],
  ["quarto",       (x, y) => x >= -1.9 && x < 0.35 && y > -0.26],
  ["banho-suite",  (x, y) => x >= 0.9 && x < 2.18 && y > -0.15],
  ["banho-social", (x, y) => x >= -0.1 && x < 2.18 && y < -1.3],
  ["suite",        (x, y) => x >= 2.18],
];

if (st && st.typology === "meio" && query.get("splat") !== "0") {
  const repasse = ["dpr", "std", "fps"].filter(k => query.has(`splat-${k}`)).map(k => `&${k}=${query.get(`splat-${k}`)}`).join("");
  // splat/comodos.json diz quais cômodos têm splat próprio ({"sala": "sala.sog", ...}); sem ele, só a sala.
  const arquivos = await fetch("splat/comodos.json").then(r => r.ok ? r.json() : null).catch(() => null)
    ?? { sala: "sala.sog" };
  let quadro = null, splat = null, ligado = false;

  const esperar = () => new Promise(ok => { const v = () => st.ready ? ok() : setTimeout(v, 100); v(); });
  await esperar();
  const canvas = document.querySelector("#interior-canvas");
  quadro = document.createElement("iframe");
  quadro.title = "Tour do apartamento em Gaussian Splatting";
  quadro.src = `splat/visita.html?arquivo=${encodeURIComponent(arquivos.sala || Object.values(arquivos)[0])}${repasse}`;
  Object.assign(quadro.style, { position: "absolute", border: "0", pointerEvents: "none", visibility: "hidden", background: "#111" });
  quadro.setAttribute("aria-hidden", "true");
  canvas.after(quadro);

  const encaixar = () => {   // mesma caixa do canvas, por baixo dos botões
    Object.assign(quadro.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
      width: `${canvas.offsetWidth}px`, height: `${canvas.offsetHeight}px` });
  };
  new ResizeObserver(encaixar).observe(canvas); encaixar();

  // Enquanto o splat cobre a tela, a malha não precisa ser desenhada; o tick do Tour (movimento) segue.
  const renderer = st.renderer;
  const desenhoOriginal = renderer.renderAsync.bind(renderer);
  renderer.renderAsync = (cena, camera) => ligado ? Promise.resolve() : desenhoOriginal(cena, camera);

  const cam = st.camera;
  // O Tour fixa o ângulo vertical (48°): num painel alto e estreito o horizontal cai para ~29° e parece zoom.
  // Garante 60° na horizontal, abrindo o vertical quando preciso.
  const FOV_BASE = cam.fov, H_MIN = 60 * Math.PI / 180;
  const ajustarFov = () => {
    const vMin = 2 * Math.atan(Math.tan(H_MIN / 2) / cam.aspect) * 180 / Math.PI;
    const fov = st.mode === "visita" ? Math.max(FOV_BASE, vMin) : FOV_BASE;
    if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };
  let comodo = null;
  const laco = () => {
    ajustarFov();
    splat ??= quadro.contentWindow?.__splatVisita;
    const p = cam.position, x = p.x, y = -p.z;
    comodo = COMODOS.find(([nome, dentro]) => arquivos[nome] && dentro(x, y))?.[0] ?? null;
    if (splat && comodo && st.mode === "visita") splat.setArquivo(arquivos[comodo]);   // começa a carregar já
    const querLigar = !!(st.active && st.mode === "visita" && comodo && splat?.ready);
    if (querLigar) { encaixar(); splat.setCamera(p.toArray(), cam.quaternion.toArray(), cam.fov, cam.aspect); }
    if (querLigar !== ligado) {
      ligado = querLigar;
      quadro.style.visibility = ligado ? "visible" : "hidden";
      if (!ligado && st.active) desenhoOriginal(st.scene, cam);   // devolve a malha na mesma posição
    }
    requestAnimationFrame(laco);
  };
  requestAnimationFrame(laco);
  st.splat = { get ligado() { return ligado; }, get comodo() { return comodo; }, quadro };
}
