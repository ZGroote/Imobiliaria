// Contas que só existem no EMULADOR (scripts/seed.mjs). Nenhuma existe no projeto real.
// Agências fictícias (D6): nenhum nome de imobiliária real.
export const SENHA_DEV = 'senha-do-emulador'

export const AGENCIAS_DEV = [
  { id: 'agA', name: 'Imobiliária Fictícia A (dev)', slug: 'ficticia-a' },
  { id: 'agB', name: 'Imobiliária Fictícia B (dev)', slug: 'ficticia-b' },
]

export const USUARIOS_DEV = [
  { uid: 'admin', email: 'admin@painel.test', name: 'Admin (dev)', role: 'platform_admin' },
  { uid: 'op', email: 'operador@painel.test', name: 'Operador (dev)', role: 'operator' },
  { uid: 'gerA', email: 'gerente.a@painel.test', name: 'Gerente A (dev)', role: 'agency_manager', agencyId: 'agA' },
  { uid: 'corA', email: 'corretor.a@painel.test', name: 'Corretor A (dev)', role: 'agent', agencyId: 'agA' },
  { uid: 'gerB', email: 'gerente.b@painel.test', name: 'Gerente B (dev)', role: 'agency_manager', agencyId: 'agB' },
] as const
