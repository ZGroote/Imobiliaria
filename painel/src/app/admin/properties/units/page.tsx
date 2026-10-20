'use client'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, ComId, Estado } from '@/components/ui'
import { EstoqueEmpreendimento } from '@/components/EstoqueEmpreendimento'
import { db } from '@/lib/firebase'
import { useDoc } from '@/lib/useFirestore'
import { tipoDaConta, type Agency, type Property } from '@/lib/types'
export default function Unidades() { return <ComId>{id => /^[A-Za-z0-9_-]{1,128}$/.test(id) ? <EstoqueDoImovel id={id} /> : <Aviso>Identificador inválido.</Aviso>}</ComId> }
function EstoqueDoImovel({ id }: { id: string }) {
  const r = useDoc<Property>(`imovel-estoque:${id}`, () => doc(db, 'properties', id))
  const ag = useDoc<Agency>(r.dado ? `agencia:${r.dado.agencyId}` : null, () => doc(db, 'agencies', r.dado!.agencyId))
  // As regras recusam escrita no estoque de conta que não é construtora; a tela nem oferece.
  const tipo = ag.dado ? tipoDaConta(ag.dado) : undefined
  return <Pagina titulo="Unidades do empreendimento" sub={r.dado?.title}
    acoes={<a className="btn" href={`/admin/properties/view?id=${encodeURIComponent(id)}`}>Voltar ao imóvel</a>}>
    <Estado r={r}>{!r.dado ? <Aviso>Imóvel não encontrado.</Aviso>
      : tipo === 'construtora' ? <EstoqueEmpreendimento key={id} property={r.dado} />
      : tipo ? <Aviso>Unidades e disponibilidade são só de conta construtora. Este imóvel é de uma imobiliária.</Aviso>
      : null}</Estado>
  </Pagina>
}
