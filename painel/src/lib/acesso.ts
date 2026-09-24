import type { UserRole } from './types.ts'

// Quem entra em cada área do painel. É só navegação: quem autoriza de fato são as regras
// (firebase/firestore.rules). Uma tela liberada por engano mostraria "sem permissão", não dados.
export type Area = 'admin' | 'agencia'

export const PAPEIS_DA_AREA: Record<Area, UserRole[]> = {
  admin: ['platform_admin', 'operator'],
  agencia: ['agency_manager', 'agent'],
}

export const inicioDoPapel = (r: UserRole) => (PAPEIS_DA_AREA.admin.includes(r) ? '/admin' : '/dashboard')

export const pode = (r: UserRole, papeis: UserRole[]) => papeis.includes(r)
