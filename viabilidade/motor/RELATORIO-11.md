# Motor 0.8.2 — tarefa 11 — 15/11/2026

`dominio.py` mediu 62 estudos com lote: 8 atuais + 54 da auditoria; fontes e valores exatos em `dominio-0.8.json`.
Geometria: área 150–20.000 m²; 3–17 vértices; convexidade 0,734177–1; frente/profundidade 0,187500–2,651712; menor ângulo 24,775141–90°.
Zona: CA básico 1–2 e máximo 1,4–5 (ambos também com null explícito); TO 0,20–1; permeabilidade 0,10–0,73; 42 IDs listados no JSON; área especial e garagem computável testadas com e sem.
Folga: 0,1% de cada extremo contínuo (piso 1e-9); vértices/categorias exatos. Faixas marginais não provam cobertura de todas as combinações.
Oito estudos: exemplo, 30516, 37607, 22426, 22421, 25297, q1382-11984-11988 e remembramento-75352-75354 — todos `dentro` (também os 54 casos com lote).
Sintético grande: quadrado de 4.000.000 m² → `fora` por área; opções preservadas e aviso de encaminhamento emitido.
Sintético côncavo: lote em U, convexidade 0,1728 → `fora` por convexidade; mesmo aviso.
Sintético agudo: triângulo, menor ângulo 5,710593° → `fora` por ângulo; mesmo aviso.
Ausência de frente, polígono, identificação/parâmetros da zona → `dados_insuficientes`, com motivo; `zona_conferida: false` não exclui o lote. Falta de dados não esconde extrapolação conhecida (`fora` prevalece).
Regenerados exemplo e sete pilotos; comparação integral com `947e2ec8` permite só versão, domínio e aviso novo (referências SHA-256 em `exemplos/linha-de-base-0.8.1.json`, independentes do histórico Git no CI). Suíte completa passou em 424,55 s; domínio e comparação final também passaram; sem commit.
