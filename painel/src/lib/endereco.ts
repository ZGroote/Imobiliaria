export const ORIGEM_PAINEL = 'https://painel.conectaimoveis3d.com.br'
export const VERIFICACAO_EMAIL = { url: `${ORIGEM_PAINEL}/login` }

// Links já distribuídos mantêm caminho, consulta e fragmento ao mudar de domínio.
export function enderecoCanonico(href: string) {
  const atual = new URL(href)
  if (!['https://imobilaria-deccb-painel.web.app', 'https://imobilaria-deccb-painel.firebaseapp.com'].includes(atual.origin)) return null
  return `${ORIGEM_PAINEL}${atual.pathname}${atual.search}${atual.hash}`
}
