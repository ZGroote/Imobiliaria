// Mensagens do Firebase em português. O que não está aqui aparece com o código original.
const AUTH: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Já existe acesso com este e-mail. Use "Já tenho acesso".',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com o servidor.',
}

export function mensagemDoAuth(e: unknown) {
  const code = (e as { code?: string }).code ?? ''
  return AUTH[code] ?? `Não foi possível concluir (${code || (e as Error).message}).`
}

// Negado pelas regras: o painel mostra, não esconde.
export function mensagemDoFirestore(e: unknown) {
  const code = (e as { code?: string }).code ?? ''
  if (code === 'permission-denied') return 'Sem permissão para esta ação.'
  return `Não foi possível salvar (${code || (e as Error).message}).`
}
