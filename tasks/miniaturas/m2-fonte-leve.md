# M2 — Fonte LEVE genérica

Estado: **inventário e contrato de migração**. Este documento não altera a geração atual.

Objetivo do M2:

> produzir a maquete LEVE dos imóveis piloto sem criar ou editar um script Python específico por empreendimento.

Fixtures de regressão:

- `monte-dos-cedros-37`;
- `monte-das-colinas-39`;
- `wish-castanheiras-58`.

Nenhum script específico sai antes de o caminho genérico reproduzir o resultado atual.

---

## 1. O que o cadastro já sabe

Os três imóveis já trazem em `plantas_fornecidas/<id>/unidade.json` uma parte importante da
fonte que hoje também aparece codificada nos scripts Blender.

| Dado | Cedros | Colinas | Castanheiras |
|---|---:|---:|---:|
| pavimentos | 15 | 4 | 22 |
| largura do bloco principal | 34 m | 32 m | 20 m |
| profundidade do bloco principal | 14 m | 12 m | 15 m |
| blocos/lâminas de implantação | 2 torres + caixas/portaria | 4 blocos + portaria | 2 lâminas + cobogós + caixas/embasamento |
| offsets dos blocos | cadastro | cadastro | cadastro |
| sacadas | cadastro | cadastro | cadastro |
| faixa de pavimento | cadastro | cadastro | cadastro |
| cor base | cadastro | cadastro | cadastro |
| planta interna | cadastro | cadastro | cadastro |

O cadastro, portanto, já deve ser a autoridade para:

- número de pavimentos;
- pegada do bloco principal;
- implantação e offsets;
- identificação do bloco principal;
- elementos auxiliares descritos em `lote.predio.blocos`;
- parâmetros arquitetônicos medidos ou declarados;
- planta interna.

**Regra M2:** nenhum desses fatos deve continuar duplicado como constante específica de imóvel
quando o gerador genérico puder lê-lo do cadastro.

---

## 2. O que os scripts específicos fazem hoje

### `modelar_montes.py`

Um único script já atende Cedros e Colinas.

**Lê do cadastro:**

- `largura_m`;
- `profundidade_m`;
- `pavimentos`;
- posições dos blocos com sacada.

**Ainda decide no Python:**

- paleta/material de acabamento;
- profundidade do recuo;
- largura visual das sacadas;
- centros de sacadas;
- posição/tamanho de janelas;
- ritmo de luzes/cortinas;
- molduras;
- cobertura;
- detalhes de acesso;
- desenho da portaria;
- câmera de inspeção;
- textos de metadata.

Cedros/Colinas já provam que **um algoritmo pode atender mais de um empreendimento** quando os
parâmetros variáveis ficam separados.

### `modelar_castanheiras.py`

Ainda é um gerador próprio.

Ele reimplementa localmente operações que já existem em `blender_maquete_base.py`:

- criação de materiais;
- `box`;
- agrupamento/flush;
- cópias por torre/pavimento;
- exportação para JSON/GLB;
- parte da configuração de render.

Além disso, codifica:

- as duas lâminas;
- 22 pavimentos;
- offsets entre lâminas;
- balcões/recuos;
- cobogós/treliças;
- ritmo de cortinas;
- vasos/folhagem;
- cobertura/embasamento;
- câmera e iluminação.

Parte relevante desses fatos já existe em `lote.predio.blocos`.

---

## 3. Três classes de informação

Toda constante encontrada durante o M2 deve receber uma destas classes.

### DADO_DO_IMOVEL

Fato do empreendimento/unidade.

Exemplos:

- dimensões;
- pavimentos;
- posição de blocos;
- largura/profundidade de sacada;
- cor observada;
- presença de cobogó;
- portaria;
- bloco principal.

Destino: cadastro ou fonte normalizada derivada dele.

### REGRA_DA_FABRICA

Algoritmo reutilizável.

Exemplos:

- criar material;
- construir caixa;
- gerar UV métrica;
- repetir pavimento;
- instanciar torre;
- exportar modelo;
- validar pavimentos/lajes;
- gerar GLB;
- câmera/render de inspeção.

Destino: biblioteca/genérico.

### EXCECAO_NAO_REPRESENTADA

Decisão visual necessária que o schema ainda não sabe representar.

Exemplos atuais:

- sequência específica de molduras;
- composição de treliça/cobogó;
- ritmo decorativo de luz/cortina;
- detalhes particulares de cobertura/acesso;
- distribuição ornamental de vasos.

Destino temporário: perfil declarativo/override, **não novo script por empreendimento**.

---

## 4. Saídas de referência

Os modelos atuais continuam sendo a régua de regressão.

### Cedros

`v1.5/miniaturas/monte-dos-cedros_blender/validacao.json`:

- Blender 5.2.2 LTS;
- 2 torres;
- 15 pavimentos;
- 35 geometrias;
- 64 grupos;
- `modelo.json`: 1.402.016 bytes.

### Colinas

`v1.5/miniaturas/monte-das-colinas_blender/validacao.json`:

- Blender 5.2.2 LTS;
- 4 blocos;
- 4 pavimentos;
- 35 geometrias;
- 122 grupos;
- `modelo.json`: 1.398.132 bytes.

### Castanheiras

`v1.5/miniaturas/castanheiras_blender/validacao.json`:

- Blender 5.2.2 LTS;
- 2 lâminas;
- 22 pavimentos por lâmina;
- 18 geometrias compartilhadas;
- 396 objetos;
- `modelo.json`: 2.025.822 bytes.

Essas medidas não significam, sozinhas, equivalência visual. Cada migração precisa preservar:

- estrutura esperada do modelo;
- gates atuais;
- build final correspondente;
- inspeção visual quando a mudança tocar geometria/fachada.

---

## 5. Fonte normalizada LEVE v1

M2 não deve inventar um cadastro paralelo. A primeira fonte normalizada é uma **projeção do cadastro
mais um perfil visual declarativo**.

Forma conceitual:

```json
{
  "schema": 1,
  "propertyId": "...",
  "building": {
    "floors": 0,
    "floorHeight": 3.15,
    "blocks": []
  },
  "style": {
    "profile": "...",
    "materials": {},
    "features": {}
  },
  "render": {
    "inspection": {}
  }
}
```

### `building`

Derivado do cadastro.

Não duplicar manualmente offsets/dimensões já existentes.

### `style.profile`

Identifica **família visual**, não empreendimento.

Primeiras famílias candidatas:

- `montes-mrv-v1`;
- `castanheiras-ebm-v1`.

Ter duas famílias é aceitável no M2.

O que não é aceitável:

- `if propertyId == "monte-dos-cedros-37"`;
- novo `modelar_<empreendimento>.py`;
- copiar o algoritmo inteiro para cada imóvel.

### `style.features`

Parâmetros declarativos ainda não representados pelo cadastro:

- paleta;
- recuos visuais;
- molduras;
- cobogó/treliça;
- ritmo de aberturas;
- cobertura;
- portaria/embasamento;
- ornamentação.

O M2 pode começar com um schema pequeno e crescer só quando uma fixture exigir.

---

## 6. Arquitetura-alvo do gerador

```text
unidade.json
    ↓
normalizar_leve(propertyId)
    ↓
fonte LEVE v1
    ↓
gerador_blender_leve.py
    ├── biblioteca comum
    ├── perfil montes-mrv-v1
    └── perfil castanheiras-ebm-v1
    ↓
modelo.json + GLB + validacao.json + preview
```

O gerador não conhece IDs específicos de imóvel.

O perfil conhece uma linguagem visual.

O cadastro conhece os fatos do imóvel.

---

## 7. Ordem de migração decidida

### M2.1 — Montes declarativo

Primeiro Cedros e Colinas.

Motivo:

- já compartilham o mesmo algoritmo;
- a diferença entre eles já está concentrada em poucos `if kind == ...`;
- permite provar o contrato com menor risco.

Entrega:

1. criar fonte normalizada para os dois;
2. mover parâmetros variáveis para perfil declarativo;
3. o mesmo gerador recebe as duas fontes;
4. saída atual permanece como referência;
5. `modelar_montes.py` continua existindo até a prova.

### M2.2 — Castanheiras na infraestrutura comum

Antes de generalizar a fachada:

1. remover duplicação de utilitários locais;
2. usar `blender_maquete_base.py` ou sua evolução compatível;
3. provar que o modelo continua equivalente.

Só depois transformar sua linguagem visual em perfil declarativo.

### M2.3 — Um único entry point

Quando as três fixtures passarem:

```bash
blender --background --factory-startup \
  --python v1.5/miniaturas/gerar_leve.py \
  -- monte-dos-cedros-37
```

e o mesmo comando deve aceitar Colinas e Castanheiras.

Nenhum operador escolhe script por empreendimento.

---

## 8. Gates por etapa

### Gate M2.1

Cedros e Colinas:

- mesma contagem de pavimentos/torres;
- validadores atuais verdes;
- `modelo.json` estruturalmente equivalente;
- GLB válido;
- build por imóvel reproduz o build de referência de cada fixture;
- nenhuma alteração de produção.

Byte a byte é desejável quando o Blender/serialização permitirem. Se não for possível, a divergência
deve ser explicada e o gate passa para equivalência estrutural + visual explícita; nunca silenciosa.

### Gate M2.2

Castanheiras:

- mesma estrutura/roles esperados;
- modelo/GLB válidos;
- nenhuma perda de treliça/cobogó/embasamento;
- inspeção visual obrigatória se bytes mudarem;
- build do imóvel continua estável.

### Gate M2 final

Um único entry point gera as três fixtures sem editar código ou escolher script específico.

---

## 9. O que não fazer

- não apagar `modelar_montes.py` agora;
- não apagar `modelar_castanheiras.py` agora;
- não mudar PREMIUM;
- não misturar qualidade progressiva;
- não refazer `pagina_maquete.py`;
- não mudar build/publicação;
- não transformar decisões visuais desconhecidas em inferência automática;
- não forçar uma única família visual prematuramente.

---

## 10. Primeiro PR funcional autorizado

O próximo PR depois deste inventário é **M2.1a — normalização LEVE dos Montes**.

Escopo:

- função pura que lê Cedros/Colinas e produz a fonte normalizada v1;
- perfil declarativo `montes-mrv-v1`;
- testes provando que dimensões, blocos, pavimentos, offsets e parâmetros atuais são preservados;
- **nenhum Blender executado no CI**;
- nenhum gerador atual removido;
- nenhum byte de produção alterado.

Depois disso, M2.1b faz `modelar_montes.py` consumir essa fonte em vez de constantes específicas.
