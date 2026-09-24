'use client'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { CorretorResponsavel, Dados, LinksPublicos } from '@/components/imovel'
import { HistoricoDePublicacoes } from '@/components/publicacao'
import { Aviso, Cartao, ComId, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import type { Property } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'

export default function VerImovel() {
  return <ComId>{(id) => <Imovel id={id} />}</ComId>
}

function Imovel({ id }: { id: string }) {
  const perfil = usePerfil()
  const gerente = perfil.role === 'agency_manager'
  const r = useDoc<Property>(`imovel:${id}`, () => doc(db, 'properties', id))
  const { pessoas, nome } = usePessoas(perfil.agencyId, gerente)
  const p = r.dado
  if (p === null) return <Pagina titulo="Imóvel"><Aviso>Imóvel não encontrado.</Aviso></Pagina>
  return (
    <Pagina titulo={p?.title ?? 'Imóvel'}>
      <Estado r={r}>
        {p && (
          <div className="grid gap-6 lg:grid-cols-2">
            <LinksPublicos p={p} />
            <Dados p={p} />
            {gerente ? <CorretorResponsavel p={p} pessoas={pessoas} />
              : <Cartao titulo="Corretor responsável"><p className="text-sm">{nome(p.assignedAgentId, perfil.id)}</p></Cartao>}
            {/* quem publica é sempre a equipe interna (platform_admin) */}
            <HistoricoDePublicacoes p={p} interno={false} pessoa={() => 'Equipe interna'} basePedido="/requests" />
          </div>
        )}
      </Estado>
    </Pagina>
  )
}
