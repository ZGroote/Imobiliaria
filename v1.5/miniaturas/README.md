# Padrão atual — 23/09/2026

O **Monte dos Cedros** usa o padrão aprovado de luz calculada no exterior, planta 3D e visita. O gerador habitual já seleciona essa versão por padrão. Colinas e Castanheiras permanecem na versão anterior.

- [Processo completo, fontes, ferramentas, testes e reversão](PADRAO-ATUAL.md)
- Montador: `padrao_atual.py`; fontes: `padrao-atual/`.
- Publicação: `python v1.5/miniaturas/preparar_publicacao.py`, QA `qa_padrao_atual.py`, depois Firebase com `firebase.miniaturas.json`.
- Saída pública atual: `publicado-atual/`, 20 arquivos permitidos. O mapa principal não é publicado por esse fluxo.
- Fonte e integridade da versão: `padrao-atual/release.json` e `publication-hashes.json`.

As seções abaixo são o registro anterior à promoção. Para o Cedros, os comandos e critérios de `PADRAO-ATUAL.md` têm precedência.

---

# miniaturas

## Publicação Firebase

Site das três miniaturas: https://imobilaria-deccb-miniaturas.web.app
Projeto Firebase: `imobilaria-deccb`; site separado: `imobilaria-deccb-miniaturas`.
O site principal do mapa não é alterado por esta configuração.

```powershell
python v1.5/miniaturas/preparar_publicacao.py
npx firebase deploy --only hosting --config firebase.miniaturas.json --project imobilaria-deccb --non-interactive
```

O preparador copia uma lista explícita de 13 arquivos para `publicado/` e verifica
os links: entrada, três maquetes, três renders, três GLBs e três projetos Blender.
Scripts, referências de pesquisa e arquivos de QA ficam fora da publicação.
O Hosting revalida o cache para receber atualizações nos mesmos endereços.

## Monte dos Cedros e Monte das Colinas — Blender

Abra `index.html` para escolher uma das novas maquetes. As páginas
`maquete-monte-dos-cedros-37.html` e `maquete-monte-das-colinas-39.html` funcionam
offline, com modelo embutido, planta 2D, planta mobiliada e visita em primeira pessoa.
O botão **Ver conjunto** alterna entre o bloco da unidade e os blocos do cadastro.
O 8º andar do Cedros e o 3º do Colinas continuam destacados.

Os modelos foram criados no Blender 5.2.2, com sacadas recuadas, guarda-corpos,
esquadrias divididas, peitoris, soleiras, marquises, portaria, cortinas iluminadas,
rufos, platibandas e ventilação da cobertura. A fachada segue as imagens oficiais
da MRV salvas em `referencias/`; fundos e dimensões são aproximados. O Colinas usa
quatro blocos representativos do cadastro, não a implantação completa oficial.

Fontes: [Cedros](https://www.mrv.com.br/imoveis/sao-paulo/sao-carlos/apartamentos-monte-dos-cedros)
e [Colinas](https://www.mrv.com.br/imoveis/sao-paulo/sao-carlos/apartamentos-residencial-monte-das-colinas).

Em cada pasta `monte-*_blender/` ficam `.blend`, `.glb`, exportação offline
`modelo.json`, render geral, render de detalhe e `validacao.json`. O arquivo
`modelar_montes.py` modela a família MRV a partir da fonte LEVE normalizada; `blender_maquete_base.py` compartilha exportação e render. O argumento do Blender é o `propertyId`, não um apelido do empreendimento.
`castanheiras.js` lê ambos os formatos de exportação (matrizes/índices novos e
posição/escala do Castanheiras), sem gerar fachadas no navegador.

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python v1.5/miniaturas/modelar_montes.py -- monte-dos-cedros-37
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python v1.5/miniaturas/modelar_montes.py -- monte-das-colinas-39
python v1.5/miniaturas/pagina_maquete.py --unidade monte-dos-cedros-37 --saida v1.5/miniaturas/maquete-monte-dos-cedros-37.html
python v1.5/miniaturas/pagina_maquete.py --unidade monte-das-colinas-39 --saida v1.5/miniaturas/maquete-monte-das-colinas-39.html
python v1.5/miniaturas/qa_visual.py maquete-monte-das-colinas-39.html --nome colinas-conjunto --conjunto
```

GLBs têm cerca de 0,9 MB; HTMLs cerca de 3,3 MB. Os renders de conferência usam
Cycles; a página usa a iluminação interativa do Three.js. Não altera a publicação
Firebase nem as miniaturas internas do mapa.

A maquete do imóvel: a miniatura 3D que fica junto da ficha, e as três leituras que
saem dela — planta 2D, planta 3D e visita em primeira pessoa.

Feito entre 19 e 20/09/2026. O registro de engenharia (o porquê de cada decisão, e os
defeitos que custaram caro) está na **seção 26 do [PIPELINE.md](../PIPELINE.md)**.

---

## Abrir agora, sem instalar nada

```
v1.5/miniaturas/maquete.html
```

Duplo clique. São cerca de 1,8 MB com o three.js embutido — não depende de rede, de servidor
nem de build. É a página que está publicada em
`https://claude.ai/artifact/JSqvSPTHCibgdGMVdtd3hx`.

**Este HTML é saída, não fonte.** Quem o escreve é o `pagina_maquete.py`; editar o
HTML na mão é trabalho que a próxima montagem apaga.

---

## O que tem aqui

| arquivo | o que é |
|---|---|
| `pagina_maquete.py` | **o montador da página.** Escreve o HTML inteiro — dado, CSS e programa. Trocar de imóvel é trocar o dicionário `IMOVEL`, no topo do arquivo. |
| `maquete.html` | a página montada, pronta pra abrir. |
| `testa_etapas.py` | portão headless de 8 sondas sobre as três etapas (mapa, interior, planta) e a maquete da ficha. Mede a página montada do **v16-moveis**, o padrão, com o acervo de verdade. |

```bash
python v1.5/miniaturas/pagina_maquete.py                 # -> v1.5/miniaturas/maquete.html
python v1.5/miniaturas/pagina_maquete.py --saida x.html

python v1.5/miniaturas/testa_etapas.py sao-carlos --unidade <id>   # mede a página do v16-moveis, o padrão
```

## Acabamento visual — 21/09/2026

O gerador agora inclui reboco e concreto com textura procedural e relevo fino,
vidros com variação discreta de tonalidade, divisões das esquadrias, peitoris em
3D, bordas levemente chanfradas e cobertura com platibanda e remate. O recuo das
paredes foi corrigido para deslocar o contorno para dentro. As dimensões e os
blocos vêm do mesmo cadastro; estes acabamentos são ilustrativos, não uma
reconstituição confirmada das fachadas. Não há downloads de texturas.

As duas páginas desta pasta foram reconstruídas.

### Castanheiras modelado no Blender

O Castanheiras agora usa geometria criada no **Blender 5.2**, a partir da perspectiva
em `referencias/castanheiras.png`: duas torres, sacadas com 2 m de profundidade,
guarda-corpos e treliças vazadas, janelas menores, cortinas acesas e portaria.
Os 22 pavimentos e o envelope vêm do cadastro. A profundidade das sacadas e os
fundos são aproximações visuais; não é um levantamento arquitetônico certificado.

- `modelar_castanheiras.py`: gerador da família Castanheiras; consome a fonte LEVE normalizada (`castanheiras-ebm-v1`), reutiliza `material`, `box`, `flush` e `MATS` de `blender_maquete_base.py` e mantém cópias/exportação `p/s` próprios nesta etapa.
- `castanheiras_blender/castanheiras.blend`: projeto editável, referência empacotada.
- `castanheiras_blender/castanheiras.glb`: modelo interoperável, cerca de 0,9 MB.
- `castanheiras_blender/preview.png`: render Cycles.
- `castanheiras_blender/modelo.json`: malhas avaliadas do Blender para a página offline.
- `castanheiras.js`: importa essas malhas com instâncias e conserva o destaque do andar.

O HTML do Castanheiras tem cerca de 4 MB, com o modelo embutido. O Three.js apenas
exibe a exportação; as sacadas e os detalhes não são mais modelados no navegador.
Para reconstruir, execute o script com Blender e depois monte o HTML:

```powershell
& 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python v1.5/miniaturas/modelar_castanheiras.py -- wish-castanheiras-58
python v1.5/miniaturas/pagina_maquete.py --unidade wish-castanheiras-58 --saida v1.5/miniaturas/maquete-wish-castanheiras-58.html
```

Para conferir a página avulsa no Chrome instalado, gerar captura e métricas:

```bash
python v1.5/miniaturas/qa_visual.py maquete.html --nome depois
python v1.5/miniaturas/qa_visual.py maquete-wish-castanheiras-58.html --nome wish-depois
python v1.5/miniaturas/qa_visual.py maquete-wish-castanheiras-58.html --modo planta3d --nome planta3d
```

As imagens e métricas ficam em `qa/`. A opção `--mobile` usa janela estreita e DPR
1,75; a largura efetiva é registrada no JSON (o Chrome pode impor largura mínima).
Não substitui teste em aparelho físico. O buffer de desenho é preservado somente
na cópia temporária usada para a captura.

---

## O que NÃO está aqui, e por quê

O renderizador vivo é o vizinho desta pasta, dentro do mesmo `v1.5/`:

- `../renderizador-v16-moveis/` — o renderizador modularizado, de onde saem o three.js
  e o catálogo de móveis que a maquete reaproveita. As três etapas (mapa, interior,
  planta) e a maquete sobre a ficha moram nele, em `listings/stage.js`.

**Removidos do `HEAD` no #48, e só históricos:** o `renderizador-v17/` (as três etapas e a
planta 3D em cena própria), o `renderizador-v18/` (a maquete como fio condutor da ficha
até a visita) e os dois demos que os montavam (`demo_v17.py` e `demo_v18.py`). O que eles
traziam já tinha sido portado para o v16-moveis. O código continua no histórico do git e
na branch `claude/serene-edison-de1ior`.

Até 21/09/2026 esses renderizadores moravam na raiz, porque `pipeline/montar.py` achava a variante
por `FONTE = renderizador-<MAPA_V>`. Isso deixou de ser verdade: `pipeline/build/config.py`
agora procura em `v1.5/renderizador-<MAPA_V>`. O **v15**, o monólito de onde as peças foram
extraídas, ficou na raiz em `renderizador/` até sair do `HEAD` no #49.

`firebase.v17.json` não está no `main`: ele só existe na branch
`claude/serene-edison-de1ior`, junto do trabalho original do v17 (`facd7ef`). Nenhum
config do `main` publica o v17; o mapa publicado usa o `firebase.json`
(`v16-moveis/publicado`).

---

## Quatro defeitos que esta pasta existe pra não repetir

Todos custaram uma ida e volta, e **nenhum deles dá erro no console**. Estão em detalhe
no PIPELINE.md; o resumo, porque a mesma armadilha reaparece em qualquer cena 3D nova:

1. **Câmera de sombra que não cabe no objeto não deixa sombra errada — deixa o objeto
   PRETO.** Nos ±5 m do padrão do three, todo fragmento fora da caixa da luz é
   amostrado fora do mapa, e isso lê como sombra total.
2. **`metalness` sem mapa de ambiente também é preto.** Vidro não é pintado pela luz, é
   pelo que reflete. Como a página abre com duplo clique, o céu é gerado: um degradê
   equirretangular de 64×32 passado pelo PMREM.
3. **`hidden` é propriedade de `HTMLElement`, e `<svg>` não é um.** `svg.hidden = false`
   cria uma propriedade solta que depois *lê* como `false`, mas o atributo do markup
   fica, e `[hidden]{display:none!important}` continua valendo.
4. **Canvas sem tamanho de CSS é exibido no tamanho do BUFFER.** Num monitor de dpr 1
   os dois números coincidem e não se vê nada; num celular de dpr 1,75 a maquete sai
   75% maior que o painel. Por isso `ren.setSize(w, h)` atualiza o estilo, e por isso o
   montador **reprova a saída** se sobrar marcador de formatação (`%%`, `%(...)s`,
   `@@...@@`) — foi um `width:100%%` inválido que produziu esse caso.

E uma armadilha de MEDIÇÃO, não de código: em Chrome headless o relógio de animação
congela junto com o rAF. Transição de CSS fica presa em `running` e o print mostra o
valor inicial; `readPixels` fora do rAF devolve um buffer já apagado. Para fotografar o
estado de verdade: `*{transition:none!important}` antes, e desenhar por
`window.__maq.quadro(t)` com relógio crescente — e não chamando `render` direto, senão
o que o laço DECIDE (a câmera da visita, o passo de caminhada) nunca roda.
