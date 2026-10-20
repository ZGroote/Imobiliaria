'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { collection, orderBy, query } from 'firebase/firestore'
import { Pagina } from '@/components/AppShell'
import { Aviso, Estado, Selo, Tabela, Td, useAcao, Vazio } from '@/components/ui'
import { criarAgencia } from '@/lib/agencias'
import { db } from '@/lib/firebase'
import { quando } from '@/lib/formato'
import { usePerfil } from '@/lib/session'
import { ROTULO_TIPO_DE_CONTA, TIPOS_DE_CONTA, tipoDaConta, type Agency, type TipoDeConta } from '@/lib/types'
import { useColecao } from '@/lib/useFirestore'

export default function Agencias() {
  const perfil = usePerfil()
  const r = useColecao<Agency>('agencias', () => query(collection(db, 'agencies'), orderBy('name')))
  const admin = perfil.role === 'platform_admin'
  return (
    <Pagina titulo="Imobiliárias" sub="Clientes do painel. Desativar bloqueia o uso, sem apagar nada.">
      {admin && <NovaAgencia />}
      <Estado r={r}>
        {r.dados?.length ? (
          <Tabela cabecalho={['Nome', 'Tipo', 'Situação', 'Atualizada']}>
            {r.dados.map((a) => (
              <tr key={a.id}>
                <Td><Link href={`/admin/agencies/view?id=${a.id}`} className="font-medium hover:underline">{a.name}</Link></Td>
                <Td>{ROTULO_TIPO_DE_CONTA[tipoDaConta(a)]}</Td>
                <Td>{a.active ? <Selo tom="verde">Ativa</Selo> : <Selo>Desativada</Selo>}</Td>
                <Td>{quando(a.updatedAt)}</Td>
              </tr>
            ))}
          </Tabela>
        ) : <Vazio>Nenhuma imobiliária cadastrada.</Vazio>}
      </Estado>
    </Pagina>
  )
}

function NovaAgencia() {
  const { executar, ocupado, erro } = useAcao()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoDeConta>('imobiliaria')
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (await executar(() => criarAgencia(db, nome, tipo))) setNome('')
  }
  return (
    <form onSubmit={enviar} className="mb-6 flex flex-wrap items-end gap-2">
      <label className="text-sm">Nova conta
        <input value={nome} onChange={(e) => setNome(e.target.value)} required className="campo mt-1 w-72" />
      </label>
      <label className="text-sm">Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeConta)} className="campo mt-1">
          {TIPOS_DE_CONTA.map((t) => <option key={t} value={t}>{ROTULO_TIPO_DE_CONTA[t]}</option>)}
        </select>
      </label>
      <button disabled={ocupado} className="btn-primario">Cadastrar</button>
      {erro && <Aviso>{erro}</Aviso>}
    </form>
  )
}
