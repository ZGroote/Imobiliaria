'use client'
import { useIdioma } from '@/components/Idioma'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, Estado, Selo, Tabela, Td, useAcao, Vazio } from '@/components/ui'
import { criarAgencia } from '@/lib/agencias'
import { db } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import type { Agency } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function Agencias() {
  const { t: tr, dataHora: quando } = useIdioma()

  const perfil = usePerfil()
  const r = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const admin = perfil.role === 'platform_admin'
  return (
    <Pagina titulo={tr("Imobiliárias")} sub={tr("Clientes do painel. Desativar bloqueia o uso, sem apagar nada.")}>
      {admin && <NovaAgencia />}
      <Estado r={r}>
        {r.dados?.length ? (
          <Tabela cabecalho={[tr("Nome"), tr("Situação"), tr("Atualizada")]}>
            {r.dados.map((a) => (
              <tr key={a.id}>
                <Td><Link href={`/admin/agencies/view?id=${a.id}`} className="font-medium hover:underline">{a.name}</Link></Td>
                <Td>{a.active ? <Selo tom="verde">{tr("Ativa")}</Selo> : <Selo>{tr("Desativada")}</Selo>}</Td>
                <Td>{quando(a.updatedAt)}</Td>
              </tr>
            ))}
          </Tabela>
        ) : <Vazio>{tr("Nenhuma imobiliária cadastrada.")}</Vazio>}
      </Estado>
    </Pagina>
  )
}

function NovaAgencia() {
  const { t: tr } = useIdioma()

  const { executar, ocupado, erro } = useAcao()
  const [nome, setNome] = useState('')
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (await executar(() => criarAgencia(db, nome))) setNome('')
  }
  return (
    <form onSubmit={enviar} className="mb-6 flex flex-wrap items-end gap-2">
      <label className="text-sm">{tr("Nova imobiliária")}<input value={nome} onChange={(e) => setNome(e.target.value)} required className="campo mt-1 w-72" />
      </label>
      <button disabled={ocupado} className="btn-primario">{tr("Cadastrar")}</button>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  )
}
