'use client'
import { useState, type FormEvent } from 'react'
import { Pagina } from '@/components/AppShell'
import { Aviso, Cartao, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { salvarPerfil } from '@/lib/perfil'
import { usePerfil } from '@/lib/session'

export default function MeuPerfil() {
  const perfil = usePerfil()
  const [name, setName] = useState(perfil.name)
  const [whatsapp, setWhatsapp] = useState(perfil.publicContact?.whatsapp ?? '')
  const [salvo, setSalvo] = useState(false)
  const { executar, ocupado, erro } = useAcao()
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSalvo(await executar(() => salvarPerfil(db, perfil.id, name, whatsapp)))
  }
  return (
    <Pagina titulo="Meu perfil" sub="Seu nome e o WhatsApp usado no atendimento dos seus links.">
      <div className="max-w-xl">
        <Cartao titulo="Dados de contato">
          <form onSubmit={enviar} onChange={() => setSalvo(false)} className="space-y-4">
            <label className="block text-sm">Nome
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="campo mt-1" />
            </label>
            <div className="text-sm"><p>E-mail de acesso</p><p className="mt-1 text-slate-500">{perfil.email}</p></div>
            <label className="block text-sm">Celular / WhatsApp
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} type="tel" autoComplete="tel"
                placeholder="(16) 99999-0000" aria-describedby="whatsapp-ajuda" className="campo mt-1" />
            </label>
            <p id="whatsapp-ajuda" className="text-sm text-slate-500">
              Inclua o DDD. Para outro país, comece com + e o código do país. Este número será público nos seus links
              e receberá as conversas pelo WhatsApp. Deixe vazio para retirar o contato.
            </p>
            <button disabled={ocupado} className="btn-primario">{ocupado ? 'Salvando…' : 'Salvar perfil'}</button>
            {erro && <Aviso>{erro}</Aviso>}
            {salvo && <p role="status" className="text-sm text-emerald-700">Perfil salvo. Novas aberturas dos seus links usarão este contato.</p>}
          </form>
        </Cartao>
      </div>
    </Pagina>
  )
}
