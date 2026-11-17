# PVF-G1: classificação por domínio e síntese global (16/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. O Motor está mexendo nessa mesma pasta no `gerador.py` e no `test_gerador.py`: **não toque nesses dois, nem em `esquema.py`, `validador.py`, `adaptador.py` ou `test_projetista.py`.** Crie só `sintese.py` e `test_sintese.py`. Não commite: a central leva os arquivos para o galho `projetista-g0`.

**Leia antes** (no galho `projetista-g0`, worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`): `viabilidade/PRD-PRE-VIABILIDADE-FISICA-0.1.md` (seções 4, 7 e 13), `viabilidade/pre-fisica/PVF-G0.md` (seção 4) e `viabilidade/pre-fisica/DECISOES-PVF-G0.md`. Só leitura. Se a leitura fora da sua worktree pedir permissão, use a cópia do código em `viabilidade/projetista/` e o resumo abaixo.

## O que fazer

`sintese.py`, por cima da lista que o `validador.validar` já devolve, **sem alterá-la** (trabalhe numa cópia):

1. **`classificar(achados) -> achados com "domain"`.** Use um mapa fixo de prefixo do `rule_id` para domínio:
   - `geometria.`, `balanco`, `contrato`, `areas.faces`, `areas.declaradas`, `areas.varanda_limite` → `geometrico`;
   - `norma.`, `areas.computavel`, `areas.varanda_computavel` → `urbanistico`;
   - `arquitetura.` → `arquitetonico`;
   - `estrutura.` → `estrutural`;
   - `geotecnia.` → `geotecnico`;
   - `economia.` → `economico`.

   Um `rule_id` sem domínio vira `erro_tecnico` ("regra sem domínio"), nunca é ignorado.
2. **Estado `nao_aplicavel`:** só é aceito com `reason` não vazio; sem justificativa, vira `erro_tecnico`. Ele nunca conta como `conforme`.
3. **`sintetizar(achados, escopo, evidencias) -> assessment`** (dict determinístico, sem relógio):
   - `escopo`: lista de domínios declarados. Os de fora aparecem em `fora_do_escopo`, com o motivo, e nunca somem do resultado.
   - `evidencias`: `{"sondagem": bool, "metodo_estrutural": str|None, "revisao_profissional": {"estrutural": {...}|None, "geotecnico": {...}|None}}`. A revisão profissional só vale com `nome`, `conselho` e `registro` preenchidos.
   - **Por domínio:** contagem por estado, os `rule_id` pendentes, e o estado do domínio. Domínio do escopo **sem nenhuma verificação** fica `nao_verificado` (não testado nunca é `conforme`). O econômico usa `cenario_calculado` / `dados_insuficientes` / `erro_tecnico`; hoje fica sempre `dados_insuficientes` (decisão 7).
   - **Síntese global, em ordem fixa (a primeira que bater vale):**
     1. alguma `violacao` em domínio do escopo → `INCONSISTENTE_NOS_DOMINIOS_VERIFICADOS`;
     2. algum `erro_tecnico`, ou algum domínio do escopo sem nenhuma verificação `conforme` → `HIPOTESE_PRELIMINAR`;
     3. qualquer `nao_verificado` restante → `CONDICIONAL_COM_PENDENCIAS`;
     4. só então `VERIFICADO_NO_ESCOPO_DECLARADO`.
   - **Trava (decisão 5):** se `estrutural` ou `geotecnico` estão no escopo e falta sondagem, ou método estrutural, ou revisão profissional válida, a síntese é no máximo `CONDICIONAL_COM_PENDENCIAS`, e `motivos_trava` diz o que falta.
   - `aviso`: texto fixo dizendo que o resultado é preliminar e não é aprovação legal, projeto executivo nem certificação de segurança (decisão 6). Vai em **toda** saída.
   - Nada de campo `viavel` booleano.
4. **Proveniência** em cada achado classificado: `domain`, `method_version` (versão do `sintese.py`), `scope`, `reason`, `required_actions` (lista; para `nao_verificado`, o que falta para verificar). Sem `calculated_at`: o resultado tem que ser reprodutível.

## Testes (`test_sintese.py`, só `assert`)

1. Revisão válida de um piloto (como no `test_projetista.py`), escopo `["geometrico", "urbanistico"]` → não pode dar `VERIFICADO` enquanto a zona do lote não for conferida (`nao_verificado` → `CONDICIONAL` ou `HIPOTESE`). Diga no relato qual saiu e por quê.
2. Escopo com `estrutural` sem nenhuma regra estrutural → domínio `nao_verificado`, síntese ≤ `CONDICIONAL`.
3. Achados sintéticos, todos `conforme`, com `estrutural` + `geotecnico` no escopo, mas sem sondagem → `CONDICIONAL_COM_PENDENCIAS` (a trava funciona).
4. O mesmo caso com sondagem, método e revisão profissional válida → `VERIFICADO_NO_ESCOPO_DECLARADO`. Com a revisão sem `registro` → volta para `CONDICIONAL`.
5. Uma `violacao` geométrica → `INCONSISTENTE` mesmo com o resto conforme.
6. `nao_aplicavel` sem `reason` → `erro_tecnico`. `rule_id` desconhecido → `erro_tecnico`.
7. A lista original do validador não muda (compare uma cópia profunda). Duas execuções dão saída idêntica.
8. Nenhuma saída tem a chave `viavel`.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `viabilidade/projetista/RELATORIO-PVF-G1.md`: o que fez, a tabela de precedência, o resultado dos pilotos e as limitações.
- Ao terminar: `maestri ask "Claude Code" "Terreno PVF-G1 pronto"`.
