| Piloto (base completo) | Manual | Automática; NV = não verificada (anexo) |
|---|---|---|
| 30516 | AIA | AIA + NV05 |
| 37607 | Industrial/serviços | Industrial/serviços + NV05/06/07 |
| 22426 | Gabarito aeronáutico | Gabarito aeronáutico possível + NV05/06/07 |
| 22421 | Gabarito aeronáutico | Gabarito aeronáutico possível + NV06/07 |
| q1382, 11984–11988 | Gabarito aeronáutico | Gabarito aeronáutico possível + NV05/06/07 |
| 25297 | Nenhuma anotada | NV07 |
| remembramento 75352–75354 | Nenhuma anotada | NV07 |
Todos os alertas manuais preservados; extras são NV por cores encobertas/sem correspondência ou resolução insuficiente no lote/margem. Mesmo afim SAD69 e centros de pixels da tarefa 5; SHA256, RGB ≤18, recuperação ≤3 pixels; mancha a até 10 m + 4 pixels gera possível incidência, confirmar. Contornos convexos recuperam os dois cones tracejados; fontes ausentes/divergentes e fora do quadro geram NV. Resolução 05/06/07 ≈3,1/1,4/5,6 m; resíduos não medem erro cadastral total; sem altura numérica, atualização legal ou confirmação DECEA; traços podem gerar falsos positivos.
`python -I -B -X utf8 viabilidade/terreno/novo_lote.py --testar` passou: regressões anteriores, sete pilotos, cores/oclusão, margem de 7 m, mapas indisponíveis, dois cones e CLI `motor/estudar.py` no lote novo 22420 com “ÁREA ESPECIAL”/gabarito no estudo e HTML. Ensaios especiais: 10,553 s; CLI estudar: 10,362 s; CLI lote explícito: 9,716 s; auto: 10,645 s (cache do SO não limpo). Hashes de dados/pilotos/fontes preservados; sem commit.
Conferência visual dos dois contornos em `%TEMP%/terreno-tarefa6/cones-conferidos.png`; legendas e recorte bruto na mesma pasta, nenhuma imagem nova no repositório. Pendência externa: `motor/test_estudar.py` ainda remove alertas especiais apenas do piloto e pressupõe sua ausência no lote novo; não alterado nem executado, pois Motor está fora do escopo.
