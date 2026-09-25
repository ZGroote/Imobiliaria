'use client'
import Link from 'next/link'
import { Pagina } from '@/components/AppShell'
import { ROTULO_PRIORIDADE, SeloStatus } from '@/components/pedido'
import { CarregarMais, Estado, Selo } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { colunaDoKanban } from '@/lib/listas'
import { COLUNAS } from '@/lib/status'
import type { Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { usePaginada, useTotal } from '@/lib/useFirestore'

// Home da equipe (spec §25). Mover de coluna é na página do pedido, onde fica o histórico.
export default function Kanban() {
  const cat = useCatalogoInterno()
  return (
    <Pagina titulo="Kanban" sub="Pedidos por etapa. Os mais recentes primeiro.">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {COLUNAS.map((c) => <Coluna key={c.titulo} c={c} cat={cat} />)}
      </div>
    </Pagina>
  )
}

// Cada coluna é a sua consulta, paginada e ao vivo: os cartões são uma amostra navegável, e o
// número no topo é o total real da coluna no banco (count()).
function Coluna({ c, cat }: { c: (typeof COLUNAS)[number]; cat: ReturnType<typeof useCatalogoInterno> }) {
  const chave = `kanban:${c.status.join(',')}`
  const r = usePaginada<Request>(chave, () => colunaDoKanban(db, c.status))
  const total = useTotal(chave, () => colunaDoKanban(db, c.status), r.dados)
  return (
    <section className="rounded-lg bg-slate-100 p-3">
      <h2 className="mb-3 flex justify-between text-sm font-semibold">
        {c.titulo}
        <span className="text-slate-500" title={total?.erro}>{total ? (total.n ?? '?') : '…'}</span>
      </h2>
      <Estado r={r}>
        <div className="space-y-2">
          {(r.dados ?? []).map((p) => (
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
      </Estado>
      <CarregarMais r={r} />
    </section>
  )
}
