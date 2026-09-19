# Versão 1.0 — ponto de entrada

Piloto aprovado: Castanheiras, Colinas e Cedros, em São Carlos.
Preço: **Sob consulta**. Aviso: **Localização aproximada, ainda não confirmada**.

- [Plano de organização e produto](plan.md)
- [Checklist de execução](todo.md)
- [Experimentos de melhoria](experimentos.md)
- [Configuração do piloto](piloto.json)
- [Verificação da primeira base](verificacao-dev.1.md)

## Comandos existentes

```powershell
npm test
npm run test:py
python pipeline/preparar_piloto.py
python -m http.server 8765 --bind 127.0.0.1 --directory releases/1.0.0-dev.1
```

Abra `http://127.0.0.1:8765/`. O preparador gera os três tours e uma cópia montada
do mapa completo, leva os tiles necessários e registra hashes num manifesto. O
diretório de destino precisa ser novo; para outra conferência use `--destino`.
O código-fonte continua no renderizador atual; a pasta da release é saída gerada.

Na sessão de criação, a porta 8765 já estava ocupada e foi usada a 8871:
`http://127.0.0.1:8871/`. O servidor escuta somente em `127.0.0.1`.

Verificação dos três links no Chrome isolado:

```powershell
node tests/browser_piloto.mjs http://127.0.0.1:8871/ tasks/v1.0/evidencias
```

`1.0.0-dev.1` é a primeira base de desenvolvimento, não uma aprovação da versão
estável. Previews reais de compartilhamento, quatro modos completos, QA integral,
offline e validação nos celulares estão explicitamente pendentes no checklist.

Não confundir a versão `1.0.0` já existente no `package.json` com uma release do
produto validada. O estado do piloto está no manifesto e neste plano.
