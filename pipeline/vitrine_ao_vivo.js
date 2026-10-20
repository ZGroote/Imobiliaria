/* Imovel ao vivo: o painel liga e desliga o imovel do ar e muda preco e situacao sem build
   novo nem deploy. Le vitrine/<slug> no Firestore pela REST (sem SDK: a regra deixa o `get`
   publico). Entra inteiro, como texto, no ponteiro /imovel/<id> (publicar_imovel.py) e no
   tour e na maquete de cada build (build_imovel.py).

   Sem documento ou sem resposta, a pagina fica como foi montada: "fora do ar" e escolha
   comercial, nao trava de seguranca. Quem sabe o endereco /b/<id>/<build>/ de um build
   antigo, anterior a este script, ainda o abre. */
var VITRINE_URL = 'https://firestore.googleapis.com/v1/projects/imobilaria-deccb/databases/(default)/documents/vitrine/';
var VITRINE_ROTULO = { reservado: 'Reservado', vendido: 'Vendido', alugado: 'Alugado' };

// O documento da REST ({fields: {online: {booleanValue}, ...}}) vira {online, situacao, precoCentavos}.
function lerVitrine(j) {
  var f = j && j.fields;
  if (!f) return null;
  var preco = f.precoCentavos && f.precoCentavos.integerValue;
  return {
    online: !(f.online && f.online.booleanValue === false),
    situacao: (f.situacao && f.situacao.stringValue) || 'disponivel',
    precoCentavos: preco === undefined ? null : Number(preco)
  };
}

// O que vai no lugar do preco montado; null mantem o montado.
function textoDoPreco(v, montado) {
  if (VITRINE_ROTULO[v.situacao]) return VITRINE_ROTULO[v.situacao];
  if (v.precoCentavos === null) return null;
  var reais = (v.precoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return reais + (/\/m[eê]s\s*$/.test(montado || '') ? '/mês' : '');
}

function vitrineAoVivo(slug, irPara) {
  var feito = false;
  function quandoPronto(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  function foraDoAr() {
    quandoPronto(function () {
      var d = document.createElement('div');
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;'
        + 'justify-content:center;padding:24px;background:#171e27;color:#eef3f7;'
        + 'font:16px/1.5 system-ui,sans-serif;text-align:center';
      d.textContent = 'Este imóvel não está no ar no momento.';
      document.body.appendChild(d);
    });
  }
  // A ficha do tour se redesenha a cada abertura (listings/sheet.js); a da maquete, uma vez.
  function aplicar(v) {
    function troca(no) {
      if (!no) return;
      var novo = textoDoPreco(v, no.nodeValue);
      if (novo !== null && no.nodeValue !== novo) no.nodeValue = novo;
    }
    function tour() {
      var b = document.querySelector('#uStats > div:first-child > b');
      if (b && b.parentNode.firstChild.nodeValue === 'Preço') troca(b.firstChild);
    }
    function maquete() {
      var p = document.getElementById('fPreco');
      if (p && p.lastChild && p.lastChild.nodeType === 3) troca(p.lastChild);
    }
    tour();
    maquete();
    var stats = document.getElementById('uStats');
    if (stats && window.MutationObserver) new MutationObserver(tour).observe(stats, { childList: true });
  }
  function seguir(v) {
    if (feito) return;
    feito = true;
    if (v && !v.online) return foraDoAr();
    if (irPara) return location.replace(irPara + location.search + location.hash);
    if (v) quandoPronto(function () { aplicar(v); });
  }
  // O ponteiro nao segura a pessoa: sem resposta em 4 s, segue para o build.
  if (irPara) setTimeout(function () { seguir(null); }, 4000);
  fetch(VITRINE_URL + slug).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { seguir(lerVitrine(j)); }, function () { seguir(null); });
}
