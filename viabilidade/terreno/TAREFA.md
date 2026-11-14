# Tarefa da frente Terreno

Você faz parte de um time de 5 IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno (lote + lei -> opções de prédio em 3D com números). Contexto: um cliente tem um arquiteto que leva 1-2 semanas por estudo e precisa de 5-6 até achar um bom; queremos gerar várias opções em horas.

ANTES DE TUDO leia viabilidade/README.md (regras, frentes e o CONTRATO de dados). O PRD completo está em viabilidade/PRD.md, se precisar.

Regras duras:
- Pasta de trabalho: C:/Users/respawn/Desktop/imobiliaria-viabilidade (galho feat/viabilidade). Escreva SÓ dentro da sua pasta: viabilidade/terreno/. O resto do projeto é só leitura. Não commite (a central commita). Não publique nada, não toque em Firebase/painel/deploy.
- Use subagentes para paralelizar a sua frente (pesquisa, leitura, testes), você coordena eles.
- Responda e escreva em português do Brasil simples.
- Se o contrato do README não servir pra você, NÃO mude o README: proponha a mudança no seu relatório final.
- Não invente número. Sem fonte = marque como não conferido.
- Quando terminar, mande o relatório final com: maestri ask "Claude Code" "<relatório: o que entregou, arquivos, o que ficou faltando, dúvidas>". Mantenha curto (até ~25 linhas).

SUA FRENTE: Terreno
(1) Lotes: o arquivo lotes_saocarlos.geojson (113.501 lotes, WGS84; propriedades lid, quadra, fx/fy em UTM 23S) e sao-carlos/dados/lotes_saocarlos_completo.geojson. Descubra o que cada um tem, a qualidade (lote torto, sobreposto, área absurda) e escolha 5 lotes-piloto bons pra prédio: 2 grandes (>1.500 m2), 2 médios (600-1.500 m2), 1 de esquina, preferindo regiões centrais/verticalizadas de São Carlos. Gere terreno/lotes-piloto.json no formato Lote do contrato (poligono_utm em EPSG:31983, frente = lado voltado pra rua; use as ruas do projeto se houver, ex. sao-carlos/dados/street_tris.json, explique como achou). zona_id fica null por enquanto (a frente Lei está levantando o mapa de zonas). (2) Relevo: avalie sao-carlos/relevo_wide.json (o que é, resolução) e pesquise fontes melhores e gratuitas para São Carlos (Copernicus GLO-30, ALOS, FABDEM, IBGE, mapeamento do Estado de SP/IGC/DataGEO, curvas de nível da prefeitura, LiDAR se houver). Para cada fonte: resolução, precisão vertical, licença, como baixar. Se uma for claramente melhor e baixável sem login, baixe só o recorte de São Carlos pra viabilidade/terreno/dados/ e preencha o campo relevo dos 5 lotes. Relatório em terreno/RELEVO.md. Use python -I para scripts.
