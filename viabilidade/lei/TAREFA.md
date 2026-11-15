# Tarefa da frente Lei

Você faz parte de um time de 5 IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno (lote + lei -> opções de prédio em 3D com números). Contexto: um cliente tem um arquiteto que leva 1-2 semanas por estudo e precisa de 5-6 até achar um bom; queremos gerar várias opções em horas.

ANTES DE TUDO leia viabilidade/README.md (regras, frentes e o CONTRATO de dados). O PRD completo está em viabilidade/PRD.md, se precisar.

Regras duras:
- Pasta de trabalho: C:/Users/respawn/Desktop/imobiliaria-viabilidade (galho feat/viabilidade). Escreva SÓ dentro da sua pasta: viabilidade/lei/. O resto do projeto é só leitura. Não commite (a central commita). Não publique nada, não toque em Firebase/painel/deploy.
- Use subagentes para paralelizar a sua frente (pesquisa, leitura, testes), você coordena eles.
- Responda e escreva em português do Brasil simples.
- Se o contrato do README não servir pra você, NÃO mude o README: proponha a mudança no seu relatório final.
- Não invente número. Sem fonte = marque como não conferido.
- Quando terminar, mande o relatório final com: maestri ask "Claude Code" "<relatório: o que entregou, arquivos, o que ficou faltando, dúvidas>". Mantenha curto (até ~25 linhas).

SUA FRENTE: Lei
Levantar o zoneamento de São Carlos-SP em vigor (Plano Diretor e lei de uso e ocupação do solo/zoneamento, e alterações) e transformar em lei/zonas.json no formato Zona do contrato: coeficiente de aproveitamento básico e máximo, taxa de ocupação, permeabilidade, recuos (frontal, lateral, fundos e regras que dependem da altura), altura/pavimentos máximos, para TODAS as zonas/macrozonas que tiverem parâmetro construtivo. Cada número com lei, artigo/anexo, URL oficial e data. Anote em lei/FONTES.md as leis encontradas, versões, o que é ambíguo e se existe mapa de zoneamento em formato digital (shapefile/GeoJSON/KML/WMS) — isso é crítico pra saber em que zona cada lote cai; se existir e for baixável, baixe para viabilidade/lei/mapa/ (só arquivos de dado, em pasta própria) e diga como converter. Prioridade: as zonas onde se constrói prédio residencial.
