/* Carregador da pagina (v2): entra INLINE no HTML, depois do corpo, e e a unica coisa que
   roda antes do mapa.

   A pagina de antes era um arquivo so de 14 MB, com o canvas e a tela de carga perto do
   FIM: no celular fraco ficava 18 s em branco. Agora o HTML leva so cabeca, estilo e
   corpo (a tela de carga aparece na hora), e o resto vem em arquivos com hash no nome,
   que o navegador guarda por um ano:

     - os blocos de dado (`dados/<id>-<hash>.json`), baixados EM PARALELO, com progresso
       real (bytes ja abertos sobre o total aberto, que o manifesto conhece);
     - three, earcut e o programa (`lib/`, `app/`), na ordem.

   Cada bloco baixado vira o mesmo `<script type="application/json" id="__x">` que a pagina
   antiga trazia embutido, entao o programa le os dados sem mudar uma linha.

   Os blocos `tarde` (moveis e luz do apartamento) nao atrasam a abertura: descem depois que
   o mapa ficou pronto, ou na hora em que alguem pede (`MapaDados.promessa`). */
(function () {
  "use strict";
  var M = window.__MANIFESTO;
  var $ = function (id) { return document.getElementById(id); };
  var stK = $("stK"), stM = $("stM"), stI = $("stI");
  var textos = {}, pendentes = {};

  function poeBloco(id, texto) {
    if (document.getElementById(id)) return;
    var s = document.createElement("script");
    s.type = "application/json"; s.id = id; s.textContent = texto;
    document.body.appendChild(s);
  }

  // Baixa um bloco contando os bytes ABERTOS (o navegador entrega o corpo ja sem o
  // Brotli; o Content-Length e do comprimido e nao serve de total).
  function baixa(id, aoAvancar) {
    if (pendentes[id]) return pendentes[id];
    var d = M.dados[id];
    pendentes[id] = fetch(d.url).then(function (r) {
      if (!r.ok) throw new Error(id + ": HTTP " + r.status);
      if (!r.body || !r.body.getReader || !aoAvancar) return r.text();
      var leitor = r.body.getReader(), partes = [], dec = new TextDecoder();
      function passo() {
        return leitor.read().then(function (p) {
          if (p.done) { partes.push(dec.decode()); return partes.join(""); }
          aoAvancar(p.value.length);
          partes.push(dec.decode(p.value, { stream: true }));
          return passo();
        });
      }
      return passo();
    }).then(function (t) { textos[id] = t; return t; });
    return pendentes[id];
  }

  // Para quem precisa de um bloco `tarde`: a promessa resolve quando ele chegar (e o
  // `<script id>` ja estiver no documento).
  window.MapaDados = {
    promessa: function (id) {
      if (!M.dados[id]) return Promise.resolve(null);
      return baixa(id).then(function (t) { poeBloco(id, t); return t; });
    },
    pronto: function (id) { return id in textos || !!document.getElementById(id); },
    tarde: Object.keys(M.dados).filter(function (k) { return M.dados[k].tarde; })
  };

  function scriptEmOrdem(urls) {
    return urls.reduce(function (p, u) {
      return p.then(function () {
        return new Promise(function (ok, erro) {
          var s = document.createElement("script");
          s.src = u; s.async = false;
          s.onload = ok;
          s.onerror = function () { erro(new Error("nao carregou " + u)); };
          document.body.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  var cedo = Object.keys(M.dados).filter(function (k) { return !M.dados[k].tarde; });
  var total = 0, feito = 0;
  cedo.forEach(function (k) { total += M.dados[k].bytes; });
  var aoAvancar = function (n) {
    feito += n;
    var mb = function (b) { return (b / 1048576).toFixed(1).replace(".", ","); };
    if (stM) stM.textContent = mb(feito) + " de " + mb(total) + " MB";
    if (stI) stI.style.width = (4 + 40 * Math.min(1, feito / total)) + "%";
  };
  if (stK) stK.textContent = "Baixando a cidade";

  // three e o programa comecam a descer junto com os dados (preload no HTML); aqui so se
  // garante a ORDEM de execucao: dados no documento, depois three, earcut e o programa.
  Promise.all(cedo.map(function (k) { return baixa(k, aoAvancar); }))
    .then(function () {
      cedo.forEach(function (k) { poeBloco(k, textos[k]); });
      return scriptEmOrdem(M.scripts);
    })
    .then(function () {
      // Os blocos `tarde` descem quando a rede e a CPU sobrarem.
      var depois = window.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
      setTimeout(function () {
        depois(function () { window.MapaDados.tarde.forEach(function (k) { window.MapaDados.promessa(k); }); });
      }, 4000);
    })
    .catch(function (e) {
      console.error(e);
      if (stK) stK.textContent = "Nao consegui carregar o mapa";
      if (stM) stM.textContent = (e && e.message) || "erro de rede";
      if (stI) stI.style.width = "100%";
    });
})();
