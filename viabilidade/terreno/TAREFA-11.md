# Tarefa 11 do Terreno: corrigir os achados da AUDITORIA-6

**Quem:** Terreno.
**Quando:** depois da tarefa 10.
**Galho:** `viabilidade/lote-livre`.
**Onde mexer:** só em `viabilidade/terreno/`.
**Não fazer:**
- não commitar;
- não gravar imagem no repositório.

Leia `viabilidade/auditoria/AUDITORIA-6.md`.

## Regra

1. **Reproduzir primeiro** cada achado com um comando. O Auditor roda no Antigravity, que já errou fatos antes.
2. Para cada achado, uma linha no relatório: **confirmado** (com o comando e a saída) ou **não reproduz** (com o porquê).
3. Corrigir só o que se confirmar.
4. **Na dúvida, recusar** ou marcar "não verificada". Nunca aceitar em silêncio.

## O que corrigir (se confirmado)

- **ALTA 1: Eixo.** Lote a ≤ 60 m de traço de Eixo do art. 11 **não** recebe zona automática.
  - Recusa como divisa, com `SC-EIXO` e a zona de fundo como alternativas.
  - A central já reproduziu este achado: índice 25369 sai `SC-Z3`.
- **ALTA 2: área histórica do Anexo 06.** Desenhada com transparência sobre a Z1, a cor real não casa com a legenda.
  - Reconheça a cor composta.
  - Se não der com segurança, marque "não verificada" sempre que o lote estiver na região em que a mancha pode existir.
- **ALTA 3: vão dos cones do Anexo 07** sobre a pista e a AEI do Transporte Aéreo.
  - Lote nessa região não pode sair com `[]`.
  - Cubra com o desenho correto ou com "possível incidência / não verificada".
- **ALTA 4: legendas que faltam.**
  - Subárea Especial de Restrição de Gabarito (9 m, art. 80, Anexo 06);
  - AEI do Transporte Aéreo (Anexo 07);
  - Chácaras de Recreio (Anexo 05).
- **MÉDIA 5 e 6: cores próximas.**
  - Represa ↔ Z3;
  - Z5A/Z5B ↔ Parque;
  - zonas 6A a 8B ausentes da tabela.

  Cor ambígua = recusa.
- **MÉDIA 7:** falso Eixo por anti-aliasing do traço vermelho perto de texto preto.
- **MÉDIA 8:** `DIVISA_M` = 10 m é menor que o resíduo de georreferenciamento dos Anexos 06 (10,46 m) e 07 (11,37 m). Use, por anexo, um limite ≥ o resíduo dele.
- **MÉDIA 10:** polígono com buraco.
  - `--listar-vizinhos` e `--zona` precisam se comportar do mesmo jeito.
  - Condomínio grande: mensagem clara.
- **AUDITORIA-6, BAIXA 11:** ponto exatamente na divisa entre dois lotes. Se ficar a menos de ~0,5 m da borda, liste os dois e recuse.

## Prova

- `--testar` cobre um caso de cada achado confirmado.
- Os 7 pilotos continuam iguais. Se algum piloto mudar de "concorda" para "recusa", isso pode ser correto: liste e explique.
- Mostre quantos lotes da amostra da REVISAO-6 mudam de resultado.

## Relatório

`viabilidade/terreno/RELATORIO-11.md`, com a tabela achado × confirmado × corrigido. Depois: `maestri ask "Claude Code" "Terreno tarefa 11 pronta"`.
