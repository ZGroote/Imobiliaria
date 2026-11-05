'use client'
import { useIdioma } from '@/components/Idioma'

import { doc } from 'firebase/firestore'
import { Pagina } from './AppShell'
import { Aviso, ComId, Estado } from './ui'
import { EstoqueEmpreendimento } from './EstoqueEmpreendimento'
import { podeEditarComercial } from '@/lib/acesso'
import { db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { useDoc } from '@/lib/useFirestore'
import type { Property } from '@/lib/types'

export function UnidadesDoImovel({ base }: { base: string }) {
  const { t: tr } = useIdioma()

  return <ComId>{id => /^[A-Za-z0-9_-]{1,128}$/.test(id) ? <EstoqueDoImovel id={id} base={base} /> : <Aviso>{tr("Identificador inválido.")}</Aviso>}</ComId>
}

function EstoqueDoImovel({ id, base }: { id: string; base: string }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const r = useDoc<Property>(`imovel-estoque:${id}`, () => doc(db, 'properties', id))
  return <Pagina titulo={tr("Unidades do empreendimento")} sub={r.dado?.title}
    acoes={<a className="btn" href={`${base}/view?id=${encodeURIComponent(id)}`}>{tr("Voltar ao imóvel")}</a>}>
    <Estado r={r}>{r.dado ? podeEditarComercial(perfil, r.dado.agencyId)
      ? <EstoqueEmpreendimento key={id} property={r.dado} /> : <Aviso>{tr("Sem permissão para alterar este cadastro.")}</Aviso>
      : <Aviso>{tr("Imóvel não encontrado.")}</Aviso>}</Estado>
  </Pagina>
}
