# Visão de dados no Início — 04/11/2026

Nova apresentação em `/dashboard`, para gerente e corretor, usando o serviço de rastreabilidade existente. Não altera coleta, regras, dados de usuários nem backend.

- Resumo: sessões, visualizações, tempo ativo médio ponderado por sessões e retornos reconhecidos.
- Filtros de 7 e 30 dias, atualização manual e datas do relatório no fuso da agência.
- Ranking por sessões, desempate por tempo ativo e barras proporcionais.
- Destaque para até três empreendimentos com mais retornos e acesso aos detalhes existentes.
- Gerente consulta links da imobiliária; corretor envia seu UID como filtro em cada consulta autenticada.
- Somente empreendimentos ativos da agência carregados pela paginação. Cobertura parcial, falha de consulta e mais páginas são sinalizadas. Relatório ausente não vira zero.
- Navegadores estimados não são somados entre empreendimentos para evitar duplicação. Continuam disponíveis no relatório individual.
- Não apresenta nomes de visitantes, mensagens enviadas, conversões ou série histórica: esses dados não constam no contrato atual.
- Operação e solicitações continuam abaixo dos relatórios. Interface em português e inglês.

Validação: TypeScript e build Webpack passaram; 12 testes de resumo e contrato da rastreabilidade passaram; conferência das entradas de tradução sem ausências. A aba autenticada continuou indisponível ao controle do navegador, impedindo teste visual nesta etapa. Log de publicação na raiz: `painel-inicio-dados-deploy.log` (ignorado pelo Git). Código sem commit.
