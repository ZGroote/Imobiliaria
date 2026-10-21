// MG-1 (tasks/painel/maquete-geral.md §10): o motor da maquete não tem dado de imóvel nenhum. Tudo o que
// é do LIV mora em dados/maquete.js. Este teste segue os módulos que as páginas internas e os módulos de
// entrada carregam e procura, em cada um, o que só pode ser do LIV: nome, tipologias, lados da
// fachada, vistas próprias, caminhos, hashes e medidas do prédio. O prefixo técnico `liv` dos nomes
// internos (__livProva, eventos liv-*, esquemas liv-*-v1) é o nome do motor e fica.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import dados from './dados/maquete.js';

const pasta=new URL('./',import.meta.url);
const ler=nome=>readFileSync(new URL(nome,pasta),'utf8');
const PAGINAS=['interior.html','prova-rgbm.html'];
const ENTRADAS=['viewer.js','renderer.js','interior-renderer.js','mapa-retorno.js'];
// Exceção, dita com clareza: o leitor do estoque é gerado (compilar_estoque.mjs) a partir do modelo de
// estoque do painel (painel/src/lib/estoque-modelo.ts), que ainda descreve só o prédio do LIV
// (salesInventory liv-sales-v1, 170 posições, também nas regras do banco). Generalizar é do painel e
// das regras, num passo próprio; a imobiliária usa a vitrine ao vivo no lugar dele.
const FORA=new Set(['estoque-runtime.js']);

// O grafo de módulos locais, sem o three e sem os dados do imóvel.
function motor(){
  const vistos=new Set(),fila=[...ENTRADAS];
  for(const pagina of PAGINAS)for(const [,src] of ler(pagina).matchAll(/<script[^>]*\ssrc="([^"?]+)/g))fila.push(src);
  while(fila.length){
    const nome=fila.pop().replace(/^\.\//,'');
    if(vistos.has(nome)||nome.startsWith('dados/')||FORA.has(nome))continue;
    vistos.add(nome);
    for(const [,dep] of ler(nome).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\/[^'"?]+)/g))fila.push(dep);
  }
  return [...vistos].sort();
}

const PROIBIDOS=[
  [/ipanema/i,'o nome do empreendimento'],
  [/\bLIV\b/,'o nome do empreendimento'],
  [/['"`](canto|meio)['"`]/,'uma tipologia do LIV'],
  [/['"`](lazer|estacionamento)['"`]/,'um lado da fachada do LIV'],
  [/['"`](varandas|acesso|portaria)['"`]/,'uma vista própria do LIV'],
  [/mapa-liv|maquete-liv|plantas2d\/|site-baseline|assets-prova|modelo\/(entrada|variante)|pavimento-modelo|MAT-entrada-/,'um caminho ou nome do LIV'],
  [/a25114ef|bc846b68|89f552ec/,'um hash de planta ou modelo do LIV'],
  [/\b(48\.45|23\.85|7\.02|6\.35|2\.85|4\.35|3\.02|5\.68)\b/,'uma medida do prédio do LIV'],
  [/[<>]=?\s*16\b/,'o último pavimento do LIV'],
];

test('MG-1: o motor não tem nome, medida, caminho nem número do LIV', () => {
  const modulos=motor();
  assert.ok(modulos.length>15,`só ${modulos.length} módulos: o grafo não foi seguido`);
  const achados=[];
  for(const nome of [...modulos,...PAGINAS])ler(nome).split('\n').forEach((linha,i)=>{
    for(const [padrao,oQue] of PROIBIDOS)if(padrao.test(linha))achados.push(`${nome}:${i+1}: ${oQue}: ${linha.trim().slice(0,100)}`);
  });
  assert.deepEqual(achados,[]);
});

test('MG-1: os dados do LIV têm o que o motor lê', () => {
  assert.equal(dados.schema,'maquete-dados-v1');
  for(const chave of ['nome','nomeCurto','arquivo','pagina','mapa','edicoes','edicaoPadrao','edicaoDaMaquete','predio','unidades','lados',
    'tipologias','vistasDaCena','vistasExtras','vistaDoPavimento','vistaDaFachada'])assert.ok(chave in dados,chave);
  assert.ok(dados.edicoes[dados.edicaoPadrao]&&dados.edicoes[dados.edicaoDaMaquete]);
  for(const t of Object.values(dados.tipologias))assert.match(t.planSHA256,/^[a-f0-9]{64}$/);
});
