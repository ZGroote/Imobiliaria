# Conecta Imóveis 3D — site institucional

Publicado em **https://conectaimoveis3d.com.br/**. A raiz apresenta o produto,
os planos LEVE e PREMIUM sob consulta, contato pelo WhatsApp **(16) 98128-8075**
e rascunhos de termos, privacidade e cookies. E-mail no domínio fica para depois.

## Estrutura e publicação

O domínio está conectado ao Hosting **`imobilaria-deccb-miniaturas`**, no projeto
`imobilaria-deccb`, compartilhando o pacote com os produtos existentes:

- `/`: fachada institucional.
- `/planos.html`, `/contato.html` e páginas legais: site institucional.
- `/painel` e `/login`: encaminham ao painel administrativo existente.
- `/maquetes/liv/`: LIV Clássico, com os recursos em `/liv-classico/`.
- `/acesso.html`, `/b/` e demais entradas: links individuais e builds preservados.

Para preparar e publicar, a partir da raiz do repositório:

```powershell
python -I conecta/preparar.py
python -m unittest discover -s tests -p test_fachada.py
python -m unittest discover -s tests -p test_conecta.py
node --check fachada/assets/site.js
node node_modules/firebase-tools/lib/bin/firebase.js deploy --config publicacao/liv-duplo-20261017/firebase.json --only hosting --project imobilaria-deccb --non-interactive
```

Antes de qualquer deploy completo, compare o inventário local com a versão
ativa do Hosting. Na atualização de 26/10, havia arquivos públicos ausentes no
pacote local; a entrega foi feita pela API, preservando o inventário remoto e
alterando apenas os caminhos da mudança. Registros em [PUBLICACAO.md](PUBLICACAO.md).

O preparador instala as sete páginas na raiz do payload e os seis recursos em
`/institucional/assets/`, preservando todo o restante. Não copia o `robots.txt`
do preview isolado para o domínio compartilhado. CSP e `noindex` são limitados
às páginas institucionais e aos seus recursos; não se aplicam ao visualizador
ou à página de acesso individual.

**Não publicar somente `fachada/public/` sobre esse Hosting:** isso removeria os
arquivos das maquetes. O `firebase.json` da raiz e os outros sites também não
são o destino desta fachada. O pacote completo e os backups estão em
`publicacao/liv-duplo-20261017/`, ignorados pelo Git; um clone novo precisa
recuperá-los antes de preparar uma publicação. Ver [registro](PUBLICACAO.md)
e [continuidade](../conecta/CONTINUIDADE.md).

## Preview isolado

```powershell
python -I fachada/montar.py
python -m http.server 8787 --bind 127.0.0.1 --directory fachada/public
```

Abra `http://127.0.0.1:8787/`. Este preview contém somente o institucional;
`/painel` e `/maquetes/liv/` pertencem ao pacote integrado. Configuração de nome
e telefone em `config.json`; layout compartilhado em `layout.html`; conteúdo em
`paginas/`; estilos, scripts e ilustrações SVG conceituais autorais em `assets/`.

## Alternar a aparência

O botão **Experimentar novo visual**, no cabeçalho, alterna a identidade original
com a proposta azul e roxa das referências fornecidas. **Voltar ao visual atual**
restaura a apresentação original. A troca acontece na mesma página e preserva
os campos preenchidos, a ilustração selecionada e o plano de interesse.

A opção acompanha os links institucionais pelo parâmetro `?visual=novo`, sem
cookies, `localStorage` ou `sessionStorage`. A raiz sem esse parâmetro continua
com o visual original. Painel, maquetes e links de WhatsApp mantêm seus destinos.
O script `assets/visual.js` aplica a opção antes da exibição do conteúdo; os
estilos de `assets/visual-novo.css` são embutidos pelo montador junto ao CSS
original, mantendo o hash da política CSP. Sem JavaScript, o site abre no visual
original e o botão permanece oculto.

As imagens `assets/novo-*.webp` são recortes otimizados das referências visuais
fornecidas para esta proposta. São ilustrações conceituais, sem vínculo com os
imóveis reais do visualizador. Textos, links, formulário, perguntas e controles
permanecem em HTML acessível e se ajustam à largura da tela.

Verificação da alternância: `node --test tests/test_fachada_visual.mjs`.

O logo oficial fornecido está em `assets/logo-conecta.webp` e aparece nos dois
visuais. A aba Planta do novo visual usa `assets/novo-planta.webp`, a referência
detalhada fornecida depois dos PDFs.

Desde 26/10 o LIV não mostra mais o selo escuro no topo da página: o viewer não
importa `marca-liv.js`, e o logo (`logo-conecta.webp`, copiado como
`marca-telhado.webp`) virou um letreiro em pé na laje da torre, com estrutura
de aço e luz à noite, na maquete 3D
(`experimentos/liv-experimental-2026-10-14/marca-telhado.js`). `marca-liv.*`
continuam em `assets/` até a próxima publicação do LIV.

## Contato e documentos

O formulário prepara uma mensagem no navegador e apresenta um link para o
visitante continuar no WhatsApp, conferir e enviar. Não há envio automático
nem persistência dos campos pelo site. O texto integra a URL externa e pode
ficar no histórico. O institucional não integra Analytics, cookies, fontes
remotas ou armazenamento local. Isso não descreve os recursos de rastreabilidade
do produto, que têm informações e controles próprios.

Os documentos jurídicos estão marcados como rascunhos. Identificação jurídica,
condições comerciais e retenção do atendimento precisam de revisão antes da
versão definitiva. O preview isolado mantém a indexação bloqueada; o domínio
público conserva a indexação liberada em 24/10.

Referências dos rascunhos: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm),
[guia da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
e [privacidade do Firebase](https://firebase.google.com/support/privacy).
