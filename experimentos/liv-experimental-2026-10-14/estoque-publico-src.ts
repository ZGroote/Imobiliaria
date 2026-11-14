// Entrada compilada; Firebase Auth e operações de escrita não entram no leitor público.
import { initializeApp, deleteApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, doc, collection, onSnapshot, terminate } from 'firebase/firestore'
import { MODELO_LARANJEIRAS, ehModeloEstoque, validarEstoque, validarLista, validarInformacoes, validarVagas, resolverInformacoes, type Estoque, type UnidadeVenda, type PerfilVenda } from '../../painel/src/lib/estoque-modelo.ts'

export { resolverInformacoes }
export function validarConfig(input: unknown, search = '', hostname = '') {
  const c = input as { schema?: string; mode?: string; model?: unknown; propertyId?: string | null; firebase?: { apiKey?: string; projectId?: string; appId?: string }; emulatorPort?: number }
  if (c?.schema !== 'liv-sales-config-v1' || !['firebase', 'emulador', 'desativado'].includes(c.mode ?? '')) throw Error('Configuração do estoque inválida.')
  const model = c.model === undefined ? 'liv-ipanema' : c.model
  if (!ehModeloEstoque(model)) throw Error('Modelo do estoque inválido.')
  const id = model === MODELO_LARANJEIRAS && c.mode === 'firebase' ? c.propertyId : new URLSearchParams(search).get('estoque') ?? c.propertyId
  if (c.mode === 'desativado' || !id) return null
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !c.firebase?.apiKey || !/^[a-z][a-z0-9-]{4,62}$/.test(c.firebase.projectId ?? '')) throw Error('Identificador do estoque inválido.')
  if (c.mode === 'emulador' && (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) || c.firebase.projectId !== 'demo-painel' ||
    !Number.isInteger(c.emulatorPort) || c.emulatorPort! < 1024 || c.emulatorPort! > 65535)) throw Error('Emulador permitido somente em teste local.')
  if (c.mode === 'firebase' && c.firebase.projectId?.startsWith('demo-')) throw Error('Projeto de teste não pode usar produção.')
  return { id, model, mode: c.mode, options: c.firebase as { apiKey: string; projectId: string; appId?: string }, emulatorPort: c.emulatorPort }
}
export function validarSnapshot(settings: unknown, units: UnidadeVenda[], profiles: PerfilVenda[], parking: unknown = { spaces: {} }) {
  const stock = validarEstoque(settings)
  validarLista(units, stock.model)
  if (profiles.length !== 2 || new Set(profiles.map(p => p.id)).size !== 2 || profiles.some(p => !['canto', 'meio'].includes(p.id))) throw Error('Faltam as duas plantas do cadastro.')
  const checked = profiles.map(p => ({ ...p, info: validarInformacoes(p.info) }))
  // Mapa de vagas malformado some sozinho; não derruba a disponibilidade.
  let spaces: Record<string, string> = {}
  if (stock.model !== MODELO_LARANJEIRAS) {
    try { spaces = validarVagas(parking) } catch { /* sem vagas */ }
  }
  return { settings: stock, units, profiles: checked, parking: spaces }
}
type Snapshot = ReturnType<typeof validarSnapshot>
export function assinarEstoque(config: NonNullable<ReturnType<typeof validarConfig>>, receive: (s: Snapshot | null) => void,
  notice: (message: string, clear?: boolean) => void) {
  const app = initializeApp(config.options, `liv-stock-${config.id}-${Math.random().toString(36).slice(2)}`), db = getFirestore(app)
  if (config.mode === 'emulador') connectFirestoreEmulator(db, '127.0.0.1', config.emulatorPort!)
  const hasParking = config.model !== MODELO_LARANJEIRAS
  let stopped = false, fingerprint = '', childStops: (() => void)[] = []
  let settings: Estoque | null = null, units: UnidadeVenda[] | null = null, profiles: PerfilVenda[] | null = null, parking: unknown = null
  const fresh = { settings: false, units: false, profiles: false, parking: !hasParking }
  const error = (e: { code?: string }) => {
    if (stopped) return
    const denied = e.code === 'permission-denied'
    if (denied) { fingerprint = ''; receive(null) }
    notice(denied ? 'Consulta de disponibilidade desabilitada ou sem permissão.' : 'Não foi possível atualizar a disponibilidade. Confirme com a equipe responsável.', denied)
  }
  function apply() {
    if (stopped || !settings?.publicEnabled || !units || !profiles || (hasParking && !parking)) return
    if (!Object.values(fresh).every(Boolean)) { notice('Sem confirmação atual do servidor. Disponibilidade sujeita a confirmação.'); return }
    try {
      const s = validarSnapshot(settings, units, profiles, parking)
      const key = JSON.stringify([settings.revision, units.map(u => [u.id, u.revision]), profiles.map(p => [p.id, p.revision]), (parking as { revision?: number } | null)?.revision ?? 0])
      // Metadata changes clear an offline notice even when the records did not change.
      if (key !== fingerprint) { fingerprint = key; receive(s) }
      notice('')
    } catch { notice('Cadastro incompleto ou inconsistente. Confirme a disponibilidade com a equipe responsável.') }
  }
  const parent = doc(db, 'salesInventory', config.id)
  function stopChildren() { childStops.forEach(stop => stop()); childStops = []; units = null; profiles = null; parking = null; fresh.units = false; fresh.profiles = false; fresh.parking = !hasParking }
  const stopParent = onSnapshot(parent, { includeMetadataChanges: true }, snapshot => {
    if (stopped) return
    try {
      settings = snapshot.exists() ? validarEstoque(snapshot.data()) : null
      if (settings && settings.model !== config.model) throw Error('Modelo do estoque divergente.')
    } catch {
      settings = null; stopChildren(); fingerprint = ''; receive(null)
      notice('Cadastro incompleto ou inconsistente. Confirme a disponibilidade com a equipe responsável.', true)
      return
    }
    fresh.settings = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
    if (!settings?.publicEnabled) {
      stopChildren(); fingerprint = ''; receive(null); notice('Disponibilidade ainda não publicada pelo responsável.'); return
    }
    if (!childStops.length) {
      childStops.push(onSnapshot(collection(parent, 'units'), { includeMetadataChanges: true }, s => {
        units = s.docs.map(d => ({ ...d.data(), id: d.id })) as UnidadeVenda[]
        fresh.units = !s.metadata.fromCache && !s.metadata.hasPendingWrites; apply()
      }, error))
      childStops.push(onSnapshot(collection(parent, 'profiles'), { includeMetadataChanges: true }, s => {
        profiles = s.docs.map(d => ({ ...d.data(), id: d.id })) as PerfilVenda[]
        fresh.profiles = !s.metadata.fromCache && !s.metadata.hasPendingWrites; apply()
      }, error))
      // Sem documento ainda = nenhuma vaga ligada. As vagas são complemento: falhar ao lê-las
      // (regras antigas, por exemplo) não pode esconder a disponibilidade.
      if (hasParking) childStops.push(onSnapshot(doc(parent, 'parking', 'mapa'), { includeMetadataChanges: true }, s => {
        parking = s.exists() ? s.data() : { spaces: {} }
        fresh.parking = !s.metadata.fromCache && !s.metadata.hasPendingWrites; apply()
      }, () => { if (!stopped) { parking = { spaces: {} }; fresh.parking = true; apply() } }))
    }
    apply()
  }, error)
  const online = () => { if (!stopped) { if (!navigator.onLine) notice('Sem conexão. A disponibilidade exibida pode estar desatualizada.'); else apply() } }
  window.addEventListener('offline', online); window.addEventListener('online', online)
  return async () => {
    if (stopped) return; stopped = true; stopParent(); stopChildren()
    window.removeEventListener('offline', online); window.removeEventListener('online', online)
    await terminate(db); await deleteApp(app)
  }
}
