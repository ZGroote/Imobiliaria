| Piloto (base completo) | Manual | Automática (`auto`) |
|---|---|---|
| 30516 | Z4 | Concorda: Z4. |
| 37607 | Z4 | Concorda: Z4. |
| 22426 | Z1 | Recusa: cor encoberta; alternativas Z1/EIXO. |
| 22421 | Z1 ambígua | Recusa: divisa <10 m e cor encoberta; alternativas Z1/Z2/EIXO. |
| 25297 | Z1 | Concorda: Z1. |
| q1382, 11984–11988 | EIXO | Recusa: cores misturadas/encobertas; EIXO entre as alternativas, confirmar testada. |
| remembramento 75352–75354 | Z2 | Leitor concorda: Z2; montagem recusa vizinho 75351 inválido (validação anterior preservada). |

Limites: sugestão não conferida; pixels ~1,4 m, recuperação até 3 pixels, RGB ≤18; divisa conservadora <10 m recusa, Eixo ≤60 m vira alternativa; RMSE 3,53 m não é acurácia. Busca 250 m; `null` não significa ausência de divisa. [Método e três extras inspecionados](ZONA-AUTO.md): 19→Z3, 25298→Z1, 75355→Z2; todos concordam visualmente. Sem cadastro/áreas especiais ou atualização legal; sem commit.
Validação: `novo_lote.py --testar` passou, incluindo sete pilotos, três extras, casos sintéticos, CLI, zona explícita e hashes dos arquivos protegidos. Tempo CLI completo/19: auto 8,299 s; explícita 6,835 s; processos novos, cache do SO não limpo. Auto não integrado à CLI `motor/estudar.py` (fora do escopo); download não exercitado, mapa local conferido por SHA256.
