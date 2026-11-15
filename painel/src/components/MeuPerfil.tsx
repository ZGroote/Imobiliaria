'use client'
import { useIdioma } from '@/components/Idioma'

import { useState, type FormEvent } from 'react'
import { Pagina } from '@/components/AppShell'
import { Aviso, Cartao, useAcao } from '@/components/ui'
import { db } from '@/lib/firebase'
import { salvarContato } from '@/lib/perfil'
import { usePerfil } from '@/lib/session'

export default function MeuPerfil() {
  const { t: tr } = useIdioma()

  const perfil = usePerfil()
  const [name, setName] = useState(perfil.name)
  const atual = perfil.publicContact
  const [canal, setCanal] = useState<'whatsapp' | 'sms' | ''>(atual?.sms ? 'sms' : atual?.whatsapp ? 'whatsapp' : '')
  const [contato, setContato] = useState(atual?.sms ? '+' + atual.sms : atual?.whatsapp ? '+' + atual.whatsapp : '')
  const [emailPublico, setEmailPublico] = useState(atual?.email ?? '')
  const [salvo, setSalvo] = useState(false)
  const { executar, ocupado, erro } = useAcao()
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSalvo(await executar(() => salvarContato(db, perfil.id, name, canal, contato, emailPublico)))
  }
  return (
    <Pagina titulo={tr("Meu perfil")} sub={tr("Seu contato público nos links de apresentação.")}>
      <div className="max-w-xl">
        <Cartao titulo={tr("Dados de contato")}>
          <form onSubmit={enviar} onChange={() => setSalvo(false)} className="space-y-4">
            <label className="block text-sm">{tr("Nome")}<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="campo mt-1" />
            </label>
            <div className="text-sm"><p>{tr("E-mail de acesso")}</p><p className="mt-1 text-slate-500">{perfil.email}</p></div>
            <label className="block text-sm">{tr("Canal de atendimento")}<select aria-label={tr("Canal de atendimento")} className="campo mt-1" value={canal} onChange={e => { setCanal(e.target.value as typeof canal); setContato('') }}>
              <option value="">{tr("Sem contato por telefone")}</option><option value="whatsapp">{tr("WhatsApp")}</option><option value="sms">{tr("SMS")}</option>
            </select></label>
            {canal && <label className="block text-sm">{tr("Telefone internacional")}
              <input value={contato} onChange={e => setContato(e.target.value)} type="tel" autoComplete="tel"
                placeholder="+1 212 555 0100" aria-describedby="contato-ajuda" className="campo mt-1" />
            </label>}
            <label className="block text-sm">{tr('E-mail público')}<input className="campo mt-1" type="email" value={emailPublico} onChange={e => setEmailPublico(e.target.value)} placeholder="agent@example.com" /></label>
            <p id="contato-ajuda" className="text-sm text-slate-500">{tr("Inclua + e o código do país. Este contato será público nos seus links.")}</p>
            <button disabled={ocupado} className="btn-primario">{ocupado ? tr("Salvando…") : tr("Salvar perfil")}</button>
            {erro && <Aviso>{erro}</Aviso>}
            {salvo && <p role="status" className="text-sm text-emerald-700">{tr("Perfil salvo. Novas aberturas dos seus links usarão este contato.")}</p>}
          </form>
        </Cartao>
      </div>
    </Pagina>
  )
}
