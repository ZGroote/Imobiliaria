// A chave fica no servidor. Erros do provedor não expõem corpos de mensagens nem credenciais.
export class ErroResend extends Error {
  constructor(status, codigo = 'request_failed') {
    super(`Resend: ${codigo} (HTTP ${status}).`)
    this.status = status
    this.codigo = codigo
    this.repetir = [408, 409, 429].includes(status) || status >= 500
  }
}

export function clienteResend(chave, requisitar = fetch) {
  if (typeof chave !== 'string' || !/^re_[a-zA-Z0-9_]+$/.test(chave)) throw new Error('Configure RESEND_API_KEY no servidor.')
  return async (metodo, caminho, corpo, idempotencia) => {
    if (!/^\/(emails|domains|inboxes)(\/[-a-zA-Z0-9]+)?(\?[-a-zA-Z0-9=&]+)?$/.test(caminho)) throw new Error('Rota Resend inválida.')
    const r = await requisitar(`https://api.resend.com${caminho}`, {
      method: metodo,
      headers: {Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json',
        ...(idempotencia ? {'Idempotency-Key': idempotencia} : {})},
      ...(corpo === undefined ? {} : {body: JSON.stringify(corpo)}),
      signal: AbortSignal.timeout(15000),
    })
    const dados = await r.json().catch(() => ({}))
    if (!r.ok) throw new ErroResend(r.status, /^[a-z_]+$/.test(dados.name) ? dados.name : 'request_failed')
    return dados
  }
}
