#!/bin/bash
# Regrava a luz por hora de plantas cuja unidade.json mudou: fonte nova -> UV1 -> gravar -> pacote.
# bash experimentos/vistas-da-quinze-2026-11-07/interiores/luz/regravar.sh t03 t04 ...   (navegador fechado, ~36 min cada)
set -e
cd "$(dirname "$0")/../../../.."
I=experimentos/vistas-da-quinze-2026-11-07/interiores
for t in "$@"; do rm -rf $I/luz/$t/source.json $I/luz/$t/bake; done
python $I/gerar_pacote.py                      # sem fonte, a planta volta a native-factories com a unidade.json nova
python $I/luz/exportar_fonte.py "$@"
for t in "$@"; do
  C:/Python314/python.exe v1.5/miniaturas/liv-ipanema/interior/preparar_luz.py --source $I/luz/$t/source.json --out $I/luz/$t/bake --size 1024
done
bash $I/luz/gravar_todos.sh "$@"
python $I/gerar_pacote.py
