#!/bin/bash
# Grava a luz por hora das 6 plantas do Vistas da Quinze em sequência e empacota cada um (~36 min por tipo, navegador fechado).
# bash experimentos/vistas-da-quinze-2026-11-07/interiores/luz/gravar_todos.sh [tipos...]
set -e
cd "$(dirname "$0")/../../../.."
L=experimentos/vistas-da-quinze-2026-11-07/interiores/luz
BLENDER="/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe"
for t in ${@:-t01 t02 t03 t04 t05 t06}; do
  echo "== $t $(date +%H:%M)"
  "$BLENDER" -b --factory-startup experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend --python-exit-code 1 \
    --python $L/bake_horario.py -- --tipologia $t > $L/logs/bake-$t.log 2>&1
  grep -c LARANJEIRAS_LUZ_CHAVE $L/logs/bake-$t.log
  C:/Python314/python.exe $L/empacotar_horario.py $t > $L/logs/empacotar-$t.log 2>&1
  tail -c 300 $L/logs/empacotar-$t.log; echo
done
echo "== fim $(date +%H:%M)"
