# Tarefa da frente Produto

Você faz parte de um time de 5 IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno (lote + lei -> opções de prédio em 3D com números). Contexto: um cliente tem um arquiteto que leva 1-2 semanas por estudo e precisa de 5-6 até achar um bom; queremos gerar várias opções em horas.

ANTES DE TUDO leia viabilidade/README.md (regras, frentes e o CONTRATO de dados). O PRD completo está em viabilidade/PRD.md, se precisar.

Regras duras:
- Pasta de trabalho: C:/Users/respawn/Desktop/imobiliaria-viabilidade (galho feat/viabilidade). Escreva SÓ dentro da sua pasta: viabilidade/produto/. O resto do projeto é só leitura. Não commite (a central commita). Não publique nada, não toque em Firebase/painel/deploy.
- Use subagentes para paralelizar a sua frente (pesquisa, leitura, testes), você coordena eles.
- Responda e escreva em português do Brasil simples.
- Se o contrato do README não servir pra você, NÃO mude o README: proponha a mudança no seu relatório final.
- Não invente número. Sem fonte = marque como não conferido.
- Quando terminar, mande o relatório final com: maestri ask "Claude Code" "<relatório: o que entregou, arquivos, o que ficou faltando, dúvidas>". Mantenha curto (até ~25 linhas).

SUA FRENTE: Produto
Descobrir o que um estudo de viabilidade de arquiteto/incorporadora contém de verdade no Brasil (estudo de massa / estudo de potencial construtivo / viabilidade de incorporação): quais números, desenhos, premissas, como é apresentado ao dono do terreno, o que pesa na negociação (permuta, VGV, área privativa vendável, número de unidades, vagas). Pesquise exemplos públicos e modelos. Depois mapeie concorrentes que geram isso automaticamente (Autodesk Forma, TestFit, Archistar, Giraffe, e brasileiros se houver), o que fazem, preço, o que não fazem. Termine com: (a) o formato do NOSSO relatório de uma página por opção (o que entra, em que ordem), (b) quais premissas o motor precisa a mais além do contrato atual (ex.: vagas por unidade, área de garagem, eficiência), (c) 5 perguntas pra fazer ao cliente sobre o estudo que o arquiteto dele entrega. Tudo em produto/ESTUDO-REAL.md, com links.
