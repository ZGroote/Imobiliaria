# Tarefa 7 do Terreno: achar o lote por coordenada

**Quem:** Codex (Terreno).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não gravar imagem no repositório;
- o Motor está em `motor/` e o Visual em `visual/`: não toque.

## Por quê

Para estudar um lote hoje é preciso saber o índice da feição (`--indices 30516`), e ninguém sabe isso. O usuário tem o ponto do terreno: copia a latitude e a longitude do Google Maps.

## O que fazer

1. **`novo_lote.py --ponto "-22.0123, -47.8901"`**, no lugar de `--indices`.
   - Aceite o formato que o Google Maps copia (`lat, lon`, com vírgula e espaço).
   - Ache a feição que **contém** o ponto, nas duas bases.
   - Se nenhuma contiver, liste as 3 mais próximas, com a distância em metros e o índice de cada uma, e saia com erro pedindo `--indices`. Nunca escolha sozinho.
   - Se mais de uma feição contiver o ponto (sobreposição), liste todas e saia com erro.
   - Ponto fora de São Carlos: erro claro.
2. **`--listar-vizinhos`** junto com `--ponto`: imprime a feição achada e as vizinhas que encostam nela, com índice e área. Serve para montar remembramento sem adivinhar índice.
3. **Teste (`--testar`).**
   - O centroide de cada um dos 5 pilotos simples tem que achar o índice certo.
   - Um ponto na rua tem que dar erro, com os 3 mais próximos.
   - Um ponto fora da cidade tem que dar erro.
   - Uma coordenada em texto com vírgula decimal ou invertida (lon, lat) tem que ser recusada ou detectada, com mensagem clara.

## Relatório

`viabilidade/terreno/RELATORIO-7.md`, até 8 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 7 pronta"`.
