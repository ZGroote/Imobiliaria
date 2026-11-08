# Materiais BR US da Conecta

A biblioteca separa os nove originais preservados das adaptações por mercado. Em **Biblioteca da marca → Materiais por mercado**, escolha BR ou US explicitamente; a localização e o idioma do operador não escolhem o material.

## Materiais disponíveis

- Papel timbrado derivado em DOCX, com corpo vazio. Preserva imagem, geometria, margens e componentes do original. O perfil US adapta somente o texto do rodapé para inglês, site .com e telefone +55; BR usa português/.com.br.
- Assinatura leve em texto UTF-8, com João Groote, marca, lema, telefone e site do perfil. Os dados vêm dos materiais fornecidos. O arquivo pode ser editado manualmente depois do download; essa edição não altera a versão conferida no CRM.

O logo original não foi redesenhado nem teve pixels editados. Ele conserva o nome da marca e o lema incorporado em português inclusive no timbrado US. As assinaturas em texto usam o lema em português ou inglês. Não há assinatura HTML, banner novo, tradução de contrato ou inserção automática em mensagens. O acervo original e o transporte de texto simples permanecem disponíveis.

## Conferir uma adaptação

Baixe e abra o arquivo, confira identidade, idioma, domínio, dados e apresentação. Marque a confirmação e registre a conferência para aquele perfil e material. A revisão se refere ao hash exato, tem histórico e pode ser retirada. Se o conteúdo mudar, o material atual volta a exigir conferência. Uma revisão desatualizada em outra janela é recusada sem substituir a confirmação local.

A confirmação é do operador; o CRM não comprova que o arquivo foi aberto. A aprovação não é escrita dentro do arquivo baixado e não significa aceite de cliente. Ela não aprova proposta, contrato, preço, prazo, permissão do destinatário ou envio. A assinatura não completa endereço postal ou descadastro exigidos em mensagens comerciais. Nada é anexado, publicado ou enviado pelo download ou pela aprovação.

Todos os materiais começam pendentes. O hash do timbrado original é conferido antes de cada geração, inclusive assinatura. Caminhos e identificadores de arquivo não vêm da página. Download usa sessão local, hash atual, nome fixo e resposta sem cache. A migração 0018 adiciona somente o histórico de conferências; originais, dados comerciais e filas não são modificados.

## Verificação

Testes com banco temporário cobrem perfil/domínio, hash estável, integridade, revisão explícita, concorrência, retirada, mudança de conteúdo, histórico e ausência de efeitos sobre propostas/envios/agentes. Os dois timbrados foram abertos somente para leitura em instância exclusiva e oculta do Word e convertidos para PDF; uma página por material foi rasterizada e inspecionada. O renderizador padrão foi tentado, mas LibreOffice não está instalado. O Word foi usado apenas no QA; o CRM gera PDF sem depender dele.

Na interface fictícia: download de timbrado e assinatura US, confirmação, bloqueio da troca de perfil durante confirmação, registro e retirada de aprovação, histórico preservado ao reabrir. Biblioteca e revisão de proposta conferidas em 320/768/1024/1440 px, sem overflow horizontal; console sem erros/avisos. Nenhuma aprovação de material foi registrada na base principal pelos testes.

## Dependências do PDF

ReportLab 5.1.0, Pillow 13.0.0 e charset-normalizer 3.5.2 fixados em requirements.lock.txt, obtidos do PyPI oficial. pip check aprovado. Consulta ao OSV, enviando apenas nomes e versões, não retornou advisories para esses três pacotes em 08/11/2026; isso é uma consulta pontual à base, não garantia de ausência de falhas. Não foram adicionadas dependências npm.
