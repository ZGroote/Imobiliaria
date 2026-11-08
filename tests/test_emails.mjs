import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CAIXAS, mensagemConvite, PAINEL} from '../emails/config.mjs'
import {clienteResend} from '../emails/resend.mjs'

const convite = {email:'pessoa@example.com', name:'Maria', role:'agent'}
test('as três caixas usam o domínio próprio; convite sai e recebe respostas pela diretoria', () => {
  assert.deepEqual(CAIXAS.map(c => c.email_address), ['noreply', 'contact', 'team'].map(n => `${n}@conectaimoveis3d.com`))
  const m = mensagemConvite(convite)
  assert.equal(m.from, 'Conecta Imóveis 3D <team@conectaimoveis3d.com>')
  assert.equal(m.reply_to, 'team@conectaimoveis3d.com')
  assert.deepEqual(m.to, [convite.email])
  assert.equal(PAINEL, 'https://painel.conectaimoveis3d.com.br/login')
  assert.ok(m.text.includes(PAINEL))
  assert.ok(m.text.startsWith('Você recebeu um convite para acessar o painel administrativo da Conecta Imóveis 3D.\n\n'))
  assert.doesNotMatch(m.text, /\b(administrador|operador|gerente|corretor)\b|imobilaria-deccb-painel\.web\.app/)
  for (const role of ['platform_admin', 'operator', 'agency_manager', 'agent']) {
    assert.equal(mensagemConvite({...convite, role}).text, m.text)
  }
  assert.match(m.text, /Primeiro acesso/)
  assert.equal(m.html, undefined)
})
test('convites rejeitam destinatário, nome e papel malformados antes do envio', () => {
  for (const extra of [{email:'x@example.com\r\nBcc:a@b.com'}, {name:'Maria\nOutro'}, {role:'toString'}, {name:'x'.repeat(121)}]) {
    assert.throws(() => mensagemConvite({...convite,...extra}))
  }
})
test('envio REST mantém a mesma chave de idempotência e não inclui segredo no corpo', async () => {
  const chamadas=[]
  const api=clienteResend('re_teste', async (url,options) => {
    chamadas.push({url,options}); return Response.json({id:'mensagem-1'})
  })
  assert.equal((await api('POST','/emails',mensagemConvite(convite),'convite/123')).id,'mensagem-1')
  assert.equal(chamadas[0].url,'https://api.resend.com/emails')
  assert.equal(chamadas[0].options.headers['Idempotency-Key'],'convite/123')
  assert.ok(!chamadas[0].options.body.includes('re_teste'))
  await assert.rejects(api('GET','https://outro.example'), /Rota/)
})
test('erros transitórios podem repetir; erros permanentes não repetem nem vazam o retorno', async () => {
  for (const [status,repetir] of [[400,false],[401,false],[403,false],[409,true],[429,true],[500,true]]) {
    const api=clienteResend('re_teste',async () => Response.json({name:'validation_error',message:'segredo e dados pessoais'},{status}))
    await assert.rejects(api('POST','/emails',{}), e => e.repetir === repetir && !e.message.includes('segredo'))
  }
})
