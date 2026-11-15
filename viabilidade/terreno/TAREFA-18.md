# Tarefa 18 do Terreno: os pilotos anotados à mão foram lidos no lugar errado?

**Quem:** Terreno.
**Galho:** `viabilidade/lote-livre` (PR #124), worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** `viabilidade/terreno/lotes-piloto.json`, `lei/FONTES.md`, `conferencia/PACOTE-ARQUITETO.md` e `pacote-arquiteto.json`; os exemplos do motor (`motor/exemplos/`) e `relatorio/saida/` **só** regenerados pelos scripts que já existem, nunca editados à mão.
**Não fazer:** não commitar; não mexer em código nem em `dados/` (as anotações de 14/11 e os scripts de reprodução ficam como estão, são histórico).

## Por quê

A tarefa 17 (`RELATORIO-17.md`) mostrou que o ajuste antigo dos anexos (5 vértices, via SAD69 "ballpark") errava 40–100 m na cidade. As zonas dos 7 pilotos foram **lidas à mão em 14/11 com esse ajuste antigo** (`metodo` em `lotes-piloto.json`: "EPSG:29183; ajuste afim ... cinco vértices"). O teste da T17 conferiu que a zona *gravada* não mudou, mas não que a leitura à mão estava no lugar certo. Perto de divisa (o 22421 fica a poucos metros do traço Z1/Z2), 44 m de erro podem trocar a zona.

E vários textos ainda dizem "erro 3,53 m", que era só o resíduo dos 5 vértices, não o erro real.

## O que fazer

1. **Reconferir cada piloto** (os 7 de `lotes-piloto.json`): desenhe o polígono do lote sobre o recorte do Anexo 02 com a afim nova (`MapaGeorreferenciado`) e, para áreas especiais anotadas à mão, também sobre o 05, o 06 e o 07. Guarde os recortes na sua pasta temporária.
   - Para cada um, diga: a zona anotada continua certa? A distância à divisa mais próxima mudou quanto?
   - Se alguma zona anotada estiver errada no lugar novo, **não troque sozinho**: liste no relatório com o recorte, e a central decide.
2. **Texto de método e erro.** Em `lotes-piloto.json`, mantenha o histórico e acrescente a reconferência. Por exemplo: "lido à mão em 14/11 com o ajuste antigo (5 vértices, erro real 40–100 m, ver terreno/RELATORIO-16.md); reconferido em 15/11 com a afim de 21 cruzamentos (RMSE 2,9 m, máx. 6,2)". Troque "3,53 m" e os erros dos anexos 05/06/07 pelos números novos em `PACOTE-ARQUITETO.md`, `pacote-arquiteto.json` e `lei/FONTES.md` (a linha 136 recomenda os vértices do 02ABC como controle: diga que hoje são só verificação).
3. **Regenerar** os exemplos e relatórios que carregam esse texto pelos scripts que já existem (veja como o `conferir.py` ou os testes do motor e do relatório os produzem). Se não houver script, não edite à mão: liste.

Ficam como estão: `revisao/`, `auditoria/casos/`, os `TAREFA-*`/`RELATORIO-*` antigos, `dados/*-reproduzir.py` e as anotações de `dados/` (registro do que foi feito).

## Testes

- `python -I -X utf8 viabilidade/terreno/novo_lote.py --testar`
- `python -I -X utf8 viabilidade/motor/test_estudar.py`
- `python -I -X utf8 viabilidade/conferir.py`: 8/8

## Relatório

`viabilidade/terreno/RELATORIO-18.md`, até 12 linhas, com uma tabela por piloto: zona anotada, confere no lugar novo (sim/não), distância à divisa antes e depois. Depois: `maestri ask "Claude Code" "Terreno tarefa 18 pronta"`.
