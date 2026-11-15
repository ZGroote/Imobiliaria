// Executa as expressões reais do painel atual; dispensa Chrome.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../../visual/index.html'), 'utf8');
const declarations = ['numero', 'numeroPreciso', 'finito', 'formatar'].map(name => {
  const m = source.match(new RegExp('^    const ' + name + ' = .*$', 'm'));
  assert(m, name);
  return m[0];
}).join('\n');
const campos = source.match(/^    const campos = \[[\s\S]*?^    \];/m);
const linhas = source.split('\n').filter(l => /linha\(destaques, '(Unidades estimadas|Área privativa|Vagas)'/.test(l)
  || l.includes('for (const [key, label, unit] of campos) linha('));
assert(campos && linhas.length === 4);
const painel = vm.runInNewContext(declarations + '\n' + campos[0]
  + '\n(m) => { const out = {}, dl = {}, destaques = {}; const linha = (_, nome, valor) => out[nome] = valor;\n'
  + linhas.join('\n') + '\nreturn out; }');
const normalizar = t => Number(t.replaceAll('.', '').replace(',', '.').replace(/[^\d.+-]/g, ''));
assert.equal(normalizar('2,081'), 2.081);
const checks = [];
for (const op of JSON.parse(fs.readFileSync(path.join(__dirname, 'evidencias/metricas-relatorio.json'), 'utf8'))) {
  const tela = painel(op.json);
  for (const [campo,label,fator] of [
    ['unidades_estimadas','Unidades estimadas',1], ['area_privativa_m2','Área privativa',1],
    ['ca_usado','CA utilizado',1], ['to_usada','Taxa de ocupação',100], ['vagas','Vagas',1],
  ]) {
    const spans = op.relatorio.filter(s => s.campo === `opcoes.${op.opcao}.metricas.${campo}`);
    assert(spans.length && spans.every(s => Number(s.valor_attr) === op.json[campo] && normalizar(s.texto) === op.json[campo]));
    assert(Math.abs(normalizar(tela[label])/fator - op.json[campo]) < 1e-9);
    checks.push({estudo:op.estudo,opcao:op.opcao,campo,json:op.json[campo],tela:tela[label],relatorio:spans[0].texto});
  }
}
assert.equal(checks.length, 130);
fs.writeFileSync(path.join(__dirname, 'evidencias/metricas.json'), JSON.stringify(checks,null,2)+'\n');
console.log('130/130 métricas conferem entre tela, relatório e JSON.');
