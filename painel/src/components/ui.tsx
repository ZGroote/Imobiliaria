'use client'
import { Suspense, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { mensagemDoFirestore } from '@/lib/erros'

// Detalhe por ?id= (D1: export estático não tem rota dinâmica).
export function ComId({ children }: { children: (id: string) => ReactNode }) {
  return <Suspense fallback={<Carregando />}><LerId>{children}</LerId></Suspense>
}
function LerId({ children }: { children: (id: string) => ReactNode }) {
  const id = useSearchParams().get('id')
  return id ? <>{children(id)}</> : <Aviso>Endereço sem id.</Aviso>
}

export const Carregando = () => <p className="text-sm text-slate-500">Carregando…</p>
export const Aviso = ({ children }: { children: ReactNode }) =>
  <p role="alert" className="text-sm text-red-700">{children}</p>
export const Vazio = ({ children }: { children: ReactNode }) =>
  <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>

// Estado de uma consulta: carregando, erro ou conteúdo.
export function Estado<T>({ r, children }: { r: { dados?: T[]; dado?: T | null; erro?: string }; children: ReactNode }) {
  if (r.erro) return <Aviso>{r.erro}</Aviso>
  if (r.dados === undefined && r.dado === undefined) return <Carregando />
  return <>{children}</>
}

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{cabecalho.map((c) => <th key={c} className="px-4 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}
export const Td = ({ children }: { children?: ReactNode }) => <td className="px-4 py-2 align-top">{children}</td>

// min-w-0: o cartão é item de grid, e item de grid não encolhe abaixo do conteúdo (min-width: auto).
// Sem isso, um <pre> com comando longo alarga a página inteira em vez de rolar dentro de si.
export function Cartao({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
      {titulo && <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>}
      {children}
    </section>
  )
}

export const Selo = ({ children, tom = 'cinza' }: { children: ReactNode; tom?: 'cinza' | 'verde' | 'ambar' | 'azul' | 'vermelho' }) => {
  const cor = { cinza: 'bg-slate-100 text-slate-700', verde: 'bg-emerald-100 text-emerald-800',
    ambar: 'bg-amber-100 text-amber-800', azul: 'bg-sky-100 text-sky-800', vermelho: 'bg-red-100 text-red-800' }[tom]
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cor}`}>{children}</span>
}

// Ação que escreve no Firestore: ocupado enquanto roda, erro traduzido se as regras negarem.
export function useAcao() {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function executar(f: () => Promise<unknown>) {
    setOcupado(true); setErro('')
    try { await f(); return true } catch (e) { setErro(mensagemDoFirestore(e)); return false } finally { setOcupado(false) }
  }
  return { executar, ocupado, erro }
}
