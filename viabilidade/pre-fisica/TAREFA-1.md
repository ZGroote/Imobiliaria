# PVF-G0: inventário da pré-viabilidade física (16/11)

PRD: `viabilidade/PRD-PRE-VIABILIDADE-FISICA-0.1.md` (cópia ao lado desta tarefa). **Só documento.** Nada de código, protótipo, mudança no motor, painel, Firestore ou produção.

Saída: `pre-fisica/PVF-G0.md`, curto e direcionado à implementação, como o `PA-G0.md`. Cada referência a código como `arquivo:função` **que você abriu**. Se não achou, escreva "não achei", nunca invente. Norma ABNT: só número, título e ano que você conferir em fonte pública aberta; se não conferiu a vigência, escreva "vigência não conferida".

## Seções

1. **O que já existe e serve.** Procure no repositório e diga entrada → saída e se reaproveita:
   - volumes, pavimentos, alturas e áreas do motor (`viabilidade/motor/motor.py`, `estudo.json`);
   - estados de verificação do projetista (`viabilidade/projetista/validador.py` na worktree `imobiliaria-projetista`: `conforme`/`violacao`/`nao_verificado`/`erro_tecnico`). O PRD pede também `NAO_APLICAVEL` e a síntese global: diga o que falta;
   - relevo e topografia: o que o repositório tem (procure `relevo`, `elevation`, `cota`, `declividade`) e de onde vem;
   - sondagem, SPT, solo, nível d'água: o que existe (provavelmente nada; diga);
   - custo: se há alguma coisa de custo/m² no repositório.
2. **Matriz normativa.** Tabela: norma, para que serve no PRD, ano conferido ou "vigência não conferida", se é paga, o que o primeiro portão precisaria dela. Mínimo: NBR 6120, 6118, 6122, 6484, 6123, 8681.
3. **Dados reais disponíveis e direitos de uso.** Topografia aberta (fonte e resolução) e sondagem (onde se consegue, quem é o dono). Só fonte aberta; nada de forçar URL nem contornar login.
4. **Contrato mínimo do PVF-G1** (classificação por domínio e proveniência). Como ele encaixa no esquema `projetista/0.1.0` em vez de criar outro. Os campos mínimos de grandeza do PRD seção 7: quais já existem no `ValidationFinding` e quais faltam.
5. **Respostas propostas às 7 decisões da seção 16**, cada uma com uma recomendação e o porquê, marcando quais só o usuário (ou um engenheiro) pode decidir.
6. **Riscos e ordem** dos portões PVF-G1..G3 e como andam em paralelo com o projetista sem duplicar trabalho.

Regras: não commite. Nada de nome de cliente nem preço de venda. Ao terminar: `maestri ask "Claude Code" "Produto tarefa PVF-G0 pronta"`.
