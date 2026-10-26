import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../fachada/assets/visual.js', import.meta.url), 'utf8');

function pagina(endereco) {
  let url = new URL(endereco);
  const eventosDocumento = {};
  const eventosJanela = {};
  const eventosBotao = {};
  const raiz = { dataset: {} };
  const rotulo = {};
  const cor = {};
  const botao = {
    hidden: true, attrs: {},
    querySelector: () => rotulo,
    setAttribute(nome, valor) { this.attrs[nome] = valor; },
    addEventListener(nome, callback) { eventosBotao[nome] = callback; },
  };
  const links = ['index.html', 'planos.html', 'contato.html?plano=premium#conteudo',
    'privacidade.html#dados', '/painel', '/maquetes/liv/', '#conteudo',
    'https://wa.me/5516981288075?text=Oi', 'https://outro.example/contato.html',
    '/b/liv-ipanema/index.html'].map(href => ({
    href,
    getAttribute() { return this.href; },
    setAttribute(nome, valor) { assert.equal(nome, 'href'); this.href = valor; },
  }));
  const document = {
    documentElement: raiz,
    get baseURI() { return url.href; },
    querySelector: selector => selector === '#alternar-visual' ? botao : cor,
    querySelectorAll: () => links,
    addEventListener(nome, callback) { eventosDocumento[nome] = callback; },
  };
  const window = {
    get location() { return url; },
    history: { replaceState(_estado, _titulo, endereco) { url = new URL(endereco, url); } },
    addEventListener(nome, callback) { eventosJanela[nome] = callback; },
  };
  for (const chave of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, chave, { get() { throw new Error('Não deve armazenar a escolha'); } });
  }
  Object.defineProperty(document, 'cookie', { get() { throw new Error('Não deve usar cookies'); } });
  runInNewContext(script, { document, window, URL, URLSearchParams });
  const inicial = raiz.dataset.visual;
  eventosDocumento.DOMContentLoaded();
  return { raiz, botao, links, cor, rotulo, inicial,
    get url() { return url; },
    alternar() { eventosBotao.click(); },
    voltar(endereco) { url = new URL(endereco); eventosJanela.popstate(); },
  };
}

test('mantém o visual atual como padrão e revela o botão', () => {
  const p = pagina('https://conectaimoveis3d.com.br/');
  assert.equal(p.inicial, 'atual');
  assert.equal(p.botao.hidden, false);
  assert.equal(p.botao.attrs['aria-pressed'], 'false');
  assert.equal(p.rotulo.textContent, 'Experimentar novo visual');
});

test('aplica o novo visual antes de carregar o conteúdo e preserva plano e âncoras', () => {
  const p = pagina('https://conectaimoveis3d.com.br/contato.html?plano=leve&visual=novo');
  assert.equal(p.inicial, 'novo');
  assert.equal(p.raiz.dataset.visual, 'novo');
  assert.equal(p.botao.attrs['aria-pressed'], 'true');
  assert.equal(p.links[2].href, '/contato.html?plano=premium&visual=novo#conteudo');
  assert.equal(p.links[3].href, '/privacidade.html?visual=novo#dados');
  assert.equal(p.cor.content, '#f5f8ff');
});

test('alterna nos dois sentidos sem perder outros parâmetros ou alterar os produtos', () => {
  const p = pagina('https://conectaimoveis3d.com.br/contato.html?plano=premium&origem=site#conteudo');
  const externos = p.links.slice(4).map(link => link.href);
  p.alternar();
  assert.equal(p.url.searchParams.get('visual'), 'novo');
  assert.equal(p.url.searchParams.get('plano'), 'premium');
  assert.equal(p.url.searchParams.get('origem'), 'site');
  assert.equal(p.url.hash, '#conteudo');
  assert.equal(p.rotulo.textContent, 'Voltar ao visual atual');
  assert.deepEqual(p.links.slice(4).map(link => link.href), externos);
  p.alternar();
  assert.equal(p.raiz.dataset.visual, 'atual');
  assert.equal(p.url.searchParams.has('visual'), false);
  assert.equal(p.url.searchParams.get('plano'), 'premium');
  assert.equal(p.links[2].href, '/contato.html?plano=premium#conteudo');
});

test('acompanha o histórico e ignora valores de visual não reconhecidos', () => {
  const p = pagina('https://conectaimoveis3d.com.br/?visual=desconhecido');
  assert.equal(p.raiz.dataset.visual, 'atual');
  p.voltar('https://conectaimoveis3d.com.br/?visual=novo');
  assert.equal(p.raiz.dataset.visual, 'novo');
  p.voltar('https://conectaimoveis3d.com.br/');
  assert.equal(p.raiz.dataset.visual, 'atual');
});
