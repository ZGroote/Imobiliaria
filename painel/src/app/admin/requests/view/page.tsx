'use client'
import { useState } from 'react'
import Link from 'next/link'
import { doc, type Timestamp } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { DadosDoPedido, EditarPedido, ROTULO_PRIORIDADE } from '@/components/pedido'
import { AcoesDeStatus, Historico } from '@/components/status'
import { PreviewEmRevisao, RegistrarPreview } from '@/components/aprovacao'
import { Aviso, Cartao, ComId, Estado, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { editarPedidoInterno, salvarNotaInterna } from '@/lib/pedidos'
import { usePerfil } from '@/lib/session'
import type { Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { useDoc } from '@/lib/useFirestore'

export default function VerSolicitacaoInterno() {
  return <ComId>{(id) => <Solicitacao id={id} />}</ComId>
}

function Solicitacao({ id }: { id: string }) {
  const r = useDoc<Request>(`pedido:${id}`, () => doc(db, 'requests', id))
  const cat = useCatalogoInterno()
  const [editando, setEditando] = useState(false)
  const p = r.dado
  if (p === null) return <Pagina titulo="Solicitação"><Aviso>Solicitação não encontrada.</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? 'Solicitação'} sub={p && cat.agencia(p.agencyId)}
      acoes={p && !editando && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid gap-6 lg:grid-cols-2">
            {editando ? <EditarPedido r={p} fechar={() => setEditando(false)} /> : (
              <DadosDoPedido r={p} pessoa={cat.pessoa(p.requestedBy)}
                imovel={p.propertyId
                  ? <Link href={`/admin/properties/view?id=${p.propertyId}`} className="hover:underline">{cat.imovel(p.propertyId)}</Link>
                  : 'Não vinculado'}
                extra={[['Responsável interno', cat.pessoa(p.assignedTo)]]} />
            )}
            <div className="space-y-6">
              <AcoesDeStatus r={p} />
              <PreviewEmRevisao r={p} pessoa={cat.pessoa} />
              <RegistrarPreview r={p} imovel={cat.imoveis.find((i) => i.id === p.propertyId)} />
              <Producao p={p} cat={cat} />
            </div>
            <NotaInterna rid={p.id} />
            <Historico r={p} interno pessoa={cat.pessoa} />
          </div>
        )}
      </Estado>
    </Pagina>
  )
}

// Campos que só a equipe mexe. O imóvel vinculado só pode ser da mesma imobiliária do pedido.
function Producao({ p, cat }: { p: Request; cat: ReturnType<typeof useCatalogoInterno> }) {
  const { executar, ocupado, erro } = useAcao()
  const salvar = (c: Parameters<typeof editarPedidoInterno>[2]) => executar(() => editarPedidoInterno(db, p.id, c))
  return (
    <Cartao titulo="Produção (equipe)">
      <div className="grid gap-3 text-sm">
        <label>Responsável interno
          <select disabled={ocupado} value={p.assignedTo ?? ''} onChange={(e) => salvar({ assignedTo: e.target.value })}
            className="campo mt-1">
            <option value="">Ninguém</option>
            {cat.internos.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>Prioridade
          <select disabled={ocupado} value={p.priority ?? ''} className="campo mt-1"
            onChange={(e) => salvar({ priority: (e.target.value || undefined) as Request['priority'] })}>
            <option value="">—</option>
            {Object.entries(ROTULO_PRIORIDADE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>Imóvel vinculado
          <select disabled={ocupado} value={p.propertyId ?? ''} onChange={(e) => salvar({ propertyId: e.target.value })}
            className="campo mt-1">
            <option value="">Não vinculado</option>
            {cat.imoveis.filter((i) => i.agencyId === p.agencyId).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Cartao>
  )
}

function NotaInterna({ rid }: { rid: string }) {
  const perfil = usePerfil()
  const nota = useDoc<{ id: string; text: string; updatedAt?: Timestamp }>(`nota:${rid}`,
    () => doc(db, 'requests', rid, 'internal', 'notes'))
  const [texto, setTexto] = useState<string | null>(null)
  const { executar, ocupado, erro } = useAcao()
  const atual = nota.dado?.text ?? ''
  return (
    <Cartao titulo="Notas internas (a imobiliária não vê)">
      <textarea rows={5} value={texto ?? atual} onChange={(e) => setTexto(e.target.value)} className="campo" />
      <div className="mt-2 flex items-center gap-3">
        <button disabled={ocupado || texto === null || texto === atual} className="btn"
          onClick={async () => { if (await executar(() => salvarNotaInterna(db, rid, perfil.id, texto!))) setTexto(null) }}>
          Salvar nota
        </button>
        {nota.dado && <span className="text-xs text-slate-500">Atualizada {quando(nota.dado.updatedAt)}</span>}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  )
}
