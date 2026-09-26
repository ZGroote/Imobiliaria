// Nomes por id: o painel busca SÓ os documentos que a tela mostra, com getDoc (avaliado pela regra
// do próprio documento), uma vez por usuário e sessão. Duas telas pedindo o mesmo nome esperam a
// mesma busca. O cache é por usuário: trocar de conta na mesma aba não herda nomes da anterior.
// Não é ao vivo: um nome renomeado aparece na próxima sessão (a lista em si continua ao vivo).
import { doc, getDoc, type Firestore } from 'firebase/firestore'

export type ColecaoDeNome = 'properties' | 'users'

const dados = new Map<string, Record<string, unknown> | null>()   // null: não existe, ou a regra negou
const buscas = new Map<string, Promise<void>>()
const ouvintes = new Set<() => void>()
let versao = 0

const chave = (uid: string, colecao: ColecaoDeNome, id: string) => `${uid}|${colecao}/${id}`

export function pedirNome(db: Firestore, uid: string, colecao: ColecaoDeNome, id: string): Promise<void> {
  const k = chave(uid, colecao, id)
  const feita = buscas.get(k)
  if (feita) return feita
  // Erro (permission-denied, rede) vira "sem nome" e fica assim na sessão: tentar de novo a cada
  // render faria um laço de buscas negadas.
  const p = getDoc(doc(db, colecao, id)).then(
    (s) => { dados.set(k, s.exists() ? s.data() : null) },
    () => { dados.set(k, null) },
  ).then(() => { versao++; ouvintes.forEach((f) => f()) })
  buscas.set(k, p)
  return p
}

// undefined: ainda buscando; null: sem nome (não existe ou negado); texto: o nome.
export function nomeEmCache(uid: string, colecao: ColecaoDeNome, id: string, campo: string): string | null | undefined {
  const k = chave(uid, colecao, id)
  if (!dados.has(k)) return undefined
  const v = dados.get(k)?.[campo]
  return typeof v === 'string' ? v : null
}

// Para o useSyncExternalStore do hook de tela (useNomes).
export const assinarNomes = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }
export const versaoDosNomes = () => versao
