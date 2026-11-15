# Direitos de republicação dos mapas do Plano Diretor e do Copernicus DEM

> **Aviso importante:** Este documento **não é parecer jurídico**. É apenas um levantamento factual de fontes abertas (textos legais, página oficial da Prefeitura, carimbo/fontes dos mapas e licença do Copernicus) para subsidiar eventual análise por advogado.

---

## 1. Lei de Direitos Autorais (Lei nº 9.610/1998)

- **Fonte oficial:** https://www.planalto.gov.br/ccivil_03/leis/l9610.htm

### Texto do art. 8º, IV (exclusão de proteção)

> "Art. 8º Não são objeto de proteção como direitos autorais de que trata esta Lei:
> I - as idéias, procedimentos normativos, sistemas, métodos, projetos ou conceitos matemáticos como tais;
> II - os esquemas, planos ou regras para realizar atos mentais, jogos ou negócios;
> III - os formulários em branco para serem preenchidos por qualquer tipo de informação, científica ou não, e suas instruções;
> **IV - os textos de tratados ou convenções, leis, decretos, regulamentos, decisões judiciais e demais atos oficiais;**
> V - as informações de uso comum tais como calendários, agendas, cadastros ou legendas;
> VI - os nomes e títulos isolados;
> VII - o aproveitamento industrial ou comercial das idéias contidas nas obras."

### Texto do art. 7º, IX e X (obras cartográficas em geral)

> "Art. 7º São obras intelectuais protegidas as criações do espírito, expressas por qualquer meio ou fixadas em qualquer suporte, tangível ou intangível, conhecido ou que se invente no futuro, tais como:
> [...]
> **IX - as ilustrações, cartas geográficas e outras obras da mesma natureza;**
> **X - os projetos, esboços e obras plásticas concernentes à geografia, engenharia, topografia, arquitetura, paisagismo, cenografia e ciência;**"

### Doutrina ou decisão em fonte aberta sobre anexo ou mapa de lei

- **Não foi localizada decisão judicial** específica em fonte aberta tratando da aplicabilidade do art. 8º, IV a anexos cartográficos de lei municipal.
- Há apenas referências doutrinárias/comentários gerais em portais jurídicos apontando a tensão entre o art. 7º, IX (proteção a cartas geográficas/mapas) e o art. 8º, IV (exclusão de atos oficiais): o art. 8º, IV fala expressamente em **"textos de [...] leis [...] e demais atos oficiais"**, enquanto mapas que integram o conteúdo normativo de uma lei costumam ser tratados como parte do ato oficial, mas o enquadramento literal de anexos gráficos/cartográficos (e de suas camadas de base) exige confirmação jurídica.

---

## 2. Site da Prefeitura de São Carlos (`saocarlos.sp.gov.br`)

- **Links verificados:**
  - Página inicial: https://www.saocarlos.sp.gov.br/
  - Página do Plano Diretor Estratégico: https://www.saocarlos.sp.gov.br/index.php/habitacao-morar/166049-plano-diretor-estrategico.html
- **Resultado:** **Não encontrado.** Nem a página inicial nem a página do Plano Diretor Estratégico contêm termos de uso, política de direitos autorais ou aviso de restrição/autorização de reprodução sobre os PDFs dos anexos do Plano Diretor.

---

## 3. Base cartográfica dos Anexos 02, 05, 06 e 07

Leitura direta do carimbo e do quadro **"Fontes:"** nas imagens dos anexos em `viabilidade/terreno/dados/zonas-mapas/` (`anexo02.jpg`, `anexo05.jpg`, `anexo06.jpg`, `anexo07.jpg`).

### Transcrição do carimbo (canto inferior direito)

- **Brasão e cabeçalho:** `Prefeitura Municipal de São Carlos` / `PLANO DIRETOR DO MUNICÍPIO DE SÃO CARLOS`
- **Títulos e escalas:**
  - `ANEXO 02` — `Zoneamento da Macrozona Urbana e Perímetro Urbano` (`ESCALA 1:15.000`)
  - `ANEXO 05` — `AEIs Ambientais` (`ESCALA 1:33.000`)
  - `ANEXO 06` — `AEIs na Macrozona Urbana` (`ESCALA 1:15.000`)
  - `ANEXO 07` — `AEIs externas ao perímetro urbano` / `Restrições Aeroportuárias` (`ESCALA 1:60.000`)
- **Rodapé comum nos 4 anexos:** `Base Cartográfica: ver fontes` | `Elaboração: SMHDU` | `Data: Dezembro de 2016`
- **Aviso de copyright ou restrição:** nenhum.

### Transcrição do quadro "Fontes:" (canto inferior esquerdo)

Texto idêntico nos 4 anexos (com acréscimos específicos no 05 e no 06):

> **Fontes:**
> - *(somente Anexo 05)* Coordenadoria Municipal de Meio Ambiente
> - *(somente Anexo 06)* PROHAB - Progresso e Habitação São Carlos S/A
> - SMHDU - Secretaria Municipal de Habitação e Desenvolvimento Urbano - Bases Cartográficas (2016)
> - IGC - Instituto Geográfico e Cartográfico do Estado de São Paulo - Cartas Topográficas em escala 1:10.000, década de 1980
> - IBGE - Instituto Brasileiro de Geografia e Estatística - Malha de municípios paulistas
> - Base da Zona Rural digitalizada pelo Setor de Geoproocessamento [sic] do SAAE, a partir da base cartográfica IBGE/DSG escala 1:50.000 (década de 1970) e atualizações realizadas por meio de levantamento aerofotogramétrico de 1998 e cartas do IGC
>
> Projeção UTM (Universal Transversa de Mercator) - Datum horizontal: SAD 69, Fuso 23 - EPSG 29.183

**Observação:** Não há indicação de empresa privada contratada nem cláusula de restrição de uso nas fontes citadas; todas as instituições listadas são órgãos/entidades públicas (SMHDU, IGC, IBGE, SAAE/DSG, Coordenadoria Municipal de Meio Ambiente e PROHAB).

---

## 4. Copernicus DEM (GLO-30 / GLO-90)

- **Links oficiais consultados:**
  - Distribuidor AWS Open Data (usado no projeto): https://registry.opendata.aws/copernicus-dem/ e https://copernicus-dem-30m.s3.amazonaws.com/readme.html
  - Página oficial do conjunto de dados (Copernicus Data Space Ecosystem): https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
  - Licença de uso dos produtos Copernicus (*Licence to use Copernicus Products*, rev. 12): https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products

- **Resultado:** **Sim, é permitido** reproduzir, distribuir, comunicar ao público, adaptar e combinar recortes do Copernicus DEM (GLO-30 Public / GLO-90), inclusive para fins comerciais/lícitos, **desde que haja atribuição clara e visível**.

- **Trechos copiados:**
  - De `dataspace.copernicus.eu` (página do COP-DEM):
    > *"The GLO-30 and GLO-90 datasets are available worldwide with a free license. ESA – EU users who use the Copernicus DEM in their research are requested to use the following DOI when citing the data source in their publications: https://doi.org/10.5270/ESA-c5d3d65"*
  - De `cds.climate.copernicus.eu` (*Licence to use Copernicus Products*, rev. 12):
    > *"4.1. This Licence is free of charge, worldwide, non-exclusive, royalty free and perpetual."*
    > *"4.2. Access to Copernicus Products is given for any purpose in so far as it is lawful, whereas use may include, but is not limited to: reproduction; distribution; communication to the public; adaptation, modification and combination with other data and information; or any combination of the foregoing."*
    > *"5.1. All users of Copernicus Products must provide clear and visible attribution to the Copernicus programme."*

---

## 5. O que um advogado precisaria confirmar

1. **Enquadramento de anexos cartográficos no art. 8º, IV da Lei nº 9.610/1998:** confirmar se os mapas dos Anexos 02, 05, 06 e 07 da Lei nº 18.053/2016 são abrangidos pela exclusão de proteção autoral do art. 8º, IV ("textos de [...] leis [...] e demais atos oficiais"), apesar de o art. 7º, IX mencionar "cartas geográficas".
2. **Eventuais direitos de terceiros na base cartográfica:** confirmar se alguma camada subjacente (como o levantamento aerofotogramétrico de 1998 citado no quadro "Fontes:" ou bases do IGC/IBGE) possui restrição contratual ou de licenciamento não declarada nos PDFs.
3. **Uso comercial e recortes em produto/repositório:** confirmar se a republicação dos recortes e capturas de tela em repositório público e em ferramenta comercial de viabilidade imobiliária exige apenas atribuição da fonte oficial (Prefeitura de São Carlos — Lei nº 18.053/2016) ou alguma autorização formal do Município.
4. **Licença específica do COP-DEM:** confirmar os termos da *ESA User License* / *Mission Specific Annex* aplicáveis à instância GLO-30 Public no uso comercial e verificar se o texto de atribuição exibido no relatório/repositório atende integralmente à exigência de crédito visível.
