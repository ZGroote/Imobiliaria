// Custo de servidor (Firebase Hosting) para N acessos por dia, a partir dos bytes MEDIDOS
// por medir.mjs (resultados/base.json e resultados/nova.json).
//   node medicoes/custos.mjs [--acessos 1000] [--interior 0.4] [--revisita 0.25] [--dolar 5.40]
//
// Premissas (todas ajustáveis na linha de comando):
// - mistura de aparelhos: 30% computador, 50% celular intermediário, 20% celular fraco
//   (cada um recebe o perfil e a resolução de luz que a v4 escolhe para ele);
// - `interior`: fração dos acessos que abre a Planta 3D ou a Visita;
// - `revisita`: fração dos acessos de quem já abriu antes, com cache (só o HTML revalida);
// - preço do Hosting: 360 MB/dia sem custo, depois US$ 0,15/GB; armazenamento 10 GB sem
//   custo, depois US$ 0,026/GB/mês. A franquia é do PROJETO, dividida com o mapa e o painel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : p; };
const ACESSOS = arg('acessos', 1000), INTERIOR = arg('interior', 0.4), REVISITA = arg('revisita', 0.25), DOLAR = arg('dolar', 5.40);
const MISTURA = { 'desktop': 0.30, 'celular-4g': 0.50, 'celular-fraco': 0.20 };
const FRANQUIA_DIA = 360e6, PRECO_GB = 0.15;

function porAcesso(res, interior) {
  let soma = 0;
  for (const [perfil, peso] of Object.entries(MISTURA)) {
    const m = res.perfis[perfil].mediana;
    const nova = (1 - REVISITA) * (m.bytesAbrir + interior * m.bytesPlanta3d);
    const volta = REVISITA * m.bytesRevisita;
    soma += peso * (nova + volta);
  }
  return soma;
}
function conta(res, interior) {
  const dia = porAcesso(res, interior) * ACESSOS;
  const mes = dia * 30;
  const excedenteDia = Math.max(0, dia - FRANQUIA_DIA);
  const usd = excedenteDia * 30 / 1e9 * PRECO_GB;
  return { mbPorAcesso: +(porAcesso(res, interior) / 1e6).toFixed(2), gbDia: +(dia / 1e9).toFixed(2), gbMes: +(mes / 1e9).toFixed(1),
           usdMes: +usd.toFixed(2), brlMes: +(usd * DOLAR).toFixed(2),
           usdMesSemFranquia: +(mes / 1e9 * PRECO_GB).toFixed(2) };
}
const ler = v => JSON.parse(fs.readFileSync(path.join(AQUI, 'resultados', v + '.json'), 'utf8'));
const base = ler('base'), nova = ler('nova');
const saida = { premissas: { acessosDia: ACESSOS, interior: INTERIOR, revisita: REVISITA, mistura: MISTURA, dolar: DOLAR,
                             franquiaMBdia: 360, usdPorGB: PRECO_GB },
                cenarios: {} };
for (const [nome, frac] of [['so-predio', 0], ['padrao', INTERIOR], ['todos-no-interior', 1]]) {
  saida.cenarios[nome] = { fracaoInterior: frac, base: conta(base, frac), nova: conta(nova, frac) };
}
// Escala: a partir de quantos acessos/dia a franquia acaba (cenário padrão).
const porAcessoBase = porAcesso(base, INTERIOR), porAcessoNova = porAcesso(nova, INTERIOR);
saida.limiteFranquia = { base: Math.floor(FRANQUIA_DIA / porAcessoBase), nova: Math.floor(FRANQUIA_DIA / porAcessoNova) };
saida.escala = [1000, 10000, 100000].map(n => ({ acessosDia: n,
  baseUsdMes: +(Math.max(0, n * porAcessoBase - FRANQUIA_DIA) * 30 / 1e9 * PRECO_GB).toFixed(2),
  novaUsdMes: +(Math.max(0, n * porAcessoNova - FRANQUIA_DIA) * 30 / 1e9 * PRECO_GB).toFixed(2) }));
fs.writeFileSync(path.join(AQUI, 'resultados', 'custos.json'), JSON.stringify(saida, null, 2));
console.log(JSON.stringify(saida, null, 2));
