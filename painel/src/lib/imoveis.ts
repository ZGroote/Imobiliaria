import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import type { Property } from './types.ts'

// Imóvel enxuto (spec §14): o que identifica e opera a experiência. A ficha completa mora no
// pipeline (plantas_fornecidas/<id>/unidade.json); o painel guarda só pipelineUnitId.
export type CamposDoImovel = Pick<Property, 'title' | 'developmentName' | 'address' | 'externalListingUrl' | 'pipelineUnitId'>

// Mesmo critério da T02: link de anúncio só HTTP(S).
export function urlSegura(u?: string) {
  if (!u) return true
  try { return ['http:', 'https:'].includes(new URL(u).protocol) } catch { return false }
}

function limpar(c: Partial<CamposDoImovel>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  if ('title' in c && !out.title) throw new Error('Informe o título do imóvel.')
  if (!urlSegura(out.externalListingUrl)) throw new Error('O link do anúncio precisa começar com http:// ou https://.')
  if (out.pipelineUnitId && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.pipelineUnitId)) {
    throw new Error('O id do pipeline usa só letras minúsculas, números e hífen (ex.: monte-dos-cedros-37).')
  }
  return out
}

// Equipe interna cadastra (regras: properties create só isStaff, sem campos de publicação).
export function criarImovel(db: Firestore, agencyId: string, c: CamposDoImovel) {
  if (!agencyId) throw new Error('Escolha a imobiliária.')
  return addDoc(collection(db, 'properties'), {
    agencyId, ...limpar(c), status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

// Campo esvaziado some do documento. Os de publicação não passam por aqui (só a publicação).
export function editarImovel(db: Firestore, id: string, c: Partial<CamposDoImovel> & { status?: Property['status'] }) {
  const { status, ...campos } = c
  const limpos = limpar(campos)
  const apagados = Object.fromEntries(Object.keys(campos).filter((k) => !(k in limpos)).map((k) => [k, deleteField()]))
  return updateDoc(doc(db, 'properties', id), {
    ...limpos, ...apagados, ...(status ? { status } : {}), updatedAt: serverTimestamp(),
  })
}

// Gerente atribui um corretor da própria imobiliária; as regras conferem a agência do corretor.
export const atribuirCorretor = (db: Firestore, id: string, corretorUid: string) =>
  updateDoc(doc(db, 'properties', id), { assignedAgentId: corretorUid, updatedAt: serverTimestamp() })
