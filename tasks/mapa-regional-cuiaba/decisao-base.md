# Decisão proposta: armazenamento da base geográfica regional

Estado: proposta. Data: 08/10/2026. Escopo: piloto Cuiabá e posterior geração de mapas por empreendimento.

## Contexto

O acervo atual é um conjunto de arquivos que o montador lê antes de aplicar recortes. O usuário quer preparar os dados uma vez e obter só o entorno necessário ao gerar um empreendimento. A base precisa consultar geometrias por localização/raio, registrar lacunas e reproduzir versões anteriores.

## Proposta

Usar PostgreSQL/PostGIS para feições e catálogo de cobertura. Guardar originais, rasters e pacotes em arquivos próprios, referenciados pelo catálogo. Começar com uma instância local de teste; selecionar hospedagem apenas depois das medições. Não há instância criada ou contratação associada ao plano.

Preservar o banco cadastral existente para empreendimento, usuários, permissões e estado do job. Esse cadastro referencia snapshot/pacote. Não transferir o sistema cadastral para outro banco como parte do piloto.

Os vetores serão normalizados para EPSG:4326 preservando o CRS/procedência original. A consulta por raio usará coluna geography indexada com GiST; as derivações terão uma projeção métrica coerente e origem local registrada. [ST_DWithin](https://postgis.net/docs/ST_DWithin.html) mede em metros para geography e usa a comparação espacial indexada.

```sql
-- Ilustração do contrato; schema ainda não implementado.
SELECT source_id, geom, properties
FROM geo_features
WHERE snapshot_id = :snapshot
  AND layer = :layer
  AND ST_DWithin(
    geog,
    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
    :raio_m_com_margem
  );
```

A expressão/coluna `geog` consultada deverá ter índice GiST correspondente. A consulta seleciona feições sem cortar sua geometria. Uma etapa adicional de fechamento de dependências inclui relações, nós e grupos de quadras exigidos pelo pipeline antes da exportação; `ST_DWithin` sozinho não recupera essas dependências. Na verificação, inspecionar `EXPLAIN (ANALYZE, BUFFERS)` com volume representativo; uma tabela pequena pode legitimamente usar varredura sequencial.

Arquivos grandes ficam fora das linhas de feições. Rasters usam janelas e metadados próprios; bibliotecas genéricas de objetos e materiais usam versões compartilhadas. Dados específicos de posição geográfica pertencem à base.

## Alternativas consideradas

| Alternativa | Avaliação |
|---|---|
| GeoJSON municipal com filtro a cada geração | Mantém a leitura integral e não cumpre o objetivo de consultar somente o entorno. Pode servir como formato de intercâmbio, não como base consultável principal. |
| GeoPackage/SQLite com índice espacial | Opção viável para um demonstrador em uma máquina; o [padrão GeoPackage](https://www.geopackage.org/spec140/index.html) prevê índices R-tree. Ficou como alternativa se o custo operacional do PostGIS não se justificar. Não implementar duas bases no piloto. |
| GeoParquet/DuckDB | Útil à ingestão e extração dos fornecedores. Reavaliar se o perfil final for apenas batch; não criar um segundo caminho de consulta sem evidência. |
| Geometrias completas no banco cadastral | Mistura o cadastro com a manutenção de acervo e transfere trabalho espacial ao cliente/worker. O plano usa referências e metadados de pacotes nesse banco. |
| Consultar fornecedores a cada empreendimento | Perde reprodutibilidade e reutilização, e depende da disponibilidade externa. A geração usa nosso snapshot validado. |

## Consequências e validação

- Há uma dependência operacional nova; testar localmente, medir custo e definir configuração reproduzível antes de propor hospedagem.
- Snapshot, identidade e cobertura precisam ser verificáveis, não somente uma tabela de geometrias.
- Atualizações acontecem na ingestão; o gerador fixa a edição utilizada.
- Pacotes regionais continuam no formato que o renderizador atual consome, limitando a mudança ao preparo de dados e configuração.
- Aceitar esta escolha após o primeiro mapa regional e sua comparação. Se a operação não se justificar, registrar revisão desta proposta antes de escolher outra base.
