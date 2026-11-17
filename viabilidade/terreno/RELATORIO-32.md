# Terrenos vazios para a vitrine (tarefa 32, 17/11)

**O que foi feito:**
- 6 lotes vazios gravados em `pilotos-vagos/`;
- folha de prova em `evidencias/t32/vagos-32.jpg`.

**O que não foi tocado:** `motor/exemplos/pilotos/`, `motor/`, `visual/`, `projetista/`, `relatorio/`, painel, `.github/`, config e hook.

**Rede:** só ladrilhos de satélite Esri World Imagery z18. Baixei 77 ladrilhos novos; o resto veio do cache da t26.

**Commit:** nenhum.

## Funil

**Base `completo`:** 110.089 lotes.
- 74.187 estão em `lotes_ocupados.json`.
- Sobram 35.902 não ocupados.

**Os índices batem com `novo_lote --indices`:**
- 7 de 7 pilotos estão na lista de ocupados.
- Dos lotes com ponto de endereço do SigaSC dentro, 89,0% estão na lista. Com os índices deslocados, o número cai: 84,7% (deslocando +1) e 74,3% (deslocando +50.000).
- Os que escapam têm o ponto colado na divisa (mediana 2,0 m para dentro), ou seja, é efeito de borda.

| Etapa | Lote único | Remembramento |
|---|---|---|
| Na faixa, não ocupado, sem endereço do SigaSC/CNEFE dentro nem a 8 m | 445 | 1.136 grupos de lotes vizinhos não ocupados, mesma quadra |
| Passa no `gerar` (zona conhecida, longe da divisa, frente para rua) | **361** | **232** |
| Foi para o satélite (frente comum, sem área especial sobreposta, um ou dois por bairro) | 11 | 20 |

**Por que caíram no `gerar` (lote único):**
- sem frente: 35;
- linha de divisa de zona: 25;
- várias cores de zona: 7;
- cor de divisa ou fora do zoneamento: 6;
- inválido depois de arredondar: 4;
- fora do perímetro: 2;
- invasão de asfalto: 1;
- sobreposição: 1.

**Por que o médio e o grande são remembramento:** quase todo lote único vazio com 1.000 m² ou mais está no C.E.A.T. (polo empresarial). Para variar o bairro, juntei lotes vizinhos vazios da mesma quadra, como no piloto `remembramento-75352-75354`.

## Satélite: 31 conferidos, 11 rejeitados

| # | Lote | Motivo |
|---|---|---|
| 1 | P 430 m², Parque Faber I | casa |
| 2 | P 551 m², Parque Santa Mônica | casa e piscina |
| 3 | P 420 m², Parque Santa Mônica | casa e jardim de casa |
| 4 | P 515 m², Parque Faber I | quadra esportiva |
| 5 | P 405 m², Jardim Cardinali | casa e piscina |
| 15 | M 1.260 m², Res. Américo Alves Margarido | estrutura e terra mexida na frente (possível obra) |
| 17 | M 1.260 m², Chácara São João | copa fechada, o chão não aparece |
| 18 | M 1.262 m², Vila Boa Vista I | casa dentro do contorno |
| 22 | M 1.144 m², Cond. Res. Bosque de São Carlos | casas dentro do contorno |
| 25 | G 3.364 m², Vila Marina | cemitério |
| 27 | M 1.183 m², Chácara Bataglia | muro e laje na divisa |

**Resumo:**
- **Construção:** 9 dos 11.
- **Não deu para confirmar:** 2 (#15 e #17).
- **Vazios:** os outros 20. Os 6 escolhidos saíram daí.
- **O que pesa:** dos 7 pequenos que foram ao satélite, 5 tinham casa. O cadastro de endereço não pega toda casa nova.

## Os 6 escolhidos

| Arquivo | Índice(s) | Área | Zona | Bairro | Frente | Declividade |
|---|---|---|---|---|---|---|
| `SC-vago-P-20201` | 20201 | 414,4 m² | SC-Z2 | Planalto Paraíso | 8,4 m | 8,2% |
| `SC-vago-P-23861` | 23861 | 426,2 m² | SC-Z2 | Jardim Cardinali | 12,1 m | 12,8% |
| `SC-vago-M-23091-23093` | 23091–23093 (3 lotes) | 1.286,7 m² | SC-Z2 | Parque Faber I | 13,0 m | 5,5% |
| `SC-vago-M-4527-4532` | 4527–4532 (6 lotes) | 1.603,4 m² | SC-Z2 | Jardim Ipanema | 10,5 m | 3,8% |
| `SC-vago-G-97278-97285` | 97278–97285 (8 lotes) | 3.340,5 m² | SC-Z3 | Samambaia Residencial | 11,9 m | 6,7% |
| `SC-vago-G-37707` | 37707 | 2.665,9 m² | SC-Z4 | C.E.A.T. | 29,5 m | 2,3% |

**Como foram gerados:**
- Todos com `novo_lote.py --base completo --zona auto`.
- Em todos, a frente sai pela aresta comum (`regra` nula).
- Nenhum tem área especial sobreposta. Só aparece `possivel_incidencia` de "Superfícies de aproximação" (aeroporto) no 20201 e no 97278–97285; o resto é `nao_verificada`, igual aos pilotos.

**Pontos de atenção:**
- **Frente curta nos remembramentos:** os grupos M e G de 3 a 8 lotes têm a frente de um lote só (10 a 13 m). A união é funda e estreita. Se a vitrine quiser frente larga, o G do C.E.A.T. (29,5 m) é o melhor.
- **23091–23093:** o satélite mostra um risco no chão atravessando o lote, que parece degrau de terra. Não é construção.
- **97278–97285:** é um gramado limpo dentro de um loteamento fechado.

## Testes

Todos passam:
- `novo_lote.py`, `gerar_lotes.py`, `preparar_relevo.py` e `preparar_zonas.py` com `--testar`;
- `testar_pilotos.py` (7 pilotos);
- `test_areas_especiais.py`, `test_cache.py`, `test_ponto.py` e `test_sugerir_zona.py`.
