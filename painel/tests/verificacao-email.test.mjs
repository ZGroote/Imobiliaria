import {test, before, after} from 'node:test'
import assert from 'node:assert/strict'
import {applyActionCode, sendEmailVerification} from 'firebase/auth'
import {semear} from '../scripts/seed.mjs'
import {novaConta, sairDeTodos} from './apoio.ts'
import {EMULADOR} from '../src/lib/ambiente.ts'
import {VERIFICACAO_EMAIL} from '../src/lib/endereco.ts'

before(semear)
after(sairDeTodos)

test('confirmação do cadastro mantém o retorno no domínio próprio e valida o e-mail no SDK', async () => {
  const {auth} = await novaConta('verificacao-dominio@painel.test')
  const user = auth.currentUser
  await sendEmailVerification(user, VERIFICACAO_EMAIL)
  const response = await fetch(`${EMULADOR.auth}/emulator/v1/projects/${EMULADOR.projectId}/oobCodes`)
  const {oobCodes} = await response.json()
  const code = oobCodes.findLast(c => c.email === user.email && c.requestType === 'VERIFY_EMAIL')
  assert.equal(new URL(code.oobLink).searchParams.get('continueUrl'), 'https://painel.conectaimoveis3d.com.br/login')
  assert.equal(user.emailVerified, false)
  await applyActionCode(auth, code.oobCode)
  await user.reload()
  assert.equal(user.emailVerified, true)
})
