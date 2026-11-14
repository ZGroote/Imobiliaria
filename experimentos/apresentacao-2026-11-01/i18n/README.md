# Português e inglês da apresentação

`site/index.html` continua sendo a única fonte de estrutura. `en.json` traduz
os textos dessa página e as mensagens dinâmicas de `site/site.js`. Conecta,
Conecta Imóveis 3D e Vila Aurora mantêm os nomes oficiais.

Da raiz do repositório:

```powershell
python -I experimentos/apresentacao-2026-11-01/i18n/build.py
python -I experimentos/apresentacao-2026-11-01/i18n/build.py --check
python -m unittest discover -s experimentos/apresentacao-2026-11-01/i18n -p test_build.py
```

O build gera `site/index.en.html` e `site/i18n.js`; `--runtime-only` gera apenas
o script. `--check` não escreve nada e falha se houver texto estático sem
tradução ou se o runtime não corresponder ao catálogo. A página inglesa usa
`lang="en"`, metadados em inglês e canonical `https://conectaimoveis3d.com/`.
URLs de recursos, links, IDs, classes e atributos `data-*` são preservados;
os links alternativos de idioma devem ser definidos no HTML fonte.

Carregar `i18n.js` antes de `site.js`, ambos com `defer`. O idioma vem de
`document.documentElement.lang`, sem geolocalização nem redirecionamento.

```js
window.ConectaI18n.lang;      // "pt-BR" ou "en"
window.ConectaI18n.isEnglish; // boolean
window.ConectaI18n.t("Etapa {atual} de 4", { atual: 2 });
// "Etapa 2 de 4" em PT; "Step 2 of 4" em EN
```

Traduzir o template antes de interpolar. Os parâmetros são texto e devem ser
atribuídos com `textContent`, como nos controles atuais. Chave ausente conserva
o português; parâmetro ausente conserva `{parametro}`. Isso permite que a
landing portuguesa continue funcionando se o script de tradução não carregar.
`site.js` mantém o mesmo fallback PT na suíte existente.

O iframe externo recebe `lang=en` na versão inglesa. A tradução do viewer e
a configuração dos domínios pertencem à integração de publicação; este build
não altera o viewer, contas, DNS ou Hosting.
