(() => {
  "use strict";
  const t = window.ConectaI18n?.t || ((texto, params = {}) => texto.replace(/\{(\w+)\}/g,
    (original, chave) => Object.prototype.hasOwnProperty.call(params, chave) ? String(params[chave]) : original));
  const preferencia = matchMedia("(prefers-reduced-motion: reduce)");
  let calmo = preferencia.matches;
  document.body.dataset.pronto = "true";
  // Blocos entram ao aparecer na tela.
  const revelar = new IntersectionObserver(entradas => entradas.forEach(entrada => {
    if (!entrada.isIntersecting) return;
    entrada.target.dataset.visivel = "true";
    revelar.unobserve(entrada.target);
  }), { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll("[data-revelar]").forEach(bloco => revelar.observe(bloco));

  // Menu do celular fecha ao escolher uma seção.
  const menu = document.querySelector(".menu-celular");
  menu.addEventListener("click", event => { if (event.target.closest("a")) menu.open = false; });

  // WhatsApp já abre com a mensagem escrita; a pessoa confere e envia.
  document.querySelectorAll("[data-whatsapp]").forEach(link => {
    const texto = t(link.dataset.whatsapp || "Olá! Vi a demonstração da Conecta e quero conversar sobre um imóvel.");
    link.href = `https://wa.me/5516981288075?text=${encodeURIComponent(texto)}`;
  });

  // Vitrine: uma janela só, com a maquete de verdade; as abas trocam o que ela mostra.
  const unidade = "vila-aurora/pavimento-modelo-03/final-04";
  const modos = {
    predio: { viewer: "maquete", titulo: t("O primeiro olhar é para o todo."), descricao: t("Gire o prédio, veja a luz do sol e descubra os apartamentos disponíveis."), dica: t("Arraste para girar. Ative “Ver disponibilidade” para destacar as unidades disponíveis; dois toques em uma unidade abrem a planta.") },
    planta: { viewer: "planta2d", titulo: t("Entenda cada espaço."), descricao: t("Explore a distribuição dos cômodos e confira as medidas direto na planta."), dica: t("Use a régua para medir uma parede. Aproxime com os controles de zoom ou com dois dedos.") },
    apartamento: { viewer: "planta3d", titulo: t("A planta ganha outra dimensão."), descricao: t("Veja o apartamento mobiliado e como os ambientes se conectam."), dica: t("Arraste para girar. Use “Paredes baixas” para enxergar a distribuição dos ambientes.") },
    tour: { viewer: "visita", titulo: t("Agora, sinta-se em casa."), descricao: t("Entre nos ambientes e veja o imóvel da perspectiva de quem vai morar."), dica: t("Arraste para olhar ao redor. Escolha um ambiente no menu para ir até ele ou use as setas para caminhar.") },
  };
  const janela = document.querySelector(".janela");
  const quadro = janela.querySelector("iframe");
  const capa = janela.querySelector(".janela-capa");
  const ativador = janela.querySelector(".janela-ativar");
  const aviso = ativador.querySelector("span");
  const mensagem = janela.querySelector(".janela-mensagem");
  const repetir = janela.querySelector(".janela-repetir");
  const pausar = janela.querySelector(".janela-pausar");
  const telaCheia = janela.querySelector(".janela-tela-cheia");
  const dica = document.querySelector(".vitrine-dica");
  const abas = [...document.querySelectorAll(".abas [role='tab']")];
  const painel = document.querySelector("#painel-demonstracao");
  const status = document.querySelector(".demo-status");
  const proxima = document.querySelector(".demo-proxima");
  const voltar = janela.querySelector(".maquete-voltar");
  const progresso = document.querySelector(".demo-progresso");
  const preparoTexto = document.querySelector(".demo-preparo-texto");
  const indicadores = [...document.querySelectorAll("[data-preparo]")];
  const nomes = { predio: t("prédio"), planta: t("planta"), apartamento: t("apartamento 3D"), tour: t("tour") };
  const passeio = janela.querySelector(".demo-passeio");
  const passeioEtapa = janela.querySelector(".demo-passeio-etapa");
  const passeioProgresso = janela.querySelector(".demo-passeio-progresso");
  const roteiro = [
    { modo: "predio", duracao: 10000, texto: t("01 / 04 · Conheça o prédio") },
    { modo: "planta", duracao: 10000, texto: t("02 / 04 · Entenda a planta") },
    { modo: "apartamento", duracao: 12000, texto: t("03 / 04 · Veja os ambientes em 3D") },
    { modo: "tour", duracao: 14000, texto: t("04 / 04 · Entre e caminhe até a sala") },
  ];
  const guia = { ativo: false, iniciado: false, completo: false, indice: 0, decorrido: 0, marco: 0, aguardando: false };
  const documentosObservados = new WeakSet();
  let emVista = false;
  let orbitaEncerrada = false;
  let controleOrbitando = null;
  let modo = "predio";
  let pendente = false;
  let aplicando = false;
  let monitor = null;
  let inicioCarga = 0;
  let aguardandoDocumento = false;
  let ocultoDesde = null;
  let preparoIniciado = false;
  let preparoParcial = false;
  let geracao = 0;

  function atualizarGuia() {
    janela.dataset.passeio = guia.ativo ? "ativo" : "pausado";
    passeio.setAttribute("aria-pressed", String(guia.ativo));
    passeio.textContent = t(guia.ativo ? "Pausar passeio" : guia.completo ? "Repetir passeio" : guia.iniciado ? "Continuar passeio" : "Iniciar passeio guiado");
    passeioProgresso.hidden = !guia.iniciado;
    passeioProgresso.max = 1;
    passeioProgresso.value = guia.completo ? 1 : (guia.indice + guia.decorrido / roteiro[guia.indice].duracao) / roteiro.length;
    const texto = guia.completo ? t("Passeio concluído. Agora é com você.") : guia.iniciado ? `${guia.ativo ? "" : t("Pausado · ")}${roteiro[guia.indice].texto}` : t("Explore no seu ritmo ou deixe a gente apresentar.");
    if (passeioEtapa.textContent !== texto) passeioEtapa.textContent = texto;
  }
  function pausarPasseio() {
    if (!guia.ativo) return;
    if (!guia.aguardando) guia.decorrido = Math.min(roteiro[guia.indice].duracao, guia.decorrido + Date.now() - guia.marco);
    guia.ativo = false;
    orbitaEncerrada = true;
    viewer()?.frame?.contentWindow?.__livInterior?.move?.(0, 0);
    atualizarGuia();
    atualizarMovimento(viewer());
  }
  function encerrarPasseio() {
    pausarPasseio();
    Object.assign(guia, { ativo: false, iniciado: false, completo: false, indice: 0, decorrido: 0, aguardando: false });
    atualizarGuia();
  }
  function gestoDoVisitante() {
    orbitaEncerrada = true;
    encerrarPasseio();
    if (controleOrbitando) controleOrbitando.autoRotate = false;
  }
  function observarGestos(documento) {
    if (!documento || documentosObservados.has(documento)) return;
    documentosObservados.add(documento);
    for (const evento of ["pointerdown", "wheel", "keydown"]) documento.addEventListener(evento, gestoDoVisitante, { passive: true });
  }
  function atualizarMovimento(api) {
    const filho = api?.frame?.contentWindow;
    const controles = api?.mode === "maquete" ? filho?.__livProva?.controls : null;
    if (controleOrbitando && controleOrbitando !== controles) controleOrbitando.autoRotate = false;
    controleOrbitando = controles;
    if (controles) {
      controles.autoRotateSpeed = 0.18;
      controles.autoRotate = Boolean(!calmo && emVista && !document.hidden && api.ready && (guia.ativo || !orbitaEncerrada));
    }
    try { observarGestos(quadro.contentDocument); observarGestos(filho?.document); } catch { /* O próximo load tenta novamente. */ }
  }
  function avancarPasseio(api) {
    if (!guia.ativo || !api?.ready || pendente || document.hidden) return;
    const etapa = roteiro[guia.indice];
    if (api.mode !== modos[etapa.modo].viewer) return;
    const agora = Date.now();
    if (guia.aguardando) {
      guia.aguardando = false;
      guia.marco = agora;
      const interior = api.frame?.contentWindow?.__livInterior;
      if (etapa.modo === "apartamento") {
        const paredes = quadro.contentDocument?.querySelector("#hostCutParedes");
        if (paredes) {
          if (paredes.getAttribute("aria-pressed") !== "true") paredes.click();
        } else interior?.setWallCut?.(true);
      }
      if (etapa.modo === "tour") {
        const sala = interior?.getRoomRoutes?.().find(ambiente => ambiente.reachable && /sala/i.test(ambiente.name));
        if (sala) {
          const ambientes = quadro.contentDocument?.querySelector("#hostRoomSelect");
          if (ambientes) ambientes.value = sala.id;
          void Promise.resolve(interior.goToRoom(sala.id, { instant: calmo })).catch(() => {});
        }
      }
    } else {
      guia.decorrido += agora - guia.marco;
      guia.marco = agora;
    }
    if (guia.decorrido >= etapa.duracao) {
      guia.decorrido = 0;
      if (guia.indice === roteiro.length - 1) {
        guia.ativo = false;
        guia.completo = true;
        orbitaEncerrada = true;
      } else {
        guia.indice++;
        guia.aguardando = true;
        escolher(roteiro[guia.indice].modo, true);
      }
    }
    atualizarGuia();
  }

  function visualizacoesProntas(api) {
    const cache = api?.getCacheState?.();
    const cenas = cache?.readyScenes || [];
    const plantas = cache?.plans?.plans || {};
    const interiores = ["interior:canto", "interior:meio"].every(nome => cenas.includes(nome));
    return { predio: cenas.includes("exterior"), planta: Boolean(plantas.canto?.ready && plantas.meio?.ready), apartamento: interiores, tour: interiores };
  }
  function vistaPronta(api, destino) {
    const cache = api?.getCacheState?.();
    if (destino === "predio") return Boolean(cache?.readyScenes?.includes("exterior"));
    const catalogo = api?.units?.units || [];
    const selecionada = catalogo.find(item => item.id === api.selectedUnitId);
    const padrao = catalogo.find(item => item.id === unidade);
    const tipologia = (selecionada?.relation || padrao?.relation)?.typology;
    if (!tipologia) return false;
    return destino === "planta" ? Boolean(cache?.plans?.plans?.[tipologia]?.ready) :
      Boolean(cache?.readyScenes?.includes(`interior:${tipologia}`));
  }
  function atualizarPreparo(api) {
    const prontos = visualizacoesProntas(api);
    const total = Object.values(prontos).filter(Boolean).length;
    document.querySelector(".demo-preparo").hidden = total === 4;
    passeio.disabled = total !== 4;
    progresso.value = total;
    indicadores.forEach(indicador => {
      const pronto = prontos[indicador.dataset.preparo];
      indicador.dataset.pronto = String(pronto);
      indicador.textContent = t(pronto ? "Pronto" : "Preparando");
    });
    preparoTexto.textContent = total === 4 ? t("Tudo pronto. Explore à vontade.") :
      preparoParcial ? t("{total} de 4 experiências prontas. Você já pode explorar as disponíveis.", { total }) :
        t("{total} de 4 experiências prontas. Estamos preparando os ambientes.", { total });
  }
  function preparar(api) {
    atualizarPreparo(api);
    if (preparoIniciado || !api?.units?.units || !api.prepareViews) return;
    preparoIniciado = true;
    const atual = geracao;
    Promise.resolve().then(() => api.prepareViews({ all: true })).then(completo => {
      if (atual === geracao && !aguardandoDocumento && viewer() === api) { preparoParcial = completo === false; atualizarPreparo(api); }
    }).catch(() => { if (atual === geracao && !aguardandoDocumento && viewer() === api) { preparoParcial = true; atualizarPreparo(api); } });
  }

  function apresentar(novo) {
    const mudou = novo !== modo;
    modo = novo;
    document.querySelector(".demo-navegacao").dataset.modo = novo;
    abas.forEach(aba => {
      const selecionada = aba.dataset.modo === novo;
      aba.setAttribute("aria-selected", String(selecionada));
      aba.tabIndex = selecionada ? 0 : -1;
    });
    painel.setAttribute("aria-labelledby", `aba-${novo}`);
    document.querySelector(".demo-titulo").textContent = modos[novo].titulo;
    document.querySelector(".demo-descricao").textContent = modos[novo].descricao;
    const indice = Object.keys(modos).indexOf(novo);
    document.querySelector(".demo-etapa").textContent = t("Etapa {atual} de 4", { atual: indice + 1 });
    proxima.textContent = indice === 3 ? t("Voltar ao prédio") : t("Próximo: {modo}", { modo: nomes[Object.keys(modos)[indice + 1]] });
    janela.dataset.modo = novo;
    capa.src = novo === "planta" ? "demo/plantas2d/meio.jpg?rev=original-20261102" :
      novo === "predio" ? "assets/predio-real.jpg" : "assets/apartamento-real.jpg";
    dica.textContent = modos[novo].dica;
    if (mudou && !calmo) janela.querySelector(".janela-palco").animate?.([{ opacity: .65, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 360, easing: "cubic-bezier(.2,.7,.2,1)" });
    if (janela.dataset.estado === "inicial") aviso.textContent = t("Explorar {modo}", { modo: nomes[novo] });
  }
  function interagir(ativa) {
    if (!ativa) pausarPasseio();
    janela.dataset.ativa = String(ativa);
    quadro.tabIndex = ativa ? 0 : -1;
    quadro.setAttribute("aria-hidden", String(!ativa));
    quadro.inert = !ativa;
    pausar.hidden = !ativa;
    aviso.textContent = t(janela.dataset.estado === "pronta" ? "Continuar explorando" : "Começar a explorar");
  }
  function estado(valor, texto) {
    janela.dataset.estado = valor;
    painel.setAttribute("aria-busy", String(valor === "carregando"));
    status.textContent = t(texto);
    if (valor === "carregando" || valor === "erro") mensagem.textContent = t(texto);
    repetir.hidden = valor !== "erro";
  }
  function falhar() {
    pausarPasseio();
    pendente = false;
    estado("erro", "Não foi possível abrir esta experiência. Tente novamente ou escolha outra etapa.");
    interagir(false);
  }
  function viewer() {
    try { return quadro.contentWindow?.__livViewer; }
    catch { return null; }
  }
  async function conferir() {
    if (pendente && Date.now() - inicioCarga > 120000 && !document.hidden) return falhar();
    if (aguardandoDocumento) return;
    const api = viewer();
    preparar(api);
    atualizarMovimento(api);
    avancarPasseio(api);
    if (aplicando || janela.dataset.estado === "erro") return;
    if (api?.error) return falhar();
    if (!api?.ready) {
      return;
    }
    if (!pendente) {
      const atual = Object.keys(modos).find(chave => modos[chave].viewer === api.mode);
      if (atual && atual !== modo) { encerrarPasseio(); apresentar(atual); }
      return;
    }
    const destino = modos[modo].viewer;
    if (destino !== "maquete") {
      const catalogo = api.units?.units || [];
      const selecionada = catalogo.find(item => item.id === api.selectedUnitId);
      const padrao = catalogo.find(item => item.id === unidade);
      // O prédio fica pronto antes dos vínculos das plantas. Esperamos a associação validada.
      if (!selecionada?.relation && !padrao?.relation) {
        if (api.relationError) falhar();
        return;
      }
      if (!selecionada?.relation && !api.selectUnit(unidade)) return falhar();
    }
    aplicando = true;
    const atual = geracao;
    try {
      if (api.mode !== destino) await api.setMode(destino);
      if (atual !== geracao) return;
      if (api.error) return falhar();
      // Durante a espera a pessoa pode escolher outra etapa; só o último destino vale.
      if (destino !== modos[modo].viewer) return;
      if (!api.ready || api.mode !== destino) return falhar();
      pendente = false;
      estado("pronta", "Ao vivo · explore à vontade");
      interagir(true);
      avancarPasseio(api);
    } catch { if (atual === geracao) falhar(); }
    finally { if (atual === geracao) aplicando = false; }
  }
  function carregar(reiniciar = false) {
    pendente = true;
    inicioCarga = Date.now();
    const pronta = !reiniciar && vistaPronta(viewer(), modo);
    estado(pronta ? "pronta" : "carregando", pronta ? "Ao vivo · explore à vontade" : "Preparando a primeira vista… As outras experiências já estão carregando também.");
    interagir(Boolean(pronta));
    if (reiniciar || !quadro.getAttribute("src")) {
      geracao++;
      aplicando = false;
      // Reinicia apenas a sessão desta demonstração, sem alterar as outras maquetes.
      try { sessionStorage.removeItem(`liv-viewer-v1:${new URL("demo/", location.href).pathname}:entrada:edificio`); }
      catch { /* A experiência também funciona com armazenamento bloqueado. */ }
      aguardandoDocumento = true;
      preparoIniciado = false;
      preparoParcial = false;
      atualizarPreparo(null);
      quadro.src = "demo/?apresentacao=20261103-vagas" + (window.ConectaI18n?.isEnglish ? "&lang=en" : "");
    }
    if (!monitor) monitor = setInterval(() => { void conferir(); }, 250);
    void conferir();
  }
  function ativar() {
    if (janela.dataset.estado === "pronta") interagir(true);
    else carregar();
  }
  function escolher(novo, guiado = false) {
    if (!guiado) { orbitaEncerrada = true; encerrarPasseio(); }
    if (novo === modo) return;
    const reiniciar = janela.dataset.estado === "erro";
    apresentar(novo);
    if (quadro.getAttribute("src")) carregar(reiniciar);
  }
  abas.forEach(aba => aba.addEventListener("click", () => escolher(aba.dataset.modo)));
  // Setas do teclado andam entre as abas, como pede o padrão de abas.
  document.querySelector(".abas").addEventListener("keydown", event => {
    const atual = abas.indexOf(document.activeElement);
    if (atual < 0) return;
    const indices = { ArrowRight: (atual + 1) % abas.length, ArrowLeft: (atual - 1 + abas.length) % abas.length, Home: 0, End: abas.length - 1 };
    if (!(event.key in indices)) return;
    event.preventDefault();
    const seguinte = abas[indices[event.key]];
    seguinte.focus();
    escolher(seguinte.dataset.modo);
  });
  proxima.addEventListener("click", () => {
    const chaves = Object.keys(modos);
    escolher(chaves[(chaves.indexOf(modo) + 1) % chaves.length]);
  });
  ativador.addEventListener("click", ativar);
  passeio.addEventListener("click", () => {
    if (passeio.disabled) return;
    if (guia.ativo) return pausarPasseio();
    if (guia.completo) Object.assign(guia, { completo: false, indice: 0, decorrido: 0 });
    Object.assign(guia, { ativo: true, iniciado: true, aguardando: true, marco: Date.now() });
    escolher(roteiro[guia.indice].modo, true);
    interagir(true);
    atualizarGuia();
    avancarPasseio(viewer());
  });
  pausar.addEventListener("click", () => { interagir(false); ativador.focus({ preventScroll: true }); });
  repetir.addEventListener("click", () => carregar(true));
  document.addEventListener("pointerdown", event => {
    if (!janela.contains(event.target) && !janela.matches(":modal")) interagir(false);
  });

  // O mesmo iframe é ampliado, inclusive no iPhone: a câmera e o apartamento permanecem.
  telaCheia.addEventListener("click", () => {
    janela.close();
    janela.setAttribute("aria-modal", "true");
    janela.showModal();
    voltar.focus({ preventScroll: true });
  });
  voltar.addEventListener("click", () => janela.close());
  janela.addEventListener("close", () => {
    // O evento do close anterior pode chegar depois de showModal().
    if (janela.open) return;
    janela.removeAttribute("aria-modal");
    janela.show();
    telaCheia.focus({ preventScroll: true });
  });
  quadro.addEventListener("load", () => { aguardandoDocumento = false; void conferir(); });
  quadro.addEventListener("error", falhar);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { ocultoDesde = Date.now(); pausarPasseio(); }
    else if (ocultoDesde !== null) {
      inicioCarga += Date.now() - ocultoDesde;
      ocultoDesde = null;
    }
  });
  window.addEventListener("pagehide", () => { pausarPasseio(); if (controleOrbitando) controleOrbitando.autoRotate = false; clearInterval(monitor); monitor = null; preparoIniciado = false; geracao++; aplicando = false; });
  window.addEventListener("pageshow", () => {
    inicioCarga = Date.now();
    if (quadro.getAttribute("src") && !monitor) monitor = setInterval(() => { void conferir(); }, 250);
  });
  new IntersectionObserver(entradas => {
    emVista = entradas.some(entrada => entrada.isIntersecting);
    if (!emVista) pausarPasseio();
    atualizarMovimento(viewer());
  }, { threshold: .2 }).observe(janela);
  preferencia.addEventListener?.("change", () => { calmo = preferencia.matches; atualizarMovimento(viewer()); });
  const linksSecoes = [...document.querySelectorAll(".menu a, .menu-celular nav a")];
  const secaoAtual = new IntersectionObserver(entradas => entradas.forEach(entrada => {
    if (!entrada.isIntersecting) return;
    linksSecoes.forEach(link => {
      if (link.getAttribute("href") === `#${entrada.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }), { rootMargin: "-15% 0px -60% 0px" });
  document.querySelectorAll("main > section[id]").forEach(secao => secaoAtual.observe(secao));
  atualizarGuia();
  apresentar(modo);
  document.querySelectorAll("[data-abrir-maquete]").forEach(link => link.addEventListener("click", ativar));
  carregar();
})();
