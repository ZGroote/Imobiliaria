'use client'
import { doc } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, ComId, Estado } from '@/components/ui'
import { EstoqueEmpreendimento } from '@/components/EstoqueEmpreendimento'
import { db } from '@/lib/firebase'
import { useDoc } from '@/lib/useFirestore'
import type { Property } from '@/lib/types'
export default function Unidades() { return <ComId>{id => /^[A-Za-z0-9_-]{1,128}$/.test(id) ? <EstoqueDoImovel id={id} /> : <Aviso>Identificador inválido.</Aviso>}</ComId> }
function EstoqueDoImovel({ id }: { id: string }) {
  const r = useDoc<Property>(`imovel-estoque:${id}`, () => doc(db, 'properties', id))
  return <Pagina titulo="Unidades do empreendimento" sub={r.dado?.title}
    acoes={<a className="btn" href={`/admin/properties/view?id=${encodeURIComponent(id)}`}>Voltar ao imóvel</a>}>
    <Estado r={r}>{r.dado ? <EstoqueEmpreendimento key={id} property={r.dado} /> : <Aviso>Imóvel não encontrado.</Aviso>}</Estado>
  </Pagina>
}
