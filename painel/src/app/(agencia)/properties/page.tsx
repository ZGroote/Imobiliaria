'use client'
import { useIdioma } from '@/components/Idioma'

import { Pagina } from '@/components/AppShell'
import { ListaDeImoveis } from '@/components/imovel'
import { CarregarMais, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { imoveisDa } from '@/lib/listas'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import type { Property } from '@/lib/types'
import { usePaginada } from '@/lib/useFirestore'

// O corretor vê os imóveis da imobiliária; o gerente cuida do cadastro.
export default function Imoveis() {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const r = usePaginada<Property>(`imoveis:${perfil.agencyId}`, () => imoveisDa(db, perfil.agencyId ?? ''))
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  return (
    <Pagina titulo={tr("Empreendimentos")} sub={tr("Apresentações, acessos e vendas. O cadastro dos empreendimentos é preparado pela equipe Conecta.")}>
      <Estado r={r}>
        <ListaDeImoveis imoveis={r.dados ?? []} base="/properties" nomeDoCorretor={(uid) => nome(uid, perfil.id)} />
      </Estado>
      <CarregarMais r={r} />
    </Pagina>
  )
}
