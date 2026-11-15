# Tarefa da frente Conferência

Você faz parte de um time de IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno em São Carlos-SP (lote + lei → opções de prédio em 3D com números). Leia `viabilidade/README.md` (regras e contrato).

## Seu papel: conferente independente da lei

A frente Lei já extraiu os números do zoneamento. Um recuo ou coeficiente errado faz um prédio "caber" quando não cabe. Você confere **sem olhar o trabalho dela primeiro**.

### Passo 1: leitura às cegas

NÃO abra `viabilidade/lei/zonas.json` nem `viabilidade/lei/FONTES.md` ainda.

Leia direto no portal oficial (servico.saocarlos.sp.gov.br/consultaleis):

- Lei 18.053/2016 (Plano Diretor): quadros/anexos de parâmetros por zona.
- Lei 19.950/2020 (Código de Obras) e alterações 20.072/2021, 22.285/2024 e 24.031/2026: recuos, afastamentos, áreas não computáveis e vagas.

Extraia, para as zonas onde se constrói prédio residencial (Eixo Estruturante, Z1, Z2) e para as que a lei deixa confusas (Z5A, Z5B, Z6B, Z6E):

- CA básico e máximo
- taxa de ocupação
- permeabilidade
- recuos (frontal, lateral e fundos, incluindo a regra que muda com a altura e a de parede cega)
- altura máxima
- o que não é computável
- vagas mínimas

Cada número com lei, artigo/anexo e trecho literal curto.

Grave em `viabilidade/conferencia/leitura-independente.md`.

### Passo 2: comparação

Só agora abra `viabilidade/lei/zonas.json` e `FONTES.md`. Monte `viabilidade/conferencia/CONFERENCIA.md` com uma tabela: zona | parâmetro | Lei disse | você leu | bate? | fonte. Termine com a lista do que NÃO bate, e para cada item qual leitura está certa e por quê. Se não der pra decidir, escreva "precisa de profissional".

### Regras

- Escreva SÓ em `viabilidade/conferencia/`. Não altere `lei/` nem nada fora. Não commite (a central commita).
- Só acesse o que a fonte oferece abertamente: nada de forçar parâmetro de URL, burlar bloqueio ou contornar login.
- Não invente número. Português do Brasil simples.
- Ao terminar, mande o relatório (até ~20 linhas) com:
  `maestri ask "Claude Code" "<relatório>"`
