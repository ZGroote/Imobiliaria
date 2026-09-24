import { addDoc, collection, deleteField, doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { urlSegura } from './imoveis.ts'
import type { Request } from './types.ts'

// Pedido = solicitação de produção de um tour. Nasce "submitted"; status muda só por
// mudarStatus (status.ts / auditoria), nunca por aqui.
export interface NovoPedido {
  agencyId: string; title: string; propertyId?: string; listingUrl?: string
  priority?: Request['priority']; notes?: string
}

const texto = (v?: string) => (v ?? '').trim()

function validar(c: { title?: string; listingUrl?: string }) {
  if (c.title !== undefined && !texto(c.title)) throw new Error('Informe um título para o pedido.')
  if (!urlSegura(texto(c.listingUrl) || undefined)) throw new Error('O link do anúncio precisa começar com http:// ou https://.')
}

export function criarPedido(db: Firestore, uid: string, p: NovoPedido) {
  validar(p)
  if (!p.agencyId) throw new Error('Escolha a imobiliária.')
  const opcionais = { propertyId: texto(p.propertyId), listingUrl: texto(p.listingUrl), notes: texto(p.notes), priority: p.priority }
  return addDoc(collection(db, 'requests'), {
    agencyId: p.agencyId, requestedBy: uid, title: texto(p.title), status: 'submitted',
    ...Object.fromEntries(Object.entries(opcionais).filter(([, v]) => v)),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

// Quem pediu (ou o gerente) enquanto o pedido está em Recebida/Aguardando materiais; a equipe sempre.
export function editarPedido(db: Firestore, id: string, c: { title?: string; notes?: string; listingUrl?: string }) {
  validar(c)
  const campos = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, texto(v) || deleteField()]))
  return updateDoc(doc(db, 'requests', id), { ...campos, updatedAt: serverTimestamp() })
}

// Só a equipe interna: prioridade, responsável interno e imóvel vinculado.
export function editarPedidoInterno(db: Firestore, id: string,
  c: { priority?: Request['priority']; assignedTo?: string; propertyId?: string }) {
  const campos = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v || deleteField()]))
  return updateDoc(doc(db, 'requests', id), { ...campos, updatedAt: serverTimestamp() })
}

// Nota interna: subcoleção que só a equipe lê (o Firestore não esconde campo de documento).
export const salvarNotaInterna = (db: Firestore, rid: string, uid: string, text: string) =>
  setDoc(doc(db, 'requests', rid, 'internal', 'notes'), { text, updatedBy: uid, updatedAt: serverTimestamp() })
