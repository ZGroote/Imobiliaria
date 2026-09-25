import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { aprovar, pedirAjuste, registrarPreview } from '../src/lib/aprovacao.ts'
import { lerPreview, validarManifesto } from '../src/lib/publicacao.ts'
import { editarPedidoInterno } from '../src/lib/pedidos.ts'
import { mudarStatus } from '../src/lib/status.ts'
import type { Request } from '../src/lib/types.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

const UNID = 'monte-dos-cedros-37'
const manifesto = (build: string, imovel = UNID) => ({
  schema: 1, imovel, build, arquivos: { 'tour.html': { bytes: 1, sha256: 'x' }, 'maquete.html': { bytes: 1, sha256: 'y' } },
})
const site = (build: string) => `https://imoveis.example/b/${UNID}/${build}/tour.html`
// O fetch de mentira entrega os BYTES servidos: é deles que sai a identidade do artefato.
const servirTexto = (texto: string, ok = true) => async () => ({ ok, status: ok ? 200 : 404,
  json: async () => JSON.parse(texto), arrayBuffer: async () => new TextEncoder().encode(texto).buffer })
const servir = (corpo: unknown, ok = true) => servirTexto(JSON.stringify(corpo), ok)
const sha = (texto: string) => createHash('sha256').update(texto).digest('hex')
const ler = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'requests', id))).data() }) as Request

test('manifest: descreve este imóvel e este build, na pasta do build', async () => {
  const pasta = `/b/${UNID}/a1b2c3d4e5f6/`
  assert.equal(validarManifesto(manifesto('a1b2c3d4e5f6'), { imovel: UNID, pasta }).build, 'a1b2c3d4e5f6')
  assert.throws(() => validarManifesto(manifesto('a1b2c3d4e5f6', 'outro-imovel'), { imovel: UNID, pasta }), /outro-imovel/)
  assert.throws(() => validarManifesto(manifesto('XYZ'), { imovel: UNID, pasta }), /12 hex/)
  assert.throws(() => validarManifesto(manifesto('ffffffffffff'), { imovel: UNID, pasta }), /endereço não é o do build/)
  assert.throws(() => validarManifesto({ ...manifesto('a1b2c3d4e5f6'), arquivos: {} }, { imovel: UNID, pasta }), /tour.html/)

  const texto = JSON.stringify(manifesto('a1b2c3d4e5f6'))
  const p = await lerPreview(site('a1b2c3d4e5f6'), UNID, servirTexto(texto))
  assert.deepEqual(p, { build: 'a1b2c3d4e5f6', tourUrl: site('a1b2c3d4e5f6'),
    maqueteUrl: `https://imoveis.example/b/${UNID}/a1b2c3d4e5f6/maquete.html`, manifestSha256: sha(texto) })
  // Aprova-se o ARQUIVO servido, não o JSON interpretado: o mesmo conteúdo com outra
  // indentação é outro artefato, e tem outro hash.
  const indentado = JSON.stringify(manifesto('a1b2c3d4e5f6'), null, 2)
  const q = await lerPreview(site('a1b2c3d4e5f6'), UNID, servirTexto(indentado))
  assert.deepEqual([q.build, q.manifestSha256], ['a1b2c3d4e5f6', sha(indentado)])
  assert.notEqual(q.manifestSha256, p.manifestSha256)
  await assert.rejects(lerPreview(site('a1b2c3d4e5f6'), UNID, servir(null, false)), /HTTP 404/)
  await assert.rejects(lerPreview('javascript:alert(1)', UNID, servir({})), /https/)
})

test('aprovação: só o gerente da agência, só o build em revisão; ajuste volta para produção', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA'), corA = await entrar('corA'), gerB = await entrar('gerB')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'accepted')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'production')
  const previewA = await lerPreview(site('a1b2c3d4e5f6'), UNID, servir(manifesto('a1b2c3d4e5f6')))
  const admin = await entrar('admin')
  await editarPedidoInterno(op.db, 'pedCedros', { propertyId: 'colinas' })          // antes do build: pode trocar
  await editarPedidoInterno(op.db, 'pedCedros', { propertyId: 'cedros' })
  await registrarPreview(op.db, 'op', await ler(op.db, 'pedCedros'), previewA)
  assert.equal((await ler(op.db, 'pedCedros')).status, 'agency_review')
  for (const q of [op, admin]) {                                                     // com build: travado
    await assert.rejects(editarPedidoInterno(q.db, 'pedCedros', { propertyId: 'colinas' }), /permission/i)
  }

  await assert.rejects(aprovar(corA.db, 'corA', await ler(corA.db, 'pedCedros')), /permission/i)
  await assert.rejects(aprovar(gerB.db, 'gerB', await ler(op.db, 'pedCedros')), /permission/i)
  await assert.rejects(aprovar(op.db, 'op', await ler(op.db, 'pedCedros')), /permission/i)
  await pedirAjuste(gerA.db, 'gerA', await ler(gerA.db, 'pedCedros'), 'Faltou a varanda.')
  const r = await ler(op.db, 'pedCedros')
  const log = (await getDoc(doc(op.db, 'auditLogs', r.lastAuditId!))).data()!
  assert.deepEqual([r.status, log.after.nota, log.after.build], ['production', 'Faltou a varanda.', 'a1b2c3d4e5f6'])
  assert.throws(() => pedirAjuste(gerA.db, 'gerA', r, '  '), /precisa mudar/)

  const previewB = await lerPreview(site('0f9e8d7c6b5a'), UNID, servir(manifesto('0f9e8d7c6b5a')))
  await registrarPreview(op.db, 'op', await ler(op.db, 'pedCedros'), previewB)
  await aprovar(gerA.db, 'gerA', await ler(gerA.db, 'pedCedros'))
  const aprovado = await ler(op.db, 'pedCedros')
  // a aprovação congela o artefato em revisão: o build E o manifest exato
  assert.match(previewB.manifestSha256 ?? '', /^[0-9a-f]{64}$/)
  assert.deepEqual([aprovado.status, aprovado.approvedBuild, aprovado.approvedManifestSha256, aprovado.approvedBy],
    ['approved', previewB.build, previewB.manifestSha256, 'gerA'])
  const decisao = (await getDoc(doc(op.db, 'auditLogs', aprovado.lastAuditId!))).data()!
  assert.deepEqual([decisao.after.build, decisao.after.manifestSha256], [previewB.build, previewB.manifestSha256])
  await assert.rejects(editarPedidoInterno(admin.db, 'pedCedros', { propertyId: 'colinas' }), /permission/i)   // aprovado
  assert.throws(() => aprovar(gerA.db, 'gerA', aprovado), /build em revisão/)
})
