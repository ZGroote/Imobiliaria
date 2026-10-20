import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'

// vitrine/{slug}: o que a página pública do imóvel lê ao vivo (pipeline/vitrine_ao_vivo.js), sem
// build nem deploy. A chave é o slug público (pipelineUnitId). Sem documento, o imóvel está no ar
// e mostra o preço com que foi montado. Regras: firestore.rules, bloco vitrine.
export const SITUACOES_VITRINE = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido', alugado: 'Alugado' } as const
export type SituacaoVitrine = keyof typeof SITUACOES_VITRINE
export interface Vitrine { propertyId: string; online: boolean; situacao: SituacaoVitrine; precoCentavos: number | null }

export const vitrinePadrao = (propertyId: string): Vitrine => ({ propertyId, online: true, situacao: 'disponivel', precoCentavos: null })

export function salvarVitrine(db: Firestore, slug: string, v: Vitrine) {
  if (!(v.situacao in SITUACOES_VITRINE)) throw new Error('Situação inválida.')
  if (v.precoCentavos !== null && (!Number.isSafeInteger(v.precoCentavos) || v.precoCentavos < 0)) throw new Error('Preço inválido.')
  return setDoc(doc(db, 'vitrine', slug), {
    propertyId: v.propertyId, online: v.online, situacao: v.situacao, precoCentavos: v.precoCentavos, updatedAt: serverTimestamp(),
  })
}
