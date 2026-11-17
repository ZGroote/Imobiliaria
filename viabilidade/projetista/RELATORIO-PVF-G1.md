# PVF-G1: classificação por domínio e síntese global (16/11)

Criei só `sintese.py` e `test_sintese.py`. Não toquei em `gerador.py`, `test_gerador.py`, `esquema.py`, `validador.py`, `adaptador.py` nem `test_projetista.py`. Não commitei.

1. **O que faz.**
   - `classificar(achados)` devolve uma cópia de cada achado com `domain`, `method_version` (`sintese/0.1.0`), `scope` (`no_escopo` ou `fora_do_escopo`), `reason` e `required_actions`. Não há `calculated_at`.
   - `sintetizar(achados, escopo, evidencias)` devolve:
     - o estado, a contagem e os pendentes de cada um dos 6 domínios;
     - `sintese` e `regra_da_precedencia`;
     - `motivos_trava`;
     - `fora_do_escopo`, com o motivo e a contagem;
     - `regras_sem_dominio`;
     - os achados classificados;
     - `aviso` de resultado preliminar, em toda saída.
   - Não existe chave `viavel` em lugar nenhum.
   - Um escopo vazio, repetido ou com domínio desconhecido é recusado com `ValueError`.
2. **Precedência da síntese** (vale a primeira que bater; depois disso vem a trava):

   | # | Condição | Síntese |
   |---|---|---|
   | 1 | Alguma `violacao` em domínio do escopo | `INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS` |
   | 2 | Algum `erro_tecnico` (em qualquer domínio ou sem domínio), ou domínio do escopo sem nenhum `conforme` | `HIPOTESE_PRELIMINAR` |
   | 3 | Algum `nao_verificado` restante no escopo | `CONDICIONAL_COM_PENDENCIAS` |
   | 4 | Nenhuma das anteriores | `VERIFICADO_NO_ESCOPO_DECLARADO` |
   | trava | `estrutural` ou `geotecnico` no escopo, e falta sondagem, método estrutural ou revisão profissional com nome, conselho e registro | rebaixa um 4 para `CONDICIONAL` |

3. **Estado de cada domínio:** a ordem é `violacao` > `erro_tecnico` > `nao_verificado` (também quando não há nenhuma verificação) > `conforme` > `nao_aplicavel`.
   - O econômico fica `dados_insuficientes`, ou `erro_tecnico` (decisão 7).
   - `nao_aplicavel` sem `reason` vira `erro_tecnico`, e nunca conta como `conforme`. Um domínio só com `nao_aplicavel` cai na regra 2.
   - Estado desconhecido vira `erro_tecnico`. O valor original fica em `status_original`.
4. **Um desvio da lista da tarefa, para você decidir.** O `validador` 0.1.0 emite `acesso`, `fachada`, `dimensao`, `areas.privativa` e `areas.util` sem prefixo de domínio.
   - Pelo mapa da tarefa, os cinco virariam `erro_tecnico`, e toda revisão real sairia como HIPÓTESE por causa do nome da regra.
   - Por isso pus os cinco no mapa: os três primeiros como `arquitetonico`, os dois de área como `geometrico`.
   - Um `rule_id` que não está no mapa continua virando `erro_tecnico` (teste 6).
   - Se preferirem o mapa literal, é só apagar as duas linhas marcadas no `PREFIXOS`.
5. **Pilotos e casos:**
   - **Piloto 25297** (a revisão monta um pavimento simples dentro do envelope real do piloto, sem violação), escopo `geometrico` + `urbanistico`: saiu **`HIPOTESE_PRELIMINAR`** (regra 2).
     - No urbanístico não há nenhum `conforme`: `norma.envelope` e `areas.computavel` ficam `nao_verificado`, porque a zona do lote não foi conferida.
     - Mesmo forçando `lot_zone_verified=True`, continua HIPÓTESE. As fontes do piloto para essas duas regras vêm com `verified: false` ("envelope amostrado"; "COE art. 51, enquadramento pendente").
   - **Revisão sintética `bom()`** (fontes de fixture conferidas): `CONDICIONAL_COM_PENDENCIAS` (regra 3). O único pendente é `areas.util`, que o validador sempre marca `nao_verificado` porque faltam as divisórias internas.
   - **Consequência:** hoje nenhuma revisão real chega a `VERIFICADO`. Isso só acontece nos casos sintéticos, todos `conforme`.
6. **Testes** (`python -I -B -X utf8 viabilidade/projetista/test_sintese.py`, só `assert`): 7 funções cobrem os 8 itens da tarefa, e todas passam.
   - Trava: sem sondagem, sem método ou com revisão sem `registro`, a síntese fica em CONDICIONAL. Com tudo preenchido, chega a VERIFICADO.
   - Uma violação geométrica dá INCONSISTENTE. Uma violação fora do escopo não decide, mas aparece em `fora_do_escopo`.
   - `nao_aplicavel` sem `reason` e `rule_id` desconhecido viram `erro_tecnico`.
   - A lista do validador não muda (comparada com uma cópia profunda), e a saída é idêntica entre execuções e com o escopo em outra ordem.
   - Não há `viavel` em nenhuma saída, e todas levam o aviso.
   - `test_projetista.py` continua passando (18/18).
7. **Limitações:**
   - **Estado do domínio:**
     - A revisão profissional só é conferida pelo preenchimento dos campos: não há checagem de registro no conselho.
     - Erro técnico fora do escopo também derruba para HIPÓTESE (leitura literal da regra 2).
     - Um econômico no escopo sempre dá HIPÓTESE, porque não tem `conforme`.
   - **Proveniência:**
     - Os `required_actions` são heurísticos: fonte não conferida, zona, parâmetro ausente, divisórias, varanda.
     - Para `norma.envelope` e `areas.computavel`, sempre pedem conferir a zona, mesmo quando o motivo é só a fonte.
     - Nenhum dos campos de grandeza da seção 7 do PRD foi acrescentado: `quantity_kind`, `assumptions`, `confidence` etc. ficam para quando o `esquema.py` puder mudar.
   - **Integração:** a síntese não está ligada ao `validador` nem ao `DesignRevision.assessment` (arquivos proibidos nesta tarefa).
