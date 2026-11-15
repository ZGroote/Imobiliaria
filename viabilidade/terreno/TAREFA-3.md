# Tarefa 3 do Terreno — reprodução com tolerância nos arquivos intermediários

Galho `ci/viabilidade-testes` (já está nele). Mexa **só** em `viabilidade/terreno/testar_pilotos.py`. Não mude scripts geradores, dados, motor, workflow nem `conferir.py`. Não commite.

## Contexto (autorizado pelo usuário em 15/11)

No CI Linux (`.github/workflows/viabilidade.yml`), a reprodução `testar_pilotos.py --reproduzir` regenera tudo, mas 4 arquivos saem com diferença só na última casa decimal (~1e-9 m), por diferença de ponto flutuante entre Windows e Linux, mesmo com as mesmas versões de numpy/shapely/pyproj/Pillow:

- `dados/eixo-contiguidade.json`, `dados/eixo-posicionamento.json`, `dados/novo-z2.json` (ex.: `306.17611633938986` → `306.17611633811845`; `area_uniao_m2` 1599.1079206769725 → 1599.1079206749205)
- `dados/z2-componentes.png`

Os arquivos principais (`lotes-piloto.json`, `dados/anotacoes-zonas.json`, `dados/relevo-pilotos.json` e os demais) saíram **idênticos** e devem continuar comparados **byte a byte**.

## O que fazer

1. Em `--reproduzir`, separar dois grupos:
   - **byte a byte** (como hoje): todos os arquivos verificados, exceto os 4 acima;
   - **com tolerância**: os 3 JSONs comparados como estrutura. Mesmas chaves, mesmos tipos, strings e inteiros iguais, e floats com `abs(a-b) <= 1e-6` (1 micrômetro em metros; vale também pra m² e graus? confira as unidades dos campos e diga no relatório se 1e-6 serve pra todos). O PNG comparado pelos pixels decodificados (mesmo tamanho; diga qual diferença máxima de pixel aceitou e por quê), sem dependência nova (Pillow já é usada pelos scripts).
2. Se o arquivo intermediário mudar **além** da tolerância, o teste falha dizendo **qual arquivo, qual campo e a diferença**.
3. O teste tem que pegar adulteração: prove mudando um float em 1e-3 em um dos JSONs (cópia temporária), e um byte num arquivo principal. Os dois têm que falhar. Deixe essa prova como função de autoteste no próprio arquivo (rodada sempre, sem tocar nos arquivos versionados).
4. Rode aqui: `python -I -X utf8 viabilidade/terreno/testar_pilotos.py --reproduzir`. Deve passar e não deixar arquivo modificado (`git status --short viabilidade/terreno` vazio).

## Relatório

`viabilidade/terreno/RELATORIO-3.md`, até 10 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 3 pronta"`.
