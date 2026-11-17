# Fatia 2 do projetista: gerador esquemático de pavimento (16/11)

**Onde:** `viabilidade/projetista/` desta worktree (`imobiliaria-viabilidade`). É **cópia de trabalho** do galho `viabilidade/projetista-g0`: a central leva o resultado para lá. Não commite aqui.

**Leia antes:** `PA-G0.md` (seções 1, 4 e 8.2), `DECISOES-PA-G0.md`, `MATRIZ-REUSO.md` seção 5, e o código da fatia 1: `esquema.py` (`selar`, `gravar`, `ler`), `adaptador.py` (`estudo_para_site`) e `validador.py` (`validar(revisao, site, regras)`). Testes atuais: `python -I -X utf8 viabilidade/projetista/test_projetista.py` (18 passam). **Não mude o formato nem as regras da fatia 1**; se precisar mudar, pare e conte no relato por quê.

## O que fazer

`gerador.py: gerar_pavimento(site, regras, programa, limites) -> resultado`

- **Entrada:** o `site` do adaptador (envelope por faixa de altura) e um `programa`: número de unidades por andar (ex.: 6), área privativa-alvo por unidade (faixa mín–máx), largura de corredor, dimensões do núcleo (escada + elevador + shaft), fachada mínima por unidade e lado mínimo. Tudo **parâmetro com padrão documentado**. Medida que vem de norma que não conferimos fica marcada como premissa, não como regra.
- **Algoritmo determinístico, sem IA, sem `random`, sem relógio no resultado.** Faixas paralelas ao eixo dominante do envelope. Corredor central (unidades dos dois lados) e corredor lateral (de um lado só). Núcleo no meio ou na ponta. Busca com poda (branch-and-bound) sobre essas opções discretas, com ordem e desempate fixos. Limite de busca por **contagem de nós**, não por tempo.
- **Toda proposta passa pelo `validador.validar`.** Só sai como `gerado` a que não tem `violacao` nem `erro_tecnico` geométrico. Regra sem fonte fica `nao_verificado`, e isso **não** impede `gerado`.
- **Resultado:** `outcome` = `gerado` (lista ordenada de até K revisões seladas, cada uma com a métrica do objetivo), `inviavel` (prova simples: a laje utilizável é menor que N × área mínima + corredor + núcleo, ou o envelope é mais estreito que a profundidade mínima de unidade + corredor; diga qual) ou `nao_encontrado` (a busca acabou sem solução, com o nº de nós e o motivo mais frequente de recusa). Nunca `inviavel` sem prova.
- **Objetivo explícito:** maximizar área privativa total; desempate fixo por menor resíduo, depois mais fachada mínima por unidade, depois a ordem da enumeração.
- **CLI:** `python -I -X utf8 viabilidade/projetista/gerador.py <estudo.json> --unidades 6 --saida <pasta>`. Grava as revisões com `gravar` (atômico) e imprime um resumo curto: outcome, unidades por andar, área privativa por unidade, resíduo e quantos achados `nao_verificado`.

## Testes (`test_gerador.py`, só `assert`)

1. Retângulo sintético de 30 × 20 m, 6 unidades → `gerado`. O validador não acusa violação, e as 6 unidades encostam no corredor e têm fachada mínima.
2. Mesmo retângulo girado 37° → mesmo resultado (áreas iguais dentro da tolerância).
3. Determinismo: duas execuções dão o mesmo `content_sha256`.
4. Piloto `SC-completo-q1382-11984-11988` (motor/exemplos/pilotos) → `gerado` com 6 por andar.
5. Piloto `SC-completo-25297` (caixa de ~147 m²) → `inviavel`, com a prova.
6. Envelope em L ou estreito em que a busca com limite pequeno de nós não acha → `nao_encontrado`, e nunca `inviavel`.
7. Os 18 testes da fatia 1 continuam passando.

## Regras

Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede, Firestore ou deploy. Não commite. Relato curto em `viabilidade/projetista/RELATORIO-4.md`: o que fez, números dos pilotos (unidades, área privativa média, resíduo), limitações e como rodar. Ao terminar: `maestri ask "Claude Code" "Motor tarefa 4 do projetista pronta"`.
