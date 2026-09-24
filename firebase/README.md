# Firebase — o que vai em cada arquivo

| Arquivo | Versiona? | O que é |
|---|---|---|
| `firestore.rules` | sim | autorização do Firestore: `users/{uid}` é a fonte de papel e agência (proposta §4). Publicada. |
| `storage.rules` | sim | só `request-assets/`; nada fora disso. No emulador até o bucket existir. |
| `firestore.indexes.json` | sim | os 9 índices compostos do painel. |
| `tests/regras.test.mjs` | sim | 28 testes das regras no emulador: `npm run test:regras` (JDK 21 no PATH). |
| `admin.js` | sim | Admin SDK para scripts de servidor (Fase 2: `tools/buildjob.mjs`). Ignora as regras. |
| `service-account.json` | **NUNCA** | chave privada de admin. Ignora TODAS as regras. Vazou = projeto comprometido. |

A config do app web (pública por natureza) fica em `painel/.env.production`.

Deploy sempre com escopo. O `firebase.json` da raiz reúne Firestore, Storage e o Hosting do mapa;
um `firebase deploy` sem `--only` publicaria tudo:

```bash
npx firebase deploy --only firestore:rules --project imobilaria-deccb
```

Se `service-account.json` for parar no repositório (que é público), revogue a chave no Console
(Configurações do projeto → Contas de serviço → Gerenciar chaves) antes de qualquer outra coisa.
