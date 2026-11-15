'use client'
import { useIdioma } from '@/components/Idioma'

import { useState } from 'react'
import Link from 'next/link'
import { collection, doc, query, where } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, CarregarMais, Cartao, ComId, Estado, Selo, Tabela, Td, useAcao, Vazio } from '@/components/ui'
import { atualizarAgencia } from '@/lib/agencias'
import { db } from '@/lib/firebase'
import { imoveisDa } from '@/lib/listas'
import { usePerfil } from '@/lib/session'
import { ROTULO_PAPEL, type Agency, type Property, type User } from '@/lib/types'
import { useColecao, useDoc, usePaginada } from '@/lib/useFirestore'
import { RegiaoDaAgencia } from '@/components/RegiaoDaAgencia'

export default function VerAgencia() {
  return <ComId>{(id) => <Agencia id={id} />}</ComId>
}

function Agencia({ id }: { id: string }) {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const admin = perfil.role === 'platform_admin'
  const a = useDoc<Agency>(`agencia:${id}`, () => doc(db, 'agencies', id))
  const imoveis = usePaginada<Property>(`imoveis-da:${id}`, () => imoveisDa(db, id))
  const pessoas = useColecao<User>(`pessoas-da:${id}`,
    () => query(collection(db, 'users'), where('agencyId', '==', id)))
  const { executar, ocupado, erro } = useAcao()
  const [nome, setNome] = useState<string | null>(null)

  if (a.dado === null) return <Pagina titulo={tr("Imobiliária")}><Aviso>Imobiliária não encontrada.</Aviso></Pagina>
  const ag = a.dado
  return (
    <Pagina titulo={ag?.name ?? tr("Imobiliária")}
      sub={ag && (ag.active ? <Selo tom="verde">{tr("Ativa")}</Selo> : <Selo>{tr("Desativada")}</Selo>)}
      acoes={admin && ag && (
        <button disabled={ocupado} className="btn" onClick={() => executar(() => atualizarAgencia(db, id, { active: !ag.active }))}>
          {ag.active ? tr("Desativar") : tr("Reativar")}
        </button>)}>
      <Estado r={a}>
        <div className="space-y-6">
          {erro && <Aviso>{erro}</Aviso>}
          {admin && ag && <RegiaoDaAgencia key={ag.id} agencia={ag} />}
          {admin && ag && (
            <Cartao titulo={tr("Nome")}>
              <div className="flex flex-wrap gap-2">
                <input value={nome ?? ag.name} onChange={(e) => setNome(e.target.value)} className="campo w-80" />
                <button disabled={ocupado || nome === null || nome === ag.name} className="btn"
                  onClick={async () => { if (await executar(() => atualizarAgencia(db, id, { name: nome! }))) setNome(null) }}>{tr("Salvar")}</button>
              </div>
            </Cartao>
          )}
          <Cartao titulo={tr("Imóveis")}>
            <Estado r={imoveis}>
              {imoveis.dados?.length ? (
                <ul className="space-y-1 text-sm">
                  {imoveis.dados.map((p) => (
                    <li key={p.id}><Link href={`/admin/properties/view?id=${p.id}`} className="hover:underline">{p.title}</Link></li>
                  ))}
                </ul>
              ) : <Vazio>{tr("Nenhum imóvel.")}</Vazio>}
            </Estado>
            <CarregarMais r={imoveis} />
          </Cartao>
          <Cartao titulo={tr("Pessoas")}>
            <Estado r={pessoas}>
              {pessoas.dados?.length ? (
                <Tabela cabecalho={[tr("Nome"), tr("E-mail"), tr("Papel"), tr("Situação")]}>
                  {pessoas.dados.map((u) => (
                    <tr key={u.id}>
                      <Td>{u.name}</Td><Td>{u.email}</Td><Td>{tr(ROTULO_PAPEL[u.role])}</Td>
                      <Td>{u.active ? <Selo tom="verde">{tr("Ativo")}</Selo> : <Selo>{tr("Desativado")}</Selo>}</Td>
                    </tr>
                  ))}
                </Tabela>
              ) : <Vazio>{tr("Ninguém desta imobiliária ainda. Convites em Usuários e convites.")}</Vazio>}
            </Estado>
          </Cartao>
        </div>
      </Estado>
    </Pagina>
  )
}
