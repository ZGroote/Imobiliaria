# Vistas da Quinze

Estudo BIM das seis plantas anexadas, na ordem T01 a T06. Os nomes identificam
o que aparece nas imagens e servem de referência interna.

- `Tipologias.ifc` reúne as seis plantas em seis pavimentos de conferência.
- `T01.ifc` a `T06.ifc` contêm as tipologias separadas.
- `Implantacao.ifc` contém o estudo volumétrico do conjunto em L, com
  embasamento, lazer, recuos escalonados e coroamento.
- `Conferencia.html` sobrepõe o traçado às imagens e inclui as referências
  da implantação e as fotos da obra.

No Archicad 30, abra `Tipologias.ifc` como um novo projeto. No seletor de
arquivos, escolha o tipo IFC e selecione um tradutor que converta os elementos
construtivos em elementos do Archicad. Os pavimentos desse catálogo servem
para organizar as tipologias e são independentes da implantação.

As imagens vieram sem cotas. O traçado usa 46 px/m e pé-direito de 2,65 m
como hipóteses. Os vãos, as zonas, as alturas da implantação e os recuos
precisam de revisão com plantas técnicas. A distribuição de tipologias por
andar e o norte georreferenciado ficam a confirmar. As peças de spa são
volumes indicativos.

Para gerar os arquivos, use Python com IfcOpenShell 0.8.5. O script reabre
cada IFC, valida o esquema, confere os IDs e processa a geometria.

```powershell
python experimentos/vistas-da-quinze/gerar.py caminho/da/saida --imagens caminho/dos/anexos
```
