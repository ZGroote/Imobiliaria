export const DOMINIO = 'conectaimoveis3d.com.br'
export const PAINEL = 'https://painel.conectaimoveis3d.com.br/login'
export const CAIXAS = ['avisos', 'contato', 'diretoria'].map(nome => ({
  email_address: `${nome}@${DOMINIO}`,
  name: `Conecta Imóveis 3D — ${nome}`,
  from_name: 'Conecta Imóveis 3D',
}))
export const REMETENTE = `Diretoria Conecta Imóveis 3D <diretoria@${DOMINIO}>`
export const RESPOSTAS = `diretoria@${DOMINIO}`
export const LIMITE_DIARIO = 90

const PAPEIS = ['platform_admin', 'operator', 'agency_manager', 'agent']
export function mensagemConvite(convite) {
  if (typeof convite.email !== 'string' || convite.email.length > 254
      || !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(convite.email)) throw new Error('E-mail inválido.')
  if (typeof convite.name !== 'string' || !convite.name.trim() || convite.name.length > 120
      || /[\x00-\x1f\x7f]/.test(convite.name) || !PAPEIS.includes(convite.role)) throw new Error('Convite inválido.')
  return {
    from: REMETENTE, to: [convite.email], reply_to: RESPOSTAS,
    subject: 'Seu convite para o painel Conecta Imóveis 3D',
    text: `Você recebeu um convite para acessar o painel administrativo da Conecta Imóveis 3D.\n\nAbra ${PAINEL} e escolha "Primeiro acesso" usando este mesmo endereço de e-mail. Crie sua senha, confirme o e-mail pelo link que receberá e aceite o convite no painel.\n\nSe você já tem uma conta, entre com sua senha para aceitar o convite.\n\nDúvidas? Responda a esta mensagem.\n\nDiretoria\nConecta Imóveis 3D`,
  }
}
