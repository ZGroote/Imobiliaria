'use client'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { SENHA_DEV, USUARIOS_DEV } from '@/lib/dev'
import { ROTULO_PAPEL } from '@/lib/types'

// Só no emulador: entra com as contas fictícias do seed, que não existem no projeto real.
export default function AtalhosDev() {
  return (
    <div className="mt-8 border-t border-dashed border-slate-300 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Emulador: entrar como</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {USUARIOS_DEV.map((u) => (
          <button key={u.uid} className="btn text-xs"
            onClick={() => signInWithEmailAndPassword(auth, u.email, SENHA_DEV)}>
            {u.name.replace(' (dev)', '')} · {ROTULO_PAPEL[u.role]}
          </button>
        ))}
      </div>
    </div>
  )
}
