# Tarefa 6 do Terreno: áreas especiais no lote novo

**Quem:** Codex (Terreno).
**Galho:** `feat/viabilidade-lote`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não alterar `lotes-piloto.json` nem os `dados/` versionados;
- Motor e Visual estão trabalhando nas pastas deles: não toque.
- **Imagem nova:** evite gravar PNG ou JPG novo no repositório. Se precisar de recorte para conferência, grave em pasta temporária e descreva no relatório. Toda imagem nova versionada exige inspeção (a trava da `main` confere o sha256).

## Por quê

Lote novo (`novo_lote.py`) sai com "áreas especiais não verificadas". Por isso o estudo dele perde o alerta que os pilotos têm:
- "ÁREA ESPECIAL … gabarito aeronáutico" do Anexo 07;
- AIA do Anexo 05;
- AEI/AEIS do Anexo 06.

Um estudo que esquece o cone do aeroporto é pior do que um que avisa.

## O que fazer

1. **Ler os Anexos 05, 06 e 07** no polígono do lote, com o mesmo georreferenciamento e a mesma amostragem da tarefa 5 (`sugerir_zona.py`).
2. **Preencher `lote.areas_especiais`** no formato que os pilotos já usam. Veja um piloto em `lotes-piloto.json` e como o motor lê esse campo (`motor/motor.py`, procure `areas_especiais`). O motor tem que gerar o alerta sem nenhuma mudança nele.
3. **Ser conservador.**
   - Mancha a menos de ~10 m do lote: marcar como "possível incidência, confirmar", nunca como ausente.
   - Se a leitura não for possível (cor encoberta, fora do mapa): registrar "não verificada", nunca omitir.
4. **Teste (`--testar`).**
   - Nos 7 pilotos, comparar com o `areas_especiais` manual. Todo alerta manual tem que aparecer no automático. Alerta automático a mais vai para o relatório, com o motivo.
   - Num lote novo dentro do cone do aeroporto: o estudo gerado por `motor/estudar.py` tem que trazer o alerta "ÁREA ESPECIAL".

## Relatório

`viabilidade/terreno/RELATORIO-6.md`, até 12 linhas:
- a tabela manual × automática dos 7 pilotos;
- os limites;
- o tempo.

Depois: `maestri ask "Claude Code" "Terreno tarefa 6 pronta"`.
