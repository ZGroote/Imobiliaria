'use client'
import { useState } from 'react'
import Link from 'next/link'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { DadosDoPedido, EditarPedido } from '@/components/pedido'
import { Aviso, ComId, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import { editavelPelaImobiliaria } from '@/lib/status'
import type { Property, Request } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export default function VerSolicitacao() {
  return <ComId>{(id) => <Solicitacao id={id} />}</ComId>
}

function Solicitacao({ id }: { id: string }) {
  const perfil = usePerfil()
  const r = useDoc<Request>(`pedido:${id}`, () => doc(db, 'requests', id))
  const p = r.dado
  const im = useDoc<Property>(p?.propertyId ? `imovel:${p.propertyId}` : null, () => doc(db, 'properties', p!.propertyId!))
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  const [editando, setEditando] = useState(false)

  if (p === null) return <Pagina titulo="Solicitação"><Aviso>Solicitação não encontrada.</Aviso></Pagina>
  const podeEditar = p && editavelPelaImobiliaria(p.status)
    && (perfil.role === 'agency_manager' || p.requestedBy === perfil.id)
  return (
    <Pagina titulo={p?.title ?? 'Solicitação'}
      acoes={podeEditar && !editando && <button className="btn" onClick={() => setEditando(true)}>Editar</button>}>
      <Estado r={r}>
        {p && (
          <div className="grid gap-6 lg:grid-cols-2">
            {editando ? <EditarPedido r={p} fechar={() => setEditando(false)} /> : (
              <DadosDoPedido r={p} pessoa={nome(p.requestedBy, perfil.id)}
                imovel={im.dado ? <Link href={`/properties/view?id=${im.dado.id}`} className="hover:underline">{im.dado.title}</Link>
                  : p.propertyId ? '…' : 'Ainda não cadastrado'} />
            )}
          </div>
        )}
      </Estado>
    </Pagina>
  )
}
