(() => {
  "use strict";
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Abertura: a planta se forma sozinha, do traço aos ambientes, e para no último quadro.
  const planta = document.querySelector(".abertura-planta");
  const tela = planta.querySelector("canvas");
  const etapas = [...planta.querySelectorAll("[data-etapa]")];
  const marcarEtapa = indice => etapas.forEach((etapa, i) => { etapa.dataset.ativa = String(i === indice); });
  marcarEtapa(2);
  if (!calmo) {
    const total = 81;
    const quadros = Array.from({ length: total }, (_, i) => {
      const imagem = new Image();
      imagem.src = `frames-hero/frame_${String(i + 1).padStart(5, "0")}.webp`;
      return imagem.decode().then(() => imagem);
    });
    Promise.all(quadros).then(imagens => {
      const contexto = tela.getContext("2d");
      planta.dataset.animando = "true";
      const inicio = performance.now();
      const duracao = 3600;
      (function desenhar(agora) {
        const progresso = Math.min(1, (agora - inicio) / duracao);
        contexto.drawImage(imagens[Math.round(progresso * (total - 1))], 0, 0, tela.width, tela.height);
        marcarEtapa(progresso < .33 ? 0 : progresso < .68 ? 1 : 2);
        if (progresso < 1) requestAnimationFrame(desenhar);
      })(inicio);
    }).catch(() => {}); // sem os quadros fica a imagem final, que já está na página
  }

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
    const texto = link.dataset.whatsapp || "Olá! Vi a demonstração da Conecta e quero conversar sobre um imóvel.";
    link.href = `https://wa.me/5516981288075?text=${encodeURIComponent(texto)}`;
  });

  // Vitrine: uma janela só, com a maquete de verdade; as abas trocam o que ela mostra.
  const unidade = encodeURIComponent("vila-aurora/pavimento-modelo-03/final-04");
  const modos = {
    predio: { url: "demo/", dica: "Toque num apartamento verde para ver a ficha. Dois toques seguidos abrem a planta." },
    planta: { url: `demo/?unidade=${unidade}&modo=planta2d`, dica: "Ligue a régua e meça qualquer parede. Dois toques dão zoom." },
    apartamento: { url: `demo/?unidade=${unidade}&modo=planta3d`, dica: "Arraste para girar. “Paredes baixas” mostra o apartamento todo de cima." },
    tour: { url: `demo/?unidade=${unidade}&modo=visita`, dica: "Arraste para olhar em volta e use as setas para caminhar pelos cômodos." },
  };
  const janela = document.querySelector(".janela");
  const quadro = janela.querySelector("iframe");
  const capa = janela.querySelector(".janela-capa");
  const aviso = janela.querySelector(".janela-ativar span");
  const telaCheia = janela.querySelector(".janela-tela-cheia");
  const dica = document.querySelector(".vitrine-dica");
  const abas = [...document.querySelectorAll(".abas [role='tab']")];
  const dialogo = document.querySelector("#maquete");
  const quadroDialogo = dialogo.querySelector("iframe");
  let modo = "predio";

  function endereco() {
    // A maquete reabre a última tela da sessão; a aba Prédio tem que abrir no prédio.
    if (modo === "predio") Object.keys(sessionStorage).filter(chave => chave.startsWith("liv-viewer-v1:")).forEach(chave => sessionStorage.removeItem(chave));
    return modos[modo].url;
  }
  function carregar() {
    if (quadro.getAttribute("src")) return;
    janela.dataset.carregada = "false";
    quadro.src = endereco();
    quadro.addEventListener("load", () => {
      janela.dataset.carregada = "true";
      aviso.textContent = "Clique para mexer na maquete";
    }, { once: true });
  }
  function ativar() {
    carregar();
    janela.dataset.ativa = "true";
  }
  function escolher(novo) {
    modo = novo;
    abas.forEach(aba => aba.setAttribute("aria-selected", String(aba.dataset.modo === novo)));
    capa.src = `assets/telas/${novo}.webp`;
    dica.textContent = modos[novo].dica;
    if (quadro.getAttribute("src")) {
      quadro.removeAttribute("src");
      ativar();
    }
  }
  abas.forEach(aba => aba.addEventListener("click", () => escolher(aba.dataset.modo)));
  // Setas do teclado andam entre as abas, como pede o padrão de abas.
  document.querySelector(".abas").addEventListener("keydown", event => {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!passo) return;
    const atual = abas.findIndex(aba => aba.dataset.modo === modo);
    const proxima = abas[(atual + passo + abas.length) % abas.length];
    proxima.focus();
    escolher(proxima.dataset.modo);
  });

  // Em tela grande carrega sozinha perto da vitrine; no celular só no toque, são dezenas de MB.
  if (matchMedia("(min-width: 1000px) and (pointer: fine)").matches) {
    new IntersectionObserver((entradas, observador) => {
      if (!entradas.some(entrada => entrada.isIntersecting)) return;
      carregar();
      observador.disconnect();
    }, { rootMargin: "60% 0px" }).observe(janela);
  }

  // A capa por cima deixa a página rolar; sem ela a roda do mouse vira zoom da maquete.
  janela.querySelector(".janela-ativar").addEventListener("click", ativar);
  janela.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse" && !document.fullscreenElement) janela.dataset.ativa = "false";
  });
  // No toque não existe "tirar o mouse": tocar fora da janela devolve a rolagem à página.
  document.addEventListener("pointerdown", event => {
    if (!janela.contains(event.target)) janela.dataset.ativa = "false";
  });

  telaCheia.addEventListener("click", () => {
    if (document.fullscreenElement) return void document.exitFullscreen();
    ativar();
    if (janela.requestFullscreen) return void janela.requestFullscreen();
    // iPhone não põe elemento em tela cheia: abre a mesma maquete numa janela por cima.
    quadro.removeAttribute("src");
    janela.dataset.carregada = "false";
    quadroDialogo.src = endereco();
    dialogo.showModal();
  });
  document.addEventListener("fullscreenchange", () => {
    telaCheia.firstChild.textContent = document.fullscreenElement ? "Sair da tela cheia " : "Tela cheia ";
  });
  dialogo.querySelector(".maquete-voltar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", () => { quadroDialogo.src = "about:blank"; });

  document.querySelectorAll("[data-abrir-maquete]").forEach(link => link.addEventListener("click", ativar));
})();
