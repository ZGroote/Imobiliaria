import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { getApps } from 'firebase/app'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { connectStorageEmulator, getBytes, getStorage, ref } from 'firebase/storage'
import { prepararMaterial, nomeMaterial, validarMaterial, type Material } from '../src/lib/materiais.ts'
import { criarPedido } from '../src/lib/pedidos.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)
function armazenamento() {
  const s = getStorage(getApps().at(-1)!, 'gs://demo-painel.appspot.com')
  connectStorageEmulator(s, '127.0.0.1', 9199)
  return s
}
test('validação recusa executáveis e vazio, aceita arquivos grandes; nome não injeta caminho', () => {
  for (const name of ['foto.svg', 'arquivo.html', 'programa.exe', 'sem-extensao']) assert.throws(() => validarMaterial({ name, size: 1 }), /Formato/)
  for (const size of [0, -1]) assert.throws(() => validarMaterial({ name: 'planta.pdf', size }), /conteúdo/)
  for (const size of [200 * 1024 * 1024, 5 * 1024 ** 3]) assert.equal(validarMaterial({ name: 'planta.pdf', size }), 'planta.pdf')
  assert.throws(() => validarMaterial({ name: 'planta.pdf', size: 5 * 1024 ** 3 + 1 }), /5 GB/)
  assert.equal(validarMaterial({ name: '../../Plánta 42.PDF', size: 100 }), '.._.._Planta 42.pdf')
  assert.equal(nomeMaterial('abcdefghijklmnopqrst_planta.pdf'), 'planta.pdf')
})
test('pedido sem anúncio e sem escolha técnica recebe arquivos privados, sem duplicar no retry', async () => {
  const pessoa = await entrar('corA'), storage = armazenamento()
  const pedido = await criarPedido(pessoa.db, pessoa.uid, { agencyId: 'agA', title: 'Pedido com planta, sem anúncio' })
  const arquivo = new File(['planta sintetica'], 'Planta 42.pdf', { type: 'application/pdf' })
  const envio = prepararMaterial(pessoa.db, storage, { id: pedido.id, agencyId: 'agA' }, pessoa.uid, arquivo)
  await envio.enviar(() => {})
  await envio.enviar(() => {})
  const registros = await getDocs(query(collection(pessoa.db, 'requestAssets'), where('requestId', '==', pedido.id), where('agencyId', '==', 'agA')))
  assert.equal(registros.size, 1)
  const material = registros.docs[0].data() as Material
  assert.equal(material.uploadedBy, pessoa.uid)
  assert.equal(material.type, 'floorplan')
  assert.equal(new TextDecoder().decode(await getBytes(ref(storage, material.storagePath))), 'planta sintetica')
  const admin = await entrar('admin'), interno = armazenamento()
  assert.equal((await getBytes(ref(interno, material.storagePath))).byteLength, arquivo.size)
  const outra = await entrar('gerB'), isolado = armazenamento()
  await assert.rejects(getBytes(ref(isolado, material.storagePath)), (e: { code: string }) => e.code === 'storage/unauthorized')
  await assert.rejects(getDocs(query(collection(outra.db, 'requestAssets'), where('requestId', '==', pedido.id), where('agencyId', '==', 'agA'))))
})
