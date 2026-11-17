# PA-G1 fatia 1: esquema canônico, validador e adaptador do estudo (16/11)

Worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0`. Leia antes `projetista/PA-G0.md` (seção 4), `projetista/DECISOES-PA-G0.md` e `projetista/MATRIZ-REUSO.md`.

**Esta fatia não gera planta.** Ela cria a base que o gerador (fatia 2) e o editor (depois) vão usar.

## O que fazer (tudo em `viabilidade/projetista/`, Python 3 + Shapely, já usados no motor)

1. **`esquema.py`:** as entidades da seção 4.2 do PA-G0 que a fatia 2 precisa: `StudyReference`, `Site`, `RuleSetReference`, `UnitType`, `FloorPlate` (com `unit_placements`), `SharedSpace`, `Core`, `ValidationFinding` e `DesignRevision`. JSON com `schema_version: "projetista/0.1.0"`, metros, IDs estáveis, serialização estável (chaves ordenadas, 4 casas) e `content_sha256`. Gravar e ler com gravação atômica (arquivo temporário + rename). Sem `Room`/`Wall`/`Opening` detalhados ainda: unidade = polígono externo + espessuras.
2. **`adaptador.py: estudo_para_site(estudo_json)`:** lê um `estudo.json` do motor sem mudar nada no `motor/` e devolve `StudyReference` + `Site` (com envelope por faixa de altura, a partir de `caixa_maxima.degraus`) + `RuleSetReference`, preservando `zona_conferida`. `caixa_maxima.altura_m = null` vira erro claro, nunca zero (achado da matriz, seção 6.1).
3. **`validador.py: validar(revisao, site, regras) -> list[ValidationFinding]`**, independente de qualquer gerador. Cada achado traz `status` (`conforme` / `violacao` / `nao_verificado` / `erro_tecnico`), medido, limite, unidade e `element_ids`. Regras desta fatia:
   - geometria: polígonos válidos, unidades/corredor/núcleo dentro do envelope da cota do pavimento, sem sobreposição (tolerâncias da seção 4.1);
   - balanço: laje = unidades + áreas comuns + núcleos + resíduo (fecha em `tol_area_m2`);
   - acesso: toda unidade encosta no corredor ou hall num trecho ≥ largura de porta (0,80 m);
   - fachada: toda unidade tem trecho mínimo na borda externa da laje (padrão 3,00 m, parâmetro);
   - dimensões: lado mínimo da unidade (parâmetro);
   - áreas: privativa (NBR 12721, faces pela espessura 0,15/0,20 m), útil e computável como **três números separados**; varanda computável com `nao_verificado`;
   - qualquer regra sem fonte conferida sai `nao_verificado`, nunca `conforme`.
4. **`test_projetista.py`** (só `assert`, no estilo do `motor/test_motor.py`): um pavimento sintético bom (6 unidades + corredor + núcleo) que passa; um caso para **cada** regra acima que falha com o `status` e o `element_id` certos; ida e volta do JSON com o mesmo SHA; o adaptador lendo os pilotos `SC-completo-q1382-11984-11988` e `SC-completo-25297` de `motor/exemplos/pilotos/`.

## Regras

Não mexa em `motor/`, `terreno/`, `visual/`, painel, `.github/`, config nem hook. Nada de Firestore, rede ou deploy. Sem IA generativa e sem acaso (nenhum `random`/relógio no resultado). Não commite. Relato curto em `projetista/RELATORIO-3.md` (o que fez, números, como rodar os testes). Ao terminar: `maestri ask "Claude Code" "Visual tarefa 3 pronta"`.
