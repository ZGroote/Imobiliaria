# Tarefa 5 do Terreno: sugerir a zona pelo mapa do Plano Diretor

**Quem:** Codex (Terreno).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não alterar `lotes-piloto.json` nem `dados/` versionados; pode criar dado novo e pode importar dos scripts existentes;
- o Motor está mexendo em `motor/` e o Visual em `visual/` e `relatorio/`: não toque.

## Por quê

Hoje o `novo_lote.py` exige `--zona`. Quem estuda um lote novo raramente sabe a zona. A ideia é o sistema **sugerir** a zona, sem nunca afirmar que ela está certa.

## O que fazer

1. **`novo_lote.py --zona auto`** (o `--zona SC-XX` continua valendo).
   - Ler a zona no Anexo 02 (Zoneamento Urbano), com o georreferenciamento que já existe:
     - `dados/zonas-controles.json`, `zonas-posicionamento.json`, `zonas-renderizar.py`;
     - erro médio de 3,53 m (veja `ZONAS.md`).
   - Os mapas vêm do `baixar_mapas.py` / `mapas-externos.json` se não estiverem na máquina.
   - Amostrar o lote inteiro: vários pontos dentro do polígono, não só o centro. Classificar pela cor da legenda.
2. **Gravar no lote:**
   - `zona_id` = a sugerida;
   - `zona_origem` = `"sugerida_pelo_mapa"`;
   - `zona_conferida` = `false`;
   - um bloco `zona_sugestao`: `{"metodo", "pontos", "proporcao_por_zona", "distancia_divisa_m", "alternativas", "motivo_duvida"}`.
3. **Quando NÃO sugerir.** Sair com erro claro e pedir `--zona` quando:
   - o lote cair em mais de uma zona;
   - a divisa estiver a menos de ~10 m (perto do erro do mapa; documente o limite escolhido);
   - a cor não bater com a legenda.

   **Eixo Estruturante** (art. 11): a lei define pela testada, não pela cor. Se o lote estiver a menos de ~60 m de uma via de eixo, coloque `SC-EIXO` como alternativa e explique em `motivo_duvida`.
4. **Teste (`--testar`).**
   - Rodar `auto` nos 7 pilotos e comparar com a leitura manual de `ZONAS.md`. Para cada um, uma destas saídas: concorda / sugere outra / recusa por dúvida.
   - O 22421 (colado na divisa Z1/Z2) **tem que** recusar ou trazer Z2 como alternativa.
   - Mais 3 lotes fora dos pilotos, com o resultado olhado por você no recorte do mapa. Anote o índice e o que viu.

## Relatório

`viabilidade/terreno/RELATORIO-5.md`, até 12 linhas:
- a tabela dos 7 pilotos (manual × automática);
- os limites;
- o tempo.

Depois: `maestri ask "Claude Code" "Terreno tarefa 5 pronta"`.
