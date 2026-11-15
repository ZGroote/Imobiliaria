# Motor 0.8.1 — tarefas 9 e 10 — 15/11/2026
## 9 — garagem computável
Recuo menor ampliava o subsolo automático e consumia CA: no caso CA 5,0, A 42→40 e D 38→36. Agora concorrem subsolos na caixa legal e junto à implantação, com torres próximas: A 52→52 e D 46→46. Priorizam-se unidades/privativa, mantendo a meta e alertas de déficit de vagas (A: 11 vagas; D: 13). Não há prova de ótimo global.
Tempos: `medir_tempo.py`, mediana de 3 gerações com caches limpos; base fixa 0.8.0 de `TEMPOS.md`. Suíte final `test_motor.main()`: **384,84 s, passou**.
## 10 — auditoria independente
| Achado | Reproduzido / causa | Correção / teste |
|---|---|---|
| A1 | Sim; ajuste abortava abaixo da laje mínima | Mantém o intervalo e busca fina; perm55→perm25, B 30→30 |
| A2 | Sim; envelope alternava por limiar | Ambos os caminhos concorrem; só deduplica diferença de área zero; trap-rb10→rb02, B 64→64 |
| A3 | Sim; envelope virava prova falsa de impossibilidade | Limites da caixa legal inteira, busca sem envelope e tangência válida; A/C presentes no 13×40 |
| A4 | Sim; térreo limitava também a torre superior | Limites por pavimento e base com parede cega; D presente no 14×20 |
| M1 | Sim; encolhimento somava ilhas descartadas | Mede a maior parte e confere capacidade final/alerta; haltere, L e `confere` |
| M2 | Sim; secante e arredondamento perdiam privativa | Ajuste fino e vértices com 4 casas; pares de TO/permeabilidade do trapézio |
| B1 | Sim; último pavimento sobrescrevia o melhor diagnóstico | Retém melhor tentativa e formata medidas; piloto 22426, ausência A no 1º pavimento com 0 unidades |
Monotonia: todos os pares 9/10 e matrizes anteriores passam (privativa: tolerância numérica de 0,10 m²); 42 casos, base 0.7.1, provas de impossibilidade e reprodução exata dos oito JSONs passam. Contrato v5 mantido; sem commit.
| Estudo | 0.8.0 | 0.8.1 | Razão / teto 2× |
|---|---:|---:|---:|
| estudo-exemplo | 3,17 s | 1,42 s | 0,45× — passa |
| SC-completo-30516 | 6,61 s | 8,98 s | 1,36× — passa |
| SC-completo-37607 | 6,73 s | 2,86 s | 0,42× — passa |
| SC-completo-22426 | 1,29 s | 1,82 s | 1,41× — passa |
| SC-completo-22421 | 0,76 s | 0,87 s | 1,14× — passa |
| SC-completo-25297 | 0,23 s | 0,24 s | 1,04× — passa |
| SC-completo-q1382-11984-11988 | 7,83 s | 8,77 s | 1,12× — passa |
| SC-completo-remembramento-75352-75354 | 9,57 s | 8,22 s | 0,86× — passa |
