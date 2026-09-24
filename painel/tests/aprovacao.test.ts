import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { aprovar, pedirAjuste, registrarPreview } from '../src/lib/aprovacao.ts'
import { lerPreview, validarManifesto } from '../src/lib/publicacao.ts'
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
const servir = (corpo: unknown, ok = true) => async () => ({ ok, status: ok ? 200 : 404, json: async () => corpo })
const ler = async (db: Firestore, id: string) => ({ id, ...(await getDoc(doc(db, 'requests', id))).data() }) as Request

test('manifest: descreve este imóvel e este build, na pasta do build', async () => {
  const pasta = `/b/${UNID}/a1b2c3d4e5f6/`
  assert.equal(validarManifesto(manifesto('a1b2c3d4e5f6'), { imovel: UNID, pasta }).build, 'a1b2c3d4e5f6')
  assert.throws(() => validarManifesto(manifesto('a1b2c3d4e5f6', 'outro-imovel'), { imovel: UNID, pasta }), /outro-imovel/)
  assert.throws(() => validarManifesto(manifesto('XYZ'), { imovel: UNID, pasta }), /12 hex/)
  assert.throws(() => validarManifesto(manifesto('ffffffffffff'), { imovel: UNID, pasta }), /endereço não é o do build/)
  assert.throws(() => validarManifesto({ ...manifesto('a1b2c3d4e5f6'), arquivos: {} }, { imovel: UNID, pasta }), /tour.html/)

  const p = await lerPreview(site('a1b2c3d4e5f6'), UNID, servir(manifesto('a1b2c3d4e5f6')))
  assert.deepEqual(p, { build: 'a1b2c3d4e5f6', tourUrl: site('a1b2c3d4e5f6'),
    maqueteUrl: `https://imoveis.example/b/${UNID}/a1b2c3d4e5f6/maquete.html` })
  await assert.rejects(lerPreview(site('a1b2c3d4e5f6'), UNID, servir(null, false)), /HTTP 404/)
  await assert.rejects(lerPreview('javascript:alert(1)', UNID, servir({})), /https/)
})

test('aprovação: só o gerente da agência, só o build em revisão; ajuste volta para produção', async () => {
  const op = await entrar('op'), gerA = await entrar('gerA'), corA = await entrar('corA'), gerB = await entrar('gerB')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'accepted')
  await mudarStatus(op.db, 'op', await ler(op.db, 'pedCedros'), 'production')
  const previewA = await lerPreview(site('a1b2c3d4e5f6'), UNID, servir(manifesto('a1b2c3d4e5f6')))
  await registrarPreview(op.db, 'op', await ler(op.db, 'pedCedros'), previewA)
  assert.equal((await ler(op.db, 'pedCedros')).status, 'agency_review')

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
  assert.deepEqual([aprovado.status, aprovado.approvedBuild, aprovado.approvedBy], ['approved', '0f9e8d7c6b5a', 'gerA'])
  assert.throws(() => aprovar(gerA.db, 'gerA', aprovado), /build em revisão/)
})
