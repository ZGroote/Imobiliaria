import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { idDoConvite } from './convite.ts'
import { interno, type UserRole } from './types.ts'

// Tudo aqui é de platform_admin (regras: invites e users). Papel interno não tem agência;
// papel de imobiliária tem uma que existe. As regras conferem as duas coisas (validMembership).

export interface NovoConvite { email: string; name: string; role: UserRole; agencyId?: string; agencyName?: string }

export function convidar(db: Firestore, adminUid: string, c: NovoConvite) {
  const email = idDoConvite(c.email), name = c.name.trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.')
  if (!name) throw new Error('Informe o nome.')
  const deAgencia = !interno(c.role)
  if (deAgencia && !c.agencyId) throw new Error('Escolha a imobiliária.')
  return setDoc(doc(db, 'invites', email), {
    email, name, role: c.role,
    ...(deAgencia ? { agencyId: c.agencyId, ...(c.agencyName ? { agencyName: c.agencyName } : {}) } : {}),
    createdBy: adminUid, createdAt: serverTimestamp(),
  })
}

export const cancelarConvite = (db: Firestore, email: string) => deleteDoc(doc(db, 'invites', idDoConvite(email)))

export function mudarPapel(db: Firestore, uid: string, role: UserRole, agencyId?: string) {
  if (!interno(role) && !agencyId) throw new Error('Papel de imobiliária precisa de uma imobiliária.')
  return updateDoc(doc(db, 'users', uid), {
    role, agencyId: interno(role) ? deleteField() : agencyId, updatedAt: serverTimestamp(),
  })
}

// Vale na hora: as regras leem users/{uid} a cada acesso (D3).
export const definirAtivo = (db: Firestore, uid: string, active: boolean) =>
  updateDoc(doc(db, 'users', uid), { active, updatedAt: serverTimestamp() })
