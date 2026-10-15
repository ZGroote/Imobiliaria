# Dados comerciais separados da reconstrução

O cadastro pelo painel e a atualização pública ao vivo estão implementados em [ESTOQUE.md](ESTOQUE.md). Quando `estoque=ID_DO_IMOVEL` está ativo, esse cadastro é a fonte da ficha e substitui a leitura do arquivo local. As instruções abaixo descrevem a alternativa de importação por arquivo.

`comercial.json` permanece com estado **ausente**, sem preço, oferta ou número comercial. A interface não deduz estoque pelas cores artísticas, pela posição ou por anúncios públicos. A tabela fornecida pelo responsável será a fonte escolhida para a atualização.

## Preparar e importar

Na pasta deste experimento, `node importar_comercial.mjs --modelo tabela-a-preencher.json` cria um modelo com os 170 IDs técnicos e campos vazios. O arquivo não pode ser ativado sem fonte e data; não é uma tabela oficial. Não preencher IDs a partir de uma regra presumida de número comercial.

Cada linha aceita `id`, `commercialNumber`, `availability`, `priceCents`, `parking` e `conditions`. Campos ausentes continuam desconhecidos. Disponibilidade aceita `nao_informada`, `disponivel`, `reservada`, `vendida` ou `bloqueada`. Preço é inteiro não negativo em centavos, não um decimal em reais. Fonte tem `label` e `asOf` no formato `AAAA-MM-DD`; `bookSHA256` vincula o cadastro às referências usadas. Tipologia, espelhamento, área e número de vaga não são inferidos dessa tabela.

Para uma tabela preenchida e conferida: `node importar_comercial.mjs --entrada tabela-conferida.json --saida comercial.json --geometria entrada`. O importador rejeita IDs desconhecidos/duplicados, números comerciais duplicados, revisão errada, estados inválidos, datas inexistentes, campos inesperados e preço sem precisão inteira. Valida tudo antes de escrever, troca o arquivo por promoção no mesmo diretório e preserva a versão anterior em `comercial.json.previous`. Importar os mesmos bytes normalizados não altera arquivos. Não usar o comando para substituir a tabela por um modelo vazio.

O importador aceita JSON. Conversão de uma futura tabela XLSX/CSV deve preservar IDs, centavos e valores ausentes, conferida com a fonte recebida; não há planilha comercial disponível nesta execução. A ativação comercial real continua pendente.

## Interface e atualização

No escopo `unidades=edificio`, o arquivo é consultado depois da primeira cena utilizável, com revalidação HTTP. Sua versão validada alimenta a ficha, rótulo da unidade selecionada na fachada, botões do pavimento e espelho. Cores e filtro de disponibilidade usam o mesmo estado; preços são formatados preservando centavos. Fonte/data e condições são mostradas como texto. A cor azul do realce 3D continua sendo seleção, sem alteração de materiais da construção.

Em falta de dados, o filtro comercial fica desativado e a ausência é explícita. Falha de HTTP/validação preserva a última tabela validada da sessão e exibe um aviso; nunca transforma uma falha em unidade disponível. Registros omitidos de uma tabela parcial continuam “não informada”. Troca de modo preserva os dados da sessão. O arquivo não entra no cache versionado de modelos do Service Worker.

`__livViewer.reloadCommercial()` permite ao integrador atualizar os dados sem criar outra cena. Nenhum preço ou disponibilidade é salvo junto à geometria/bake, nem atualizado a partir de exemplos de teste. O importador deve ser executado sobre a fonte comercial escolhida, antes de preparar/publicar o pacote.

## Verificação

Cinco testes Node conferem dados ausentes, vínculos explícitos, rejeições, centavos exatos, repetição de importação e preservação após entrada inválida. `qa_comercial.py` usa interceptação somente em perfis descartáveis, com fonte marcada **FIXTURE SINTETICA — SEM OFERTA REAL**; não escreve em `comercial.json`. Os três perfis exercitam estados/filtro, ficha/rótulo/espelho, renderização segura de texto, troca de modo, rejeição de duplicatas, HTTP 503 e recuperação. Evidências em `evidencias/comercial-sintetico/runtime.json`.
