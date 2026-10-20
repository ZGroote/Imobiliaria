// pipeline/vitrine_ao_vivo.js: o que a pagina do imovel faz com vitrine/<slug> do Firestore.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const fonte = readFileSync(new URL('../pipeline/vitrine_ao_vivo.js', import.meta.url), 'utf8')
const doc = (fields) => ({ fields })

// Uma pagina falsa com a ficha do tour (#uStats) e a da maquete (#fPreco).
function pagina(resposta) {
  const tour = { nodeValue: 'R$ 690.000,00' }, maquete = { nodeType: 3, nodeValue: 'R$ 690.000,00' }
  const b = { firstChild: tour, parentNode: { firstChild: { nodeValue: 'Preço' } } }
  let coberta = false, pedido = null
  const ctx = {
    fetch: async (url) => { pedido = url; return { ok: resposta !== null, json: async () => resposta } },
    setTimeout: () => 0, location: { search: '', hash: '', replace: () => assert.fail('build nao redireciona') },
    window: {},
    document: {
      body: { appendChild: () => { coberta = true } },
      createElement: () => ({ setAttribute() {}, style: {} }),
      querySelector: (s) => (s === '#uStats > div:first-child > b' ? b : null),
      getElementById: (id) => (id === 'fPreco' ? { lastChild: maquete } : null),
    },
  }
  vm.createContext(ctx)
  vm.runInContext(fonte, ctx)
  return { ctx, tour, maquete, coberta: () => coberta, pedido: () => pedido }
}
const espera = () => new Promise((r) => setImmediate(r))

test('lerVitrine: sem documento é null; ausente vale no ar e disponível; preço vem em centavos', () => {
  const { ctx } = pagina(null)
  assert.equal(ctx.lerVitrine(null), null)
  assert.deepEqual({ ...ctx.lerVitrine(doc({})) }, { online: true, situacao: 'disponivel', precoCentavos: null })
  assert.deepEqual({ ...ctx.lerVitrine(doc({ online: { booleanValue: false }, situacao: { stringValue: 'vendido' },
    precoCentavos: { integerValue: '35000000' } })) }, { online: false, situacao: 'vendido', precoCentavos: 35000000 })
  assert.equal(ctx.lerVitrine(doc({ precoCentavos: { nullValue: null } })).precoCentavos, null)
})

test('textoDoPreco: situação vence o preço; sem preço mantém o montado; aluguel guarda o /mês', () => {
  const { ctx } = pagina(null)
  assert.equal(ctx.textoDoPreco({ situacao: 'vendido', precoCentavos: 1 }, 'R$ 1'), 'Vendido')
  assert.equal(ctx.textoDoPreco({ situacao: 'disponivel', precoCentavos: null }, 'R$ 1'), null)
  assert.match(ctx.textoDoPreco({ situacao: 'disponivel', precoCentavos: 72000000 }, 'R$ 690.000'), /^R\$\s?720\.000,00$/)
  assert.match(ctx.textoDoPreco({ situacao: 'disponivel', precoCentavos: 250000 }, 'R$ 2.400/mês'), /^R\$\s?2\.500,00\/mês$/)
})

test('build: lê vitrine/<slug> e troca o preço nas duas fichas', async () => {
  const p = pagina(doc({ online: { booleanValue: true }, situacao: { stringValue: 'disponivel' }, precoCentavos: { integerValue: '72000000' } }))
  p.ctx.vitrineAoVivo('monte-dos-cedros-37')
  await espera()
  assert.match(p.pedido(), /\/documents\/vitrine\/monte-dos-cedros-37$/)
  assert.match(p.tour.nodeValue, /720\.000,00/)
  assert.match(p.maquete.nodeValue, /720\.000,00/)
  assert.equal(p.coberta(), false)
})

test('build: fora do ar cobre a tela; sem documento ou sem rede, fica como montado', async () => {
  const fora = pagina(doc({ online: { booleanValue: false } }))
  fora.ctx.vitrineAoVivo('x'); await espera()
  assert.equal(fora.coberta(), true)
  for (const resposta of [null, undefined]) {
    const p = pagina(resposta)
    if (resposta === undefined) p.ctx.fetch = async () => { throw new Error('sem rede') }
    p.ctx.vitrineAoVivo('x'); await espera()
    assert.equal(p.coberta(), false)
    assert.equal(p.tour.nodeValue, 'R$ 690.000,00')
  }
})
