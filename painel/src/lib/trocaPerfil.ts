import { signInWithEmailAndPassword, signOut, updateCurrentUser, type Auth } from 'firebase/auth'
import { doc, getDocFromServer, type Firestore } from 'firebase/firestore'

// Sem e-mail aqui: este arquivo vai no JS público do painel. O e-mail do gerente é lido do
// cadastro dele (users/{gerenteUid}) pela sessão do admin, na hora da troca.
export interface ParDeTeste { adminUid: string; gerenteUid: string; agencyId: string }
export const PAR_DE_TESTE: ParDeTeste = {
  adminUid: 'p63bbLQ26HX08vN0KD3qbP0yk9O2', gerenteUid: 'cj8qMDx3F3epgJ1Kpern6dvzKYM2', agencyId: 'SRBeethi2ltiOmKvENu9',
}
export const PAR_EMULADOR: ParDeTeste = { adminUid: 'admin', gerenteUid: 'gerA', agencyId: 'agA' }

export function criarTrocaDeTeste({ principal, administrador, gerente, bancoAdmin, bancoGerente, par }: {
  principal: Auth; administrador: Auth; gerente: Auth; bancoAdmin: Firestore; bancoGerente: Firestore; par: ParDeTeste
}) {
  async function validar(auth: Auth, db: Firestore, role: 'platform_admin' | 'agency_manager') {
    const uid = role === 'platform_admin' ? par.adminUid : par.gerenteUid
    if (auth.currentUser?.uid !== uid) throw Error('Entre primeiro na conta de teste correspondente.')
    await auth.currentUser.getIdToken(true)
    const p = (await getDocFromServer(doc(db, 'users', uid))).data()
    if (p?.active !== true || p.role !== role || (role === 'agency_manager' && p.agencyId !== par.agencyId))
      throw Error('A conta de teste não está ativa ou seu perfil foi alterado.')
  }
  return {
    async paraGerente(senha?: string) {
      if (principal.currentUser?.uid !== par.adminUid) throw Error('Troca disponível somente entre as contas de teste.')
      // A sessão original é copiada pelo SDK; nenhuma senha ou token é colocado em URLs.
      await updateCurrentUser(administrador, principal.currentUser)
      await validar(administrador, bancoAdmin, 'platform_admin')
      if (gerente.currentUser?.uid !== par.gerenteUid) {
        if (!senha) throw Error('Informe a senha da conta de gerente no primeiro acesso.')
        const email = (await getDocFromServer(doc(bancoAdmin, 'users', par.gerenteUid))).data()?.email
        if (typeof email !== 'string') throw Error('A conta de teste não está ativa ou seu perfil foi alterado.')
        await signInWithEmailAndPassword(gerente, email, senha)
      }
      try { await validar(gerente, bancoGerente, 'agency_manager') }
      catch (e) { await signOut(gerente); throw e }
      await updateCurrentUser(principal, gerente.currentUser)
    },
    async paraAdmin() {
      if (principal.currentUser?.uid !== par.gerenteUid) throw Error('Troca disponível somente entre as contas de teste.')
      await validar(administrador, bancoAdmin, 'platform_admin')
      await updateCurrentUser(principal, administrador.currentUser)
    },
    async encerrar() { await Promise.all([signOut(principal), signOut(administrador), signOut(gerente)]) },
  }
}
