import {test} from 'node:test'
import assert from 'node:assert/strict'
import {enderecoCanonico, ORIGEM_PAINEL, VERIFICACAO_EMAIL} from '../src/lib/endereco.ts'

test('links antigos do painel preservam rota, consulta e fragmento no domínio próprio', () => {
  for (const host of ['imobilaria-deccb-painel.web.app', 'imobilaria-deccb-painel.firebaseapp.com']) {
    assert.equal(enderecoCanonico(`https://${host}/admin/properties/view?id=liv%2F1#links`),
      'https://painel.conectaimoveis3d.com.br/admin/properties/view?id=liv%2F1#links')
  }
})

test('domínio atual, emulador e hosts parecidos não geram redirecionamento', () => {
  for (const url of [ORIGEM_PAINEL+'/login', 'http://localhost:3000/login',
    'https://imobilaria-deccb-painel.web.app.evil.test/login',
    'https://imobilaria-deccb-painel.web.app:8443/login']) assert.equal(enderecoCanonico(url), null)
  assert.equal(VERIFICACAO_EMAIL.url, 'https://painel.conectaimoveis3d.com.br/login')
})
