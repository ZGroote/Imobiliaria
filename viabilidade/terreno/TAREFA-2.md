# Tarefa 2 da frente Terreno (central, 14/11)

Entrega 1 commitada (7f7dd15). Obrigado. Agora:

1. **Contrato v4** (README): troque `zona_anotada_a_mao` por `zona_origem` = `"anotada_a_mao"` e acrescente `zona_conferida: false` nos 5 lotes. Mantenha o script refazendo o arquivo idêntico.
2. **Dois lotes novos, SEM tirar os 5 atuais:** os pilotos de hoje caíram em Z1 e Z4. Falta o caso que mais interessa à incorporadora:
   - 1 lote (ou remembramento de vizinhos da mesma quadra, como o Motor fez) no **Eixo Estruturante** (lote com frente pras vias do art. 11 da Lei 18.053; lista em `viabilidade/lei/FONTES.md`);
   - 1 na **Z2**.
   Prefira 1.200 a 3.000 m², perto do centro, fora de área especial ambiental/industrial. Mesmo formato, relevo preenchido, `zona_origem: "anotada_a_mao"`, `zona_conferida: false`.
3. Fonte bloqueada vai pro `viabilidade/BLOQUEIOS.md` (regra no README).

Use subagentes em nível high. Relatório curto com `maestri ask "Claude Code"`.
