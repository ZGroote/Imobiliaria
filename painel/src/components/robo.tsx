'use client'
import { useEffect, useState } from 'react'
import { Aviso, Cartao, Selo, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { cancelarJob, cancelavel, jobAtivo, jobsDoPedido, motivoDoJob, pedidosDePrevia, pedirPreviaAoRobo, ROTULO_ETAPA, ROTULO_JOB,
  situacaoDoRobo, TOM_JOB } from '@/lib/robo'
import { usePerfil } from '@/lib/session'
import type { AuditLog, BuildJob, Request } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

const PASSO: Record<string, string> = {
  build: 'montando o 3D', channel: 'subindo no canal de prévia', check_channel: 'conferindo o canal',
  register: 'registrando a prévia', state: 'lendo o site no ar', assemble: 'montando o site', deploy: 'publicando',
  check_live: 'conferindo o site no ar',
}
const ha = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h`
}

// O robô neste pedido (só a equipe): os trabalhos dele, ao vivo, os pedidos que a equipe faz a ele e
// os avisos da m2-worker.md §9, calculados do pedido e dos jobs (valem depois de recarregar a página).
// O motivo de um trabalho que parou aparece em português; a imobiliária não vê nada disto.
export function CartaoDoRobo({ r }: { r: Request }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 15_000); return () => clearInterval(t) }, [])
  const jobs = useColecao<BuildJob>(`jobs:${r.id}`, () => jobsDoPedido(db, r.id))
  const previas = useColecao<AuditLog>(`previas:${r.id}`, () => pedidosDePrevia(db, r.id))
  const lista = [...(jobs.dados ?? [])].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
  const ativo = lista.find(jobAtivo)
  const { esperando, avisos } = situacaoDoRobo(r, lista, previas.dados ?? [], agora)
  if (!lista.length && r.status !== 'production' && !esperando && !avisos.length) return null
  return (
    <Cartao titulo="Robô">
      <div className="space-y-3 text-sm">
        {(jobs.erro || previas.erro) && <Aviso>{jobs.erro ?? previas.erro}</Aviso>}
        {!lista.length && !esperando && <p className="text-slate-600">O robô ainda não trabalhou neste pedido.</p>}
        {esperando && <p className="rounded bg-sky-50 p-2 text-sky-900">{esperando}</p>}
        {avisos.map((a) => <p key={a} className="rounded bg-amber-50 p-2 text-amber-900">{a}</p>)}
        <ul className="space-y-3">
          {lista.slice(0, 3).map((j) => {
            const motivo = j.status === 'succeeded' ? null : motivoDoJob(j)
            return (
              <li key={j.id} data-job={j.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Selo tom={TOM_JOB[j.status]}>{ROTULO_JOB[j.status]}</Selo>
                  <span>{(j.stage && ROTULO_ETAPA[j.stage]) ?? 'Build manual'}</span>
                  {j.status === 'running' && j.step && <span className="text-slate-500">· {PASSO[j.step] ?? j.step}</span>}
                  <span className="text-xs text-slate-500">{quando(j.createdAt)}</span>
                </div>
                {j.status === 'running' && j.heartbeatAt && (
                  <p className="text-xs text-slate-500">Último sinal de vida {ha(agora - j.heartbeatAt.toMillis())}</p>
                )}
                {j.cancelRequested && jobAtivo(j) && <p className="text-xs text-slate-500">Cancelamento pedido.</p>}
                {jobAtivo(j) && !j.cancelRequested && !cancelavel(j) && (
                  <p className="text-xs text-slate-500">O deploy já começou: não dá mais para cancelar.</p>
                )}
                {motivo && <p className="text-amber-800">{motivo}</p>}
                {j.build && <p className="text-xs text-slate-500">Build <code>{j.build}</code></p>}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {r.status === 'production' && !ativo && (
            <button className="btn-primario" disabled={ocupado || !!esperando}
              onClick={() => executar(() => pedirPreviaAoRobo(db, perfil.id, r))}>Gerar prévia</button>
          )}
          {ativo && cancelavel(ativo) && (
            <button className="btn" disabled={ocupado}
              onClick={() => confirm('Cancelar este trabalho do robô?') && executar(() => cancelarJob(db, perfil.id, ativo))}>
              Cancelar
            </button>
          )}
        </div>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Cartao>
  )
}
