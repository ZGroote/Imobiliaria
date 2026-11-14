import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REGIOES, validarRegiao, moeda } from '../src/lib/regiao.ts'
import { contatoPublico } from '../src/lib/perfil.ts'
import { contactAddress, validateOpening } from '../../rastreabilidade/public/runtime.mjs'
import { mensagemConvite } from '../../emails/config.mjs'

test('região: moeda não converte montantes e fuso inválido é recusado', () => {
  assert.equal(moeda(12345, REGIOES.US), '$123.45')
  assert.match(moeda(12345, REGIOES.BR), /123,45/)
  assert.equal(validarRegiao(REGIOES.GB).currency, 'GBP')
  assert.throws(() => validarRegiao({ ...REGIOES.US, currency: 'INVALID' }))
  assert.throws(() => validarRegiao({ ...REGIOES.US, timeZone: 'Mars/Test' }))
})

test('contato explícito exige código internacional e não transforma telefone estrangeiro em brasileiro', () => {
  assert.deepEqual(contatoPublico('sms', '+1 (212) 555-0100'), { sms: '12125550100' })
  assert.deepEqual(contatoPublico('email', ' Agent@example.com '), { email: 'agent@example.com' })
  assert.deepEqual(contatoPublico('whatsapp', '+44 20 7946 0100'), { whatsapp: '442079460100' })
  assert.equal(contatoPublico('', ''), null)
  assert.throws(() => contatoPublico('sms', '2125550100'))
  assert.throws(() => contatoPublico('email', 'a@x.test\nBcc:other@x.test'))
})

test('SMS/e-mail levam o sublink atribuído, sem recibo ou identificador da sessão', () => {
  const token = 'b'.repeat(32), current = `https://imoveis.test/acesso.html?l=${'a'.repeat(32)}&pagina=maquete`
  const opening = { propertyTitle: 'Development A', shareToken: token, smsNumber: '12125550100', contactEmail: 'agent@example.com', locale: 'en' }
  for (const channel of ['sms','email']) {
    const address = contactAddress(channel, current, opening)
    assert.ok(address)
    assert.match(decodeURIComponent(address!), new RegExp(token))
    assert.match(decodeURIComponent(address!), /Hello!/)
    assert.doesNotMatch(address!, /receipt|visitId/)
  }
  assert.equal(contactAddress('sms', current, { ...opening, smsNumber: 'javascript:alert(1)' }), null)
  assert.equal(contactAddress('email', current, { ...opening, contactEmail: 'a@x.test\nBcc:other@x.test' }), null)
  assert.throws(() => validateOpening({ contactEmail: 'bad\n@x.test' }, 'https://imoveis.test'))
})

test('convite em inglês leva à entrada em inglês e mantém português como padrão', () => {
  const c = { email: 'agent@example.com', name: 'Agent', role: 'agent' }
  assert.match(mensagemConvite({ ...c, locale: 'en' }).text, /\?lang=en/)
  assert.match(mensagemConvite({ ...c, locale: 'en' }).subject, /invitation/)
  assert.match(mensagemConvite(c).subject, /convite/)
})
