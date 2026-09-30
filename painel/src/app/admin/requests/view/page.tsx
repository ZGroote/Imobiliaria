'use client'
import { useState } from 'react'
import Link from 'next/link'
import { collection, doc, query, where, type Timestamp } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { DadosDoPedido, EditarPedido, ROTULO_PRIORIDADE } from '@/components/pedido'
import { AcoesDeStatus, Historico } from '@/components/status'
import { PreviewEmRevisao, RegistrarPreview } from '@/components/aprovacao'
import { RegistrarPublicacao } from '@/components/publicacao'
import { Aviso, Cartao, ComId, Estado, Selo, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { ESTADOS_ENTRADA, exigeEntrada, fixarEntrada, listarVersoes, type PropertyReading } from '@/lib/leituras'
import { editarPedidoInterno, salvarNotaInterna } from '@/lib/pedidos'
import { usePerfil } from '@/lib/session'
import type { Property, Request } from '@/lib/types'
import { useCatalogoInterno } from '@/lib/useEquipe'
import { useColecao, useDoc } from '@/lib/useFirestore'

export default function VerSolicitacaoInterno() {
  return <ComId>{(id) => <Solicitacao id={id} />}</ComId>
}

function Solicitacao({ id }: { id: string }) {
  const r = useDoc<Request>(`pedido:${id}`, () => doc(db, 'requests', id))
  const cat = useCatalogoInterno()
  const [editando, setEditando] = useState(false)
  const p = r.dado
  // o imóvel do pedido, ao vivo: os cartões de preview e de publicação dependem dele
  const im = useDoc<Property>(p?.propertyId ? `imovel:${p.propertyId}` : null, () => doc(db, 'properties', p!.propertyId!))
  const imovel = p?.propertyId && im.dado ? im.dado : undefined
  if (p === null) return <Pagina titulo="Solicitação"><Aviso>Solicitação não encontrada.</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? 'Solicitação'} sub={p && cat.agencia(p.agencyId)}
      acoes={p && !editando && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {editando ? <EditarPedido r={p} fechar={() => setEditando(false)} /> : (
              <DadosDoPedido r={p} pessoa={cat.pessoa(p.requestedBy)}
                imovel={p.propertyId
                  ? <Link href={`/admin/properties/view?id=${p.propertyId}`} className="hover:underline">{cat.imovel(p.propertyId)}</Link>
                  : 'Não vinculado'}
                extra={[['Responsável interno', cat.pessoa(p.assignedTo)]]} />
            )}
            <div className="space-y-6">
              <AcoesDeStatus r={p} bloqueio={exigeEntrada(p, imovel)
                ? { production: 'Fixe a entrada da planta antes de iniciar a produção.' } : undefined} />
              {p.propertyId && <EntradaDaPlanta p={p} pessoa={cat.pessoa} />}
              <PreviewEmRevisao r={p} pessoa={cat.pessoa} />
              <RegistrarPublicacao r={p} imovel={imovel} />
              <RegistrarPreview r={p} imovel={imovel} />
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
  // Seletor: todos os imóveis DESTA imobiliária (a busca por prefixo, para imobiliária grande, é outro PR).
  const imoveis = useColecao<Property>(`imoveis-da:${p.agencyId}`,
    () => query(collection(db, 'properties'), where('agencyId', '==', p.agencyId)))
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
          <select disabled={ocupado || !!p.preview} value={p.propertyId ?? ''}
            onChange={(e) => salvar({ propertyId: e.target.value })} className="campo mt-1">
            <option value="">Não vinculado</option>
            {imoveis.dados?.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </label>
        {/* As regras travam o mesmo: o build é de uma unidade e não pode ir para outra. */}
        {p.preview && (
          <p className="text-xs text-slate-500">
            Travado: o build de revisão <code>{p.preview.build}</code> foi gerado para este imóvel. Para outro imóvel,
            abra uma nova solicitação.
          </p>
        )}
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </Cartao>
  )
}

// M1-E: qual snapshot da planta é a entrada da produção deste pedido. Não é aprovação da planta:
// aprovar continua sendo do build 3D. Trocar é explícito e auditado; salvar uma versão nova não muda nada aqui.
function EntradaDaPlanta({ p, pessoa }: { p: Request; pessoa: (uid: string) => string }) {
  const perfil = usePerfil()
  const { executar, ocupado, erro } = useAcao()
  const [versoes, setVersoes] = useState<PropertyReading[] | null>(null)
  const [escolhida, setEscolhida] = useState('')
  const atual = p.productionInput
  const lida = useDoc<PropertyReading>(atual ? `leitura:${atual.readingId}` : null,
    () => doc(db, 'propertyReadings', atual!.readingId))
  const pode = ESTADOS_ENTRADA.includes(p.status)
  const listar = (antes?: number) => executar(async () => {
    const lote = await listarVersoes(db, p.propertyId!, p.agencyId, antes)
    setVersoes((v) => antes === undefined ? lote : [...(v ?? []), ...lote])
  })
  const v = versoes?.find((x) => x.id === escolhida)
  const fixar = () => v && executar(async () => {
    await fixarEntrada(db, perfil.id, p, v)
    setVersoes(null); setEscolhida('')
  })
  return (
    <Cartao titulo="Entrada da planta">
      <div className="space-y-3 text-sm">
        {atual ? (
          <div data-entrada={atual.readingId}>
            <p><strong>Atual: v{atual.readingVersion}</strong> · revisão {atual.readingRevision} · leitura <code>{atual.readingId.slice(0, 8)}…</code></p>
            <p className="break-all">SHA-256: <code>{atual.contentSha256}</code></p>
            {lida.dado && <p className="text-slate-600">Criada por {lida.dado.createdByName} em {quando(lida.dado.createdAt)}</p>}
            <p className="text-xs text-slate-500">Fixada por {pessoa(atual.fixedBy)} em {quando(atual.fixedAt)}</p>
          </div>
        ) : <p className="text-slate-600">Nenhuma versão fixada.</p>}
        {!pode && <p className="text-xs text-slate-500">Só dá para escolher com o pedido Aceito ou Em produção.</p>}
        {pode && !versoes && (
          <button className="btn" disabled={ocupado} onClick={() => listar()}>
            {atual ? 'Escolher outra versão' : 'Escolher versão'}
          </button>
        )}
        {pode && versoes && (
          <div className="space-y-2">
            {!versoes.length && <p className="text-slate-600">Este imóvel ainda não tem versões salvas da planta.</p>}
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {versoes.map((x) => (
                <li key={x.id}>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="versao" value={x.id} checked={escolhida === x.id}
                      onChange={() => setEscolhida(x.id)} className="mt-1" />
                    <span>
                      <strong>v{x.version}</strong> · revisão {x.revision} · {x.createdByName} · {quando(x.createdAt)}
                      {' '}· <code>{x.contentSha256.slice(0, 12)}…</code>
                      {atual?.readingId === x.id && <> · <Selo tom="verde">fixada</Selo></>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {versoes.length > 0 && versoes.length % 50 === 0 && (
              <button className="btn" disabled={ocupado} onClick={() => listar(versoes.at(-1)!.version)}>Mais antigas</button>
            )}
            <p className="rounded bg-amber-50 p-2 text-amber-900">
              Esta versão será a entrada do próximo processo de produção. Alterações posteriores na planta não mudam
              esta seleção automaticamente.
            </p>
            <div className="flex gap-2">
              <button className="btn-primario" disabled={ocupado || !v || v.id === atual?.readingId} onClick={fixar}>
                {v ? `Fixar v${v.version} como entrada` : 'Fixar como entrada'}
              </button>
              <button className="btn" disabled={ocupado} onClick={() => { setVersoes(null); setEscolhida('') }}>Cancelar</button>
            </div>
          </div>
        )}
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
