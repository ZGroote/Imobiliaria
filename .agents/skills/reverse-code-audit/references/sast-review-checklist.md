# Checklist de revisão de segurança

Adaptado do checklist do módulo code-audit do reverse-skill, commit cab634bd855fc287f6e420c1f36fd1a6b9245960.

Selecione os itens que correspondem ao escopo; cada achado exige evidência no código atual.

- Entradas externas: identifique quem controla cada campo, caminho, identificador, URL e conteúdo.
- Autenticação e autorização: vincule identidade, usuário ativo, papel, imobiliária, recurso e ação. Teste acesso sem sessão e com sessão de outra imobiliária.
- Isolamento: um identificador escolhido pelo cliente não deve mudar a imobiliária ou conceder permissões. Confira criação, atualização, consulta e campos imutáveis.
- Uploads: confira a autorização no Storage e no destino usado pelo aplicativo; tamanho, tipo, nome/caminho e tratamento posterior do conteúdo.
- Credenciais: encontre fontes de credenciais e destinos de logs/bundles sem imprimir valores. Chaves de cliente Firebase são públicas; credenciais Admin e tokens privados exigem proteção.
- Desserialização: acompanhe entrada até pickle, carregadores YAML e outros formatos que possam executar código.
- URLs externas: verifique esquemas, destinos, redirecionamentos e acesso a redes internas quando houver requisições controladas pelo usuário.
- Execução e arquivos: confira argumentos de subprocessos, interpolação no shell, caminhos relativos e escapes de diretório.
- Conteúdo renderizado: acompanhe HTML, URLs e texto controlados pelo usuário até a interface. Confirme sanitização/escape no ponto de uso.
- Correção: reproduza com dados sintéticos, inclua um caso permitido e um proibido e confirme que os testes validam o efeito da autorização.
