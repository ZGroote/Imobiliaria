/* A escolha acompanha os links do institucional, sem cookies ou armazenamento. */
(() => {
  const raiz = document.documentElement;
  const paginas = new Set(['index.html', 'planos.html', 'contato.html', 'termos.html', 'privacidade.html', 'cookies.html', '404.html']);
  const novoNaUrl = () => new URLSearchParams(window.location.search).get('visual') === 'novo';
  raiz.dataset.visual = novoNaUrl() ? 'novo' : 'atual';

  document.addEventListener('DOMContentLoaded', () => {
    const botao = document.querySelector('#alternar-visual');
    if (!botao) return;
    const rotulo = botao.querySelector('[data-rotulo-visual]');
    const atualizar = (novo) => {
      raiz.dataset.visual = novo ? 'novo' : 'atual';
      botao.setAttribute('aria-pressed', String(novo));
      rotulo.textContent = novo ? 'Voltar ao visual atual' : 'Experimentar novo visual';
      document.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) return;
        const url = new URL(href, document.baseURI);
        if (url.origin !== window.location.origin || (url.pathname !== '/' && !paginas.has(url.pathname.slice(1)))) return;
        if (novo) url.searchParams.set('visual', 'novo');
        else url.searchParams.delete('visual');
        link.setAttribute('href', url.pathname + url.search + url.hash);
      });
      const cor = document.querySelector('meta[name="theme-color"]');
      if (cor) cor.content = novo ? '#f5f8ff' : '#173f35';
    };
    atualizar(novoNaUrl());
    botao.hidden = false;
    botao.addEventListener('click', () => {
      const novo = raiz.dataset.visual !== 'novo';
      const url = new URL(window.location.href);
      if (novo) url.searchParams.set('visual', 'novo');
      else url.searchParams.delete('visual');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      atualizar(novo);
    });
    window.addEventListener('popstate', () => atualizar(novoNaUrl()));
  });
})();
