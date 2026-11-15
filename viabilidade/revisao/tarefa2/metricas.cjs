// Executa as funções reais de formatação da tela fixada, sem iniciar navegador.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = __dirname;
const ref = path.join(root, 'referencia/viabilidade');
const source = fs.readFileSync(path.join(ref, 'visual/index.html'), 'utf8');
const declarations = ['numero', 'finito', 'formatar'].map(name => {
  const match = source.match(new RegExp('^    const ' + name + ' = .*$', 'm'));
  assert(match, name);
  return match[0];
}).join('\n');
const format = vm.runInNewContext(declarations + '\nformatar');
assert.equal(format(3.499), '3,5');
const studies = JSON.parse(fs.readFileSync(path.join(root, 'evidencias/estudos.json'), 'utf8'));
const result = [];
for (const s of studies) {
  const e = JSON.parse(fs.readFileSync(path.join(ref, s.json), 'utf8'));
  for (const o of e.opcoes) {
    for (const field of ['unidades_estimadas','area_privativa_m2','ca_usado','to_usada','vagas']) {
      const factor = field === 'to_usada' ? 100 : 1;
      const text = format(o.metricas[field]*factor);
      const recovered = Number(text.replaceAll('.','').replace(',','.'))/factor;
      result.push({estudo:s.id,opcao:o.id,campo:field,json:o.metricas[field],tela:text,
        tela_normalizada:recovered,valor_preservado:Math.abs(recovered-o.metricas[field])<1e-9});
    }
  }
}
fs.writeFileSync(path.join(root, 'evidencias/formatacao.json'), JSON.stringify(result,null,2)+'\n');
const losses = result.filter(r => !r.valor_preservado);
console.log(JSON.stringify({valores:result.length,arredondados:losses.length,casos:losses},null,2));

// Exercita o validador real sem precisar iniciar Chrome no sandbox.
const start = source.indexOf('    function degrausDaCaixa(');
const end = source.indexOf('    async function carregar(');
assert(start >= 0 && end > start);
const validate = vm.runInNewContext(declarations + '\n' + source.slice(start, end) + '\nvalidar');
const validation = [];
for (const s of studies) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'casos', s.id + '-v4.json'), 'utf8'));
  assert.equal(validate(data), data);
  validation.push({id:s.id + '-v4',aceito:true});
}
for (const c of JSON.parse(fs.readFileSync(path.join(root, 'evidencias/xss-casos.json'), 'utf8'))) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'casos', c.id + '.json'), 'utf8'));
  if (c.rejeicao_visual_esperada) assert.throws(() => validate(data), /motivo reconhecido/);
  else assert.equal(validate(data), data);
  validation.push({id:c.id,aceito:!c.rejeicao_visual_esperada});
}
fs.writeFileSync(path.join(root, 'evidencias/validacao.json'), JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({validacoes:validation.length}));
