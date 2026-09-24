'use client'
import Link from 'next/link'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ROTULO_PRIORIDADE, SeloStatus } from '@/components/pedido'
import { Estado, Selo } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { COLUNAS } from '@/lib/status'
import type { Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { useColecao } from '@/lib/useFirestore'

// Home da equipe (spec §25). Mover de coluna é na página do pedido, onde fica o histórico.
export default function Kanban() {
  const r = useColecao<Request>('kanban', () => query(collection(db, 'requests'), orderBy('updatedAt', 'desc')))
  const cat = useCatalogoInterno()
  return (
    <Pagina titulo="Kanban" sub="Pedidos por etapa. Os mais recentes primeiro.">
      <Estado r={r}>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUNAS.map((c) => {
            const cartoes = (r.dados ?? []).filter((p) => c.status.includes(p.status))
            return (
              <section key={c.titulo} className="rounded-lg bg-slate-100 p-3">
                <h2 className="mb-3 flex justify-between text-sm font-semibold">
                  {c.titulo}<span className="text-slate-500">{cartoes.length}</span>
                </h2>
                <div className="space-y-2">
                  {cartoes.map((p) => (
                    <Link key={p.id} href={`/admin/requests/view?id=${p.id}`}
                      className="block rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-slate-400">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-slate-500">{cat.agencia(p.agencyId)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <SeloStatus s={p.status} />
                        {p.priority === 'high' && <Selo tom="vermelho">{ROTULO_PRIORIDADE.high}</Selo>}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {p.assignedTo ? cat.pessoa(p.assignedTo) : 'Sem responsável'} · {quando(p.updatedAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </Estado>
    </Pagina>
  )
}
