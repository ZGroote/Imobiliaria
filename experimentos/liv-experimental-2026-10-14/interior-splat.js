// Tour em Gaussian Splatting para o apartamento de meio (experimento de 15/10/2026).
// O Tour do Liv continua cuidando de tudo (setas, arrastar, ambientes, colisão); este módulo só cobre o
// canvas com splat/visita.html, copia a câmera a cada quadro e pausa o desenho da malha enquanto o splat
// estiver à vista. Um splat por cômodo, escolhido pela posição da câmera. ?splat=0 desliga.
const query = new URLSearchParams(location.search);
const st = window.__livInterior;

// Cômodos no espaço do Blender (Z para cima); o three do interior usa (x, z, -y). As mesmas zonas
// separaram as vistas do treino (piloto-render/nuvem/comodos.sh). Fora de todas, volta a malha.
// shortcut: estas zonas reproduzem o treino antigo; migrar os limites junto com os novos splats aprovados.
const COMODOS = [
  ["sala",         (x, y) => x < -0.3 && y < 1.25 && !(x > -1.9 && y > -0.26)],
  ["varanda",      (x, y) => x < -1.9 && y >= 1.25],
  ["quarto",       (x, y) => x >= -1.9 && x < 0.35 && y > -0.26],
  ["banho-suite",  (x, y) => x >= 0.9 && x < 2.18 && y > -0.15],
  ["banho-social", (x, y) => x >= -0.1 && x < 2.18 && y < -1.3],
  ["suite",        (x, y) => x >= 2.18],
];

async function iniciar() {
  const repasse = ["dpr", "std", "fps"].filter(k => query.has(`splat-${k}`)).map(k => `&${k}=${query.get(`splat-${k}`)}`).join("");
  const global = query.get("splat-piloto") === "global";
  const piloto = global || query.get("splat-piloto") === "1";
  // splat/comodos.json diz quais cômodos têm splat próprio ({"sala": "sala.sog", ...}); sem ele, só a sala.
  const manifesto = global ? "splat/comodos-global.json" : piloto ? "splat/comodos-piloto.json" : "splat/comodos.json";
  const dados = await fetch(manifesto).then(r => r.ok ? r.json() : null).catch(() => null);
  if (piloto && !dados) throw new Error("Manifesto do piloto indisponível; mantendo a malha do Tour.");
  const arquivos = dados ?? { sala: "sala.sog" };
  let quadro = null, splat = null, ligado = false;

  const esperar = () => new Promise(ok => { const v = () => st.ready || st.error || st.disposed ? ok() : setTimeout(v, 100); v(); });
  await esperar();
  if (!st.ready || st.disposed) return;
  const canvas = document.querySelector("#interior-canvas");
  quadro = document.createElement("iframe");
  quadro.title = "Tour do apartamento em Gaussian Splatting";
  quadro.src = `splat/visita.html?v=20261015-3&arquivo=${encodeURIComponent(arquivos.sala || Object.values(arquivos)[0])}${repasse}`;
  Object.assign(quadro.style, { position: "absolute", border: "0", pointerEvents: "none", visibility: "hidden", background: "#111" });
  quadro.setAttribute("aria-hidden", "true");
  canvas.after(quadro);

  const encaixar = () => {   // mesma caixa do canvas, por baixo dos botões
    Object.assign(quadro.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
      width: `${canvas.offsetWidth}px`, height: `${canvas.offsetHeight}px` });
  };
  encaixar();

  // Enquanto o splat cobre a tela, a malha não precisa ser desenhada; o tick do Tour (movimento) segue.
  const renderer = st.renderer;
  const renderAsync = renderer.renderAsync;
  const desenhoOriginal = renderAsync.bind(renderer);
  renderer.renderAsync = (cena, camera) => ligado && !splat?.error ? Promise.resolve() : desenhoOriginal(cena, camera);

  const cam = st.camera;
  // O Tour fixa o ângulo vertical (48°): num painel alto e estreito o horizontal cai para ~29° e parece zoom.
  // Garante 60° na horizontal, abrindo o vertical quando preciso.
  const FOV_BASE = cam.fov, H_MIN = 60 * Math.PI / 180;
  const ajustarFov = () => {
    const vMin = 2 * Math.atan(Math.tan(H_MIN / 2) / cam.aspect) * 180 / Math.PI;
    const fov = st.mode === "visita" ? Math.max(FOV_BASE, vMin) : FOV_BASE;
    if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };
  let comodo = null, error = null, proximo = null, ultimoArquivo = null, frame;
  // O ensaio global cobre todo o percurso; não depende dos retângulos aproximados do treino por cômodo.
  const localizar = global ? () => arquivos.apto ? "apto" : null :
    (x, y) => COMODOS.find(([nome, dentro]) => arquivos[nome] && dentro(x, y))?.[0] ?? null;
  const observer = new ResizeObserver(encaixar);
  // O observer de tamanho e a substituição do render pertencem a este módulo.
  const encerrar = () => {
    cancelAnimationFrame(frame); observer.disconnect(); ligado = false;
    renderer.renderAsync = renderAsync; quadro.remove();
  };
  observer.observe(canvas);
  addEventListener("pagehide", encerrar, {once: true});
  const laco = () => {
    if (st.disposed) { encerrar(); return; }
    ajustarFov();
    splat ??= quadro.contentWindow?.__splatVisita;
    const p = cam.position, x = p.x, y = -p.z;
    comodo = localizar(x, y);
    const ativo = !!(st.active && st.mode === "visita" && comodo);
    splat?.setActive?.(ativo);
    if (splat && ativo) {
      try {
        splat.setArquivo(arquivos[comodo]);
        // A câmera chega antes de ready: nunca revela o primeiro quadro na origem do iframe.
        encaixar(); splat.setCamera(p.toArray(), cam.quaternion.toArray(), cam.fov, cam.aspect);
        if (ultimoArquivo !== arquivos[comodo]) { ultimoArquivo = arquivos[comodo]; proximo = null; }
        // Antecipa um vizinho próximo sem desenhar dois splats sobrepostos.
        const vizinho = [[.65,0],[-.65,0],[0,.65],[0,-.65]].map(([dx,dy]) => localizar(x+dx,y+dy))
          .find(nome => nome && nome !== comodo);
        if (vizinho && vizinho !== proximo) { splat.prefetch(arquivos[vizinho]); proximo = vizinho; }
        error = splat.error;
      } catch (falha) { error = String(falha); }
    }
    const querLigar = !!(ativo && splat?.ready && !error);
    if (querLigar !== ligado) {
      ligado = querLigar;
      quadro.style.visibility = ligado ? "visible" : "hidden";
      // O loop original continua e devolve a malha; evita um segundo render concorrente.
    }
    frame = requestAnimationFrame(laco);
  };
  frame = requestAnimationFrame(laco);
  st.splat = { get ligado() { return ligado; }, get comodo() { return comodo; }, quadro,
    getState: () => ({ligado, comodo, error, manifesto, prefetch: proximo, viewer: splat?.getState() || null}) };
}
if (st && st.typology === "meio" && query.get("splat") !== "0") {
  iniciar().catch(error => { st.splat = {ligado: false, getState: () => ({ligado: false, error: String(error)})}; });
}
