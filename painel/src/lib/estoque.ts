import { collection, doc, getDocFromServer, runTransaction, serverTimestamp, type DocumentReference, type Firestore } from 'firebase/firestore'
import { CATALOGOS_ESTOQUE, MODELO_LARANJEIRAS, lerVagas, posicoes, validarInformacoes, validarUnidade, validarVagas, vazias, type Estoque, type ModeloEstoque, type PerfilVenda, type UnidadeVenda } from './estoque-modelo.ts'

// Todo write passa pelas regras e registra uma mudança no mesmo commit.
// expectedRevision impede que duas telas sobrescrevam dados sem avisar.
export async function iniciarEstoque(db: Firestore, propertyId: string, uid: string, title: string, model: ModeloEstoque = 'liv-ipanema') {
  const parent = doc(db, 'salesInventory', propertyId), change = doc(collection(parent, 'history'))
  const { bookSHA256, total } = CATALOGOS_ESTOQUE[model]
  return runTransaction(db, async tx => {
    if ((await tx.get(parent)).exists()) throw Error('Este estoque já foi cadastrado. Atualize a página.')
    const settings = { schema: 'liv-sales-v1', bookSHA256, model, total, title: title.trim(),
      publicEnabled: false, revision: 1, updatedAt: serverTimestamp(), lastChangeId: change.id }
    if (!settings.title || settings.title.length > 200) throw Error('Informe o nome do empreendimento.')
    tx.set(parent, settings)
    for (const p of posicoes(model)) tx.set(doc(parent, 'units', p.id), { ...p, commercialNumber: null, availability: 'nao_informada',
      profileId: null, overrides: vazias(), revision: 1, updatedAt: serverTimestamp(), lastChangeId: change.id })
    for (const id of ['canto', 'meio']) tx.set(doc(parent, 'profiles', id), { id, info: vazias(), revision: 1, updatedAt: serverTimestamp(), lastChangeId: change.id })
    tx.set(change, { kind: 'settings', key: 'settings', revision: 1, actor: uid, timestamp: serverTimestamp(), snapshot: settings })
  })
}
async function alterar(db: Firestore, propertyId: string, uid: string, kind: 'settings' | 'units' | 'profiles', key: string,
  expectedRevision: number, fields: Record<string, unknown>) {
  const parent = doc(db, 'salesInventory', propertyId), ref = kind === 'settings' ? parent : doc(parent, kind, key)
  const change = doc(collection(parent, 'history'))
  try { return await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw Error('Cadastro não encontrado.')
    const current = snapshot.data()
    if (current.revision !== expectedRevision) throw Error('Outra pessoa atualizou este cadastro. Reabra a ficha antes de salvar.')
    if (kind === 'units' && typeof fields.commercialNumber === 'string') {
      const numberRef = doc(parent, 'numbers', fields.commercialNumber as string), number = await tx.get(numberRef)
      if (number.exists() && number.data().unitKey !== key) throw Error('Esse número comercial já pertence a outro apartamento.')
    }
    const next = { ...current, ...fields, revision: expectedRevision + 1, updatedAt: serverTimestamp(), lastChangeId: change.id }
    if (kind === 'units' && Object.hasOwn(fields, 'commercialNumber') && fields.commercialNumber !== current.commercialNumber) {
      if (current.commercialNumber !== null) tx.delete(doc(parent, 'numbers', current.commercialNumber))
      if (fields.commercialNumber !== null) tx.set(doc(parent, 'numbers', fields.commercialNumber as string), { unitKey: key })
    }
    tx.set(ref, next)
    tx.set(change, { kind, key, revision: next.revision, actor: uid, timestamp: serverTimestamp(), snapshot: next })
  }) } catch (e) {
    // Rules can reject a competing commit before the SDK retries its transaction.
    // Distinguish that conflict from an actual permission failure using a fresh read.
    if ((e as { code?: string }).code === 'permission-denied') {
      try {
        const latest = await getDocFromServer(ref)
        if (latest.exists() && latest.data().revision !== expectedRevision) throw Error('Outra pessoa atualizou este cadastro. Reabra a ficha antes de salvar.')
      } catch (readError) {
        if ((readError as Error).message.startsWith('Outra pessoa')) throw readError
      }
    }
    throw e
  }
}
// Lê o mapa atual dentro da transação e troca só as vagas desta unidade: editar
// apartamentos diferentes ao mesmo tempo não conflita, mas a mesma vaga sim.
export async function salvarVagas(db: Firestore, propertyId: string, uid: string, unitKey: string, vagas: number[]) {
  const parent = doc(db, 'salesInventory', propertyId), ref = doc(parent, 'parking', 'mapa'), change = doc(collection(parent, 'history'))
  if (!posicoes().some(p => p.id === unitKey)) throw Error('Unidade inválida.')
  vagas = lerVagas(vagas.join(','))
  // As regras recusam o commit que perdeu a corrida (revisão velha) sem o SDK repetir;
  // repetir relê o mapa. Sem permissão de verdade, a última tentativa repassa o erro.
  for (let tentativa = 1; ; tentativa++) {
    try { return await gravarVagas(db, ref, change, uid, unitKey, vagas) } catch (e) {
      if ((e as { code?: string }).code !== 'permission-denied' || tentativa === 3) throw e
    }
  }
}
function gravarVagas(db: Firestore, ref: DocumentReference, change: DocumentReference, uid: string, unitKey: string, vagas: number[]) {
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref), current = snapshot.exists() ? snapshot.data() : null
    const spaces = current ? validarVagas(current) : {}
    const ocupada = vagas.find(n => spaces[n] && spaces[n] !== unitKey)
    if (ocupada) throw Error(`A vaga ${ocupada} já pertence a outro apartamento (${spaces[ocupada]}). Libere-a primeiro.`)
    const next = Object.fromEntries(Object.entries(spaces).filter(([, u]) => u !== unitKey))
    for (const n of vagas) next[n] = unitKey
    const record = { id: 'mapa', spaces: next, revision: (current?.revision ?? 0) + 1, updatedAt: serverTimestamp(), lastChangeId: change.id }
    tx.set(ref, record)
    tx.set(change, { kind: 'parking', key: 'mapa', revision: record.revision, actor: uid, timestamp: serverTimestamp(), snapshot: record })
  })
}
export const salvarUnidade =(db: Firestore, propertyId: string, uid: string, unit: UnidadeVenda) => {
  const valid = validarUnidade(unit, unit.tower === undefined ? 'liv-ipanema' : MODELO_LARANJEIRAS)
  return alterar(db, propertyId, uid, 'units', unit.id, unit.revision, { commercialNumber: valid.commercialNumber,
    availability: valid.availability, profileId: valid.profileId, overrides: valid.overrides })
}
export const salvarPerfil = (db: Firestore, propertyId: string, uid: string, profile: PerfilVenda) =>
  alterar(db, propertyId, uid, 'profiles', profile.id, profile.revision, { info: validarInformacoes(profile.info) })

export const salvarComercial = (db: Firestore, propertyId: string, uid: string, unit: UnidadeVenda, priceCents: number | null, availability: UnidadeVenda['availability']) => {
  const next = validarUnidade({ ...unit, availability, overrides: { ...unit.overrides, priceCents } }, unit.tower === undefined ? 'liv-ipanema' : MODELO_LARANJEIRAS)
  if (availability !== unit.availability && !['disponivel', 'vendida'].includes(availability)) throw Error('Escolha disponível ou vendida.')
  return alterar(db, propertyId, uid, 'units', unit.id, unit.revision, { availability, overrides: next.overrides })
}
export const mostrarEstoque = (db: Firestore, propertyId: string, uid: string, settings: Estoque, enabled: boolean) =>
  alterar(db, propertyId, uid, 'settings', 'settings', settings.revision, { publicEnabled: enabled })
