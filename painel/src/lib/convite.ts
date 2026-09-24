import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import type { Invite } from './types.ts'

// O e-mail é o id do convite, sempre minúsculo, igual ao do token (regras: invites/{email}).
export const idDoConvite = (email: string) => email.trim().toLowerCase()

// Só funciona com o e-mail verificado: as regras exigem email_verified para ler o convite.
export async function lerConvite(db: Firestore, email: string): Promise<Invite | null> {
  const s = await getDoc(doc(db, 'invites', idDoConvite(email)))
  return s.exists() ? (s.data() as Invite) : null
}

// users/{uid} nasce do convite: papel e agência são os do convite, e as regras conferem.
export function aceitarConvite(db: Firestore, uid: string, convite: Invite) {
  return setDoc(doc(db, 'users', uid), {
    name: convite.name,
    email: convite.email,
    role: convite.role,
    ...(convite.agencyId ? { agencyId: convite.agencyId } : {}),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
