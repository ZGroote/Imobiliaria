'use client'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { ListaDeImoveis } from '@/components/imovel'
import { CarregarMais, Estado } from '@/components/ui'
import { db } from '@/lib/firebase'
import { imoveisDa } from '@/lib/listas'
import { usePessoas } from '@/lib/usePessoas'
import { usePerfil } from '@/lib/session'
import { tipoDaConta, type Agency, type Property } from '@/lib/types'
import { useDoc, usePaginada } from '@/lib/useFirestore'

// D4: o corretor vê todos os imóveis da imobiliária; cadastro é da equipe interna.
export default function Imoveis() {
  const perfil = usePerfil()
  const r = usePaginada<Property>(`imoveis:${perfil.agencyId}`, () => imoveisDa(db, perfil.agencyId ?? ''))
  const { nome } = usePessoas(perfil.agencyId, perfil.role === 'agency_manager')
  const conta = useDoc<Agency>(perfil.agencyId ? `conta:${perfil.agencyId}` : null, () => doc(db, 'agencies', perfil.agencyId!))
  const construtora = conta.dado ? tipoDaConta(conta.dado) === 'construtora' : false
  return (
    <Pagina titulo={construtora ? 'Empreendimentos' : 'Imóveis'} sub="Para cadastrar um imóvel novo, abra uma solicitação.">
      <Estado r={r}>
        <ListaDeImoveis imoveis={r.dados ?? []} base="/properties" nomeDoCorretor={(uid) => nome(uid, perfil.id)} />
      </Estado>
      <CarregarMais r={r} />
    </Pagina>
  )
}
