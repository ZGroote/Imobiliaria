import { collection, doc, getDocFromServer, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { BOOK_SHA, posicoes, validarInformacoes, validarUnidade, vazias, type Estoque, type PerfilVenda, type UnidadeVenda } from './estoque-modelo.ts'

// Todo write passa pelas regras e registra uma mudança no mesmo commit.
// expectedRevision impede que duas telas sobrescrevam dados sem avisar.
export async function iniciarEstoque(db: Firestore, propertyId: string, uid: string, title: string) {
  const parent = doc(db, 'salesInventory', propertyId), change = doc(collection(parent, 'history'))
  return runTransaction(db, async tx => {
    if ((await tx.get(parent)).exists()) throw Error('Este estoque já foi cadastrado. Atualize a página.')
    const settings = { schema: 'liv-sales-v1', bookSHA256: BOOK_SHA, model: 'liv-ipanema', total: 170, title: title.trim(),
      publicEnabled: false, revision: 1, updatedAt: serverTimestamp(), lastChangeId: change.id }
    if (!settings.title || settings.title.length > 200) throw Error('Informe o nome do empreendimento.')
    tx.set(parent, settings)
    for (const p of posicoes()) tx.set(doc(parent, 'units', p.id), { ...p, commercialNumber: null, availability: 'nao_informada',
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
    if (kind === 'units' && fields.commercialNumber !== null) {
      const numberRef = doc(parent, 'numbers', fields.commercialNumber as string), number = await tx.get(numberRef)
      if (number.exists() && number.data().unitKey !== key) throw Error('Esse número comercial já pertence a outro apartamento.')
    }
    const next = { ...current, ...fields, revision: expectedRevision + 1, updatedAt: serverTimestamp(), lastChangeId: change.id }
    if (kind === 'units' && fields.commercialNumber !== current.commercialNumber) {
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
export const salvarUnidade = (db: Firestore, propertyId: string, uid: string, unit: UnidadeVenda) => {
  const valid = validarUnidade(unit)
  return alterar(db, propertyId, uid, 'units', unit.id, unit.revision, { commercialNumber: valid.commercialNumber,
    availability: valid.availability, profileId: valid.profileId, overrides: valid.overrides })
}
export const salvarPerfil = (db: Firestore, propertyId: string, uid: string, profile: PerfilVenda) =>
  alterar(db, propertyId, uid, 'profiles', profile.id, profile.revision, { info: validarInformacoes(profile.info) })
export const mostrarEstoque = (db: Firestore, propertyId: string, uid: string, settings: Estoque, enabled: boolean) =>
  alterar(db, propertyId, uid, 'settings', 'settings', settings.revision, { publicEnabled: enabled })
