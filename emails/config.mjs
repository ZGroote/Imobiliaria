export const DOMINIO = 'conectaimoveis3d.com'
export const PAINEL = 'https://painel.conectaimoveis3d.com.br/login'
export const CAIXAS = ['noreply', 'contact', 'team'].map(nome => ({
  email_address: `${nome}@${DOMINIO}`,
  name: `Conecta Imóveis 3D — ${nome}`,
  from_name: 'Conecta Imóveis 3D',
}))
export const REMETENTE = `Conecta Imóveis 3D <team@${DOMINIO}>`
export const RESPOSTAS = `team@${DOMINIO}`
export const LIMITE_DIARIO = 90

const PAPEIS = ['platform_admin', 'operator', 'agency_manager', 'agent']
export function mensagemConvite(convite) {
  if (typeof convite.email !== 'string' || convite.email.length > 254
      || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(convite.email)) throw new Error('E-mail inválido.')
  if (typeof convite.name !== 'string' || !convite.name.trim() || convite.name.length > 120
      || /[\x00-\x1f\x7f]/.test(convite.name) || !PAPEIS.includes(convite.role)) throw new Error('Convite inválido.')
  return {
    from: REMETENTE, to: [convite.email], reply_to: RESPOSTAS,
    subject: convite.locale === 'en' ? 'Your invitation to Conecta Imóveis 3D' : 'Seu convite para o painel Conecta Imóveis 3D',
    text: convite.locale === 'en'
      ? `You have been invited to the Conecta Imóveis 3D dashboard.\n\nOpen ${PAINEL}?lang=en and select "First-time access" using this email address. Create your password, follow the verification email link, then accept your invitation in the dashboard.\n\nAlready have an account? Sign in with your password to accept the invitation.\n\nQuestions? Reply to this email.\n\nConecta Imóveis 3D`
      : `Você recebeu um convite para acessar o painel administrativo da Conecta Imóveis 3D.\n\nAbra ${PAINEL} e escolha "Primeiro acesso" usando este mesmo endereço de e-mail. Crie sua senha, confirme o e-mail pelo link que receberá e aceite o convite no painel.\n\nSe você já tem uma conta, entre com sua senha para aceitar o convite.\n\nDúvidas? Responda a esta mensagem.\n\nDiretoria\nConecta Imóveis 3D`,
  }
}
