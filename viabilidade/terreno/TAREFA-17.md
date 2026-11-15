# Tarefa 17 do Terreno: reajustar os 4 anexos pelos cruzamentos de rua (ALTA, RELATORIO-16)

**Quem:** Claude Code (Visual), emprestado ao terreno. É a continuação da sua tarefa 16.
**Galho:** `viabilidade/lote-livre` (PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:**
- `viabilidade/terreno/`: código, testes e documentação;
- `viabilidade/terreno/dados/zonas-controles.json` e `dados/zonas-posicionamento.json`. Desta vez está liberado mexer nesses dois de `dados/`, e só neles.

**Não fazer:** não commitar; não tocar em motor, tela, relatório, `conferir.py`, nem nas imagens dos anexos.

## Por quê

O `RELATORIO-16.md` mostrou que os anexos 02, 05, 06 e 07 estão posicionados com erro de 40 a 75 m: ~44 m para leste, mais uma escala e uma rotação no eixo norte-sul. O cadastro e a malha batem com o OSM. A central viu a sobreposição (`c02p.png`) e confirmou: a Av. São Carlos e a Nove de Julho do OSM ficam meia quadra a oeste das do anexo.

O ajuste atual usa 5 vértices do perímetro, quase todos no sul e no oeste, e passa por 31983→29183 em modo "ballpark". A margem de 10 m (`DIVISA_M`) não cobre esse erro. Resultado: zona e área especial lidas no lote errado. O 74451, por exemplo, ganhou os 9 m do art. 80 sem estar na subárea.

Na sua ordem, isto é ALTA: precisa ser corrigido antes do merge do PR #124.

## O que fazer

1. **Novos controles.** Para cada anexo (02, 05, 06 e 07), use pelo menos 12 cruzamentos de ruas com nome, espalhados pelo quadro inteiro, incluindo o norte e o leste.
   - A coordenada vem do cadastro ou da malha, em 31983.
   - O pixel é o centro do cruzamento no anexo. Pode refinar automaticamente pelo cinza da rua, mas confira cada um num recorte e guarde os recortes na sua pasta temporária.
   - Os 5 vértices do perímetro podem ficar como verificação, não como ajuste.
2. **Transformação.** Use a afim direta 31983 → pixel, sem passar pelo SAD69 "ballpark". Se o código ou outro módulo precisar do SAD69 por outro motivo, diga onde.
   - Grave os resíduos por controle em `zonas-posicionamento.json`.
   - Mantenha a conferência que já existe, em que o loader refaz o ajuste e compara com o gravado.
   - Atualize o texto de `metodo` (`sugerir_zona.py:~156`) e os documentos que citam 3,53 m (`ZONA-AUTO.md` e outros que você achar).
3. **Margem.** A `DIVISA_M` e a margem de cada anexo (`areas_especiais.py:~99`) continuam ≥ o maior resíduo do anexo, nunca abaixo de 10 m.
4. **Cache.** Hoje a chave do cache de `subarea-06` e `cones-07` (e de qualquer outro contorno que dependa do posicionamento) só inclui a imagem e o `.py`. Inclua `zonas-controles.json` e `zonas-posicionamento.json` na chave, para o cache não servir posição velha.
5. **Teste que pega o erro.** Em `test_sugerir_zona.py`, ou no teste que já existir, coloque 8 cruzamentos de verificação que **não entram no ajuste**. Para cada um: nome, UTM e pixel de cada anexo. A afim de cada anexo tem que levar cada cruzamento ao pixel com erro de até 10 m. Com o ajuste antigo, esse teste tem que falhar; mostre isso.
6. **Efeitos.** Rode de novo e liste:
   - os 5 lotes da subárea (74451, 77015, 77022, 77375 e 80172): o 74451 deve sair fora. Atualize os testes da tarefa 14 que dependiam dele;
   - os pilotos: zona sugerida e áreas especiais, antes e depois. As zonas dos pilotos anotadas à mão não mudam;
   - o 75352 (antes Z2 decidido);
   - o ponto do Auditor `-21.985132, -47.885094` (cone do Anexo 07 e ressalva do 06): continua igual?
   - qualquer saída que o motor compare byte a byte e mude, dizendo onde e por quê.

## Testes

- `python -I -X utf8 viabilidade/terreno/novo_lote.py --testar`
- `python -I -X utf8 viabilidade/terreno/gerar_lotes.py --testar`
- os testes do terreno que existirem (`test_sugerir_zona.py`, `test_areas_especiais.py`, `test_cache.py`)
- `python -I -X utf8 viabilidade/motor/test_estudar.py`
- `python -I -X utf8 viabilidade/motor/test_varrer.py`
- `python -I -X utf8 viabilidade/conferir.py`: 8/8

## Relatório

`viabilidade/terreno/RELATORIO-17.md`, até 15 linhas, com a tabela de resíduos por anexo (antes e depois) e a lista de efeitos. Depois: `maestri ask "Claude Code" "Terreno tarefa 17 pronta"`.
