# Pacote físico preliminar: as peças juntas e conferidas (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `torre.py`, `para_vista.py` e `gerador.py` e nos testes deles: **não toque neles.** Você cria `pacote.py` e `test_pacote.py`. `sintese.py`, `sondagem.py` e `cargas.py` só se for indispensável; nesse caso, explique no relato.

## Problema

Hoje existem quatro peças soltas, cada uma com o próprio selo:
- a revisão;
- a avaliação, de `sintese.avaliar`;
- a sondagem, de `sondagem.py`;
- as cargas, de `cargas.py`.

Ninguém confere se as quatro falam da **mesma** revisão. Também não existe um resumo único que a tela (Visual) possa mostrar.

## O que fazer

1. **`pacote.montar(revisao, avaliacao, sondagem=None, cargas=None)`** devolve um pacote selado. Ele guarda só **referências** (id e sha de cada peça), nunca uma cópia delas. Cada peça vem com um estado:
   - `valida`;
   - `invalida`, com o motivo que a função de cada peça já dá (`avaliacao_valida`, `cargas_validas`, o selo da sondagem);
   - `ausente`.

   A sondagem é do lote, não da revisão: confira que o estudo e o lote dela batem com os da revisão. Se não baterem, ela é `invalida`, com motivo.
2. **`pacote_valido(pacote, revisao, avaliacao, sondagem, cargas)`:** confere o selo do pacote e cada referência, e devolve `(bool, motivos)`.
3. **`resumo(pacote, ...)`:** um dicionário pequeno para a tela, sem interpretação nova. Ele traz:
   - a síntese, a regra da precedência, os motivos de trava e o aviso, todos copiados da avaliação;
   - as cargas: a faixa por pavimento, o total e o aviso fixo de "não é carga na fundação";
   - a sondagem: número de furos, profundidade máxima e nível d'água como veio. Sem classificar o solo e sem nenhum número derivado além do N-SPT que já existe;
   - o estado de cada peça.

   Se a avaliação estiver inválida, o resumo **não** mostra a síntese dela. Ele mostra "avaliação inválida: <motivo>".
4. **Linha de comando:** `python pacote.py <pasta> [--sondagem arq]` lê o `revisao-NN.json` e o `avaliacao-NN.json` de número mais alto da pasta (e o `cargas-NN.json`, se existir) e grava `pacote-NN.json` ao lado, com o `gravar` atômico.
   - Sem relógio.
   - Pasta sem revisão dá erro claro.

## Testes (só `assert`)

1. 22421:
   - com a revisão, a avaliação e as cargas do mesmo `revision_id` e a sondagem fictícia, as quatro peças ficam `valida` e o pacote passa no `pacote_valido`;
   - mesmos bytes em duas rodadas.
2. Depois de `editor.mover_divisa`, a avaliação e as cargas do pai viram `invalida` contra a filha, com o motivo de cada uma.
3. Uma sondagem de outro lote é `invalida`, com motivo. A sondagem ausente fica `ausente`, e o resumo diz isso.
4. Adulterar uma peça depois de montar o pacote faz o `pacote_valido` dar `False`, dizendo qual peça mudou.
5. O resumo nunca contém "viável", "aprovado", "capacidade" nem "fundação", fora do aviso fixo.
6. Continuam passando: `test_cargas` (6), `test_sintese` (13), `test_sondagem` (3), `test_projetista` (18), `test_gerador` (8) e `test_editor` (10).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-PVF-PACOTE.md`, nesta pasta. Inclua um exemplo do `resumo` do 22421.
- Ao terminar: `maestri ask "Claude Code" "Terreno pacote pronto"`.
