'use client'
import { useIdioma } from '@/components/Idioma'

import { useState } from 'react'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDeImoveis } from '@/components/imovel'
import { NovoImovel } from '@/components/CadastroImovel'
import { CarregarMais, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { imoveisDa } from '@/lib/listas'
import type { Agency, Property } from '@/lib/types'
import { useNomes } from '@/lib/useEquipe'
import { useColecao, usePaginada } from '@/lib/useFirestore'

export default function ImoveisInterno() {
  const { t: tr } = useIdioma()

  const [agencia, setAgencia] = useState('')
  const agencias = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const imoveis = usePaginada<Property>(`imoveis:${agencia}`, () => imoveisDa(db, agencia || undefined))
  const { pessoa: nomeDoCorretor } = useNomes()   // só os corretores das linhas na tela
  const nomeDaAgencia = (id: string) => agencias.dados?.find((a) => a.id === id)?.name ?? id

  return (
    <Pagina titulo={tr("Imóveis")} sub={tr("Todos os imóveis das imobiliárias. A ficha completa mora no pipeline.")}
      acoes={
        <select value={agencia} onChange={(e) => setAgencia(e.target.value)} className="campo w-64">
          <option value="">Todas as imobiliárias</option>
          {agencias.dados?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      }>
      <div className="space-y-6">
        <NovoImovel agencias={(agencias.dados ?? []).filter((a) => a.active)} />
        <Estado r={imoveis}>
          <ListaDeImoveis imoveis={imoveis.dados ?? []} base="/admin/properties"
            nomeDaAgencia={nomeDaAgencia} nomeDoCorretor={nomeDoCorretor} />
        </Estado>
        <CarregarMais r={imoveis} />
      </div>
    </Pagina>
  )
}
