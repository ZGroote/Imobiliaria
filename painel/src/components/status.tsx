'use client'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { Aviso, Cartao, Estado, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { usePerfil } from '@/lib/session'
import { mudarStatus, proximos, ROTULO_STATUS, rotuloDaAcao } from '@/lib/status'
import type { AuditLog, Request, RequestStatus } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

// `bloqueio`: transições que a tela já sabe que as regras negariam, com o motivo.
export function AcoesDeStatus({ r, bloqueio }: { r: Request; bloqueio?: Partial<Record<RequestStatus, string>> }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const opcoes = proximos(r, perfil.role, perfil.id)
  if (!opcoes.length) return null
  const ir = (s: RequestStatus) => {
    if (s === 'cancelled' && !confirm('Cancelar esta solicitação?')) return
    executar(() => mudarStatus(db, perfil.id, r, s))
  }
  return (
    <Cartao titulo="Andamento">
      <div className="flex flex-wrap gap-2">
        {opcoes.map((s) => (
          <button key={s} disabled={ocupado || !!bloqueio?.[s]} title={bloqueio?.[s]} onClick={() => ir(s)}
            className={s === 'cancelled' ? 'btn' : 'btn-primario'}>
            {rotuloDaAcao(r.status, s)}
          </button>
        ))}
      </div>
      {opcoes.map((s) => bloqueio?.[s] && <p key={s} className="mt-2 text-xs text-slate-500">{bloqueio[s]}</p>)}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}

// Linha do tempo do pedido. A imobiliária lê só os logs "agency" dela (regras: auditLogs).
export function Historico({ r, interno, pessoa }: { r: Request; interno: boolean; pessoa: (uid: string) => string }) {
  const q = useColecao<AuditLog>(`historico:${r.id}:${interno}`, () => interno
    ? query(collection(db, 'auditLogs'), where('entityId', '==', r.id), orderBy('timestamp', 'desc'))
    : query(collection(db, 'auditLogs'), where('agencyId', '==', r.agencyId), where('visibility', '==', 'agency'),
      where('entityId', '==', r.id), orderBy('timestamp', 'desc')))
  return (
    <Cartao titulo="Histórico">
      <Estado r={q}>
        {q.dados?.length ? (
          <ol className="space-y-3 text-sm">
            {q.dados.map((l) => (
              <li key={l.id} className="border-l-2 border-slate-200 pl-3">
                <p>{descrever(l)}</p>
                {typeof l.after?.nota === 'string' && <p className="whitespace-pre-wrap text-slate-600">“{l.after.nota}”</p>}
                <p className="text-xs text-slate-500">{pessoa(l.userId)} · {quando(l.timestamp)}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-slate-500">Sem movimentações ainda.</p>}
      </Estado>
    </Cartao>
  )
}

function descrever(l: AuditLog) {
  if (l.action.startsWith('status:')) {
    const s = l.action.slice(7) as RequestStatus
    const build = typeof l.after?.build === 'string' ? ` (build ${l.after.build})` : ''
    return `${ROTULO_STATUS[s] ?? s}${build}`
  }
  if (l.action === 'production_input:set') {
    const de = typeof l.before?.readingVersion === 'number' ? `v${l.before.readingVersion} → ` : ''
    return `Entrada da planta: ${de}v${l.after?.readingVersion}`
  }
  return l.action
}
