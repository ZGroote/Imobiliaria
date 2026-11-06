#!/bin/bash
# Grava a luz por hora dos 5 dormitórios em sequência e empacota cada um (~36 min por tipo, navegador fechado).
# bash experimentos/containers-mooca-2026-11-05/interiores/luz/gravar_todos.sh [tipos...]
set -e
cd "$(dirname "$0")/../../../.."
L=experimentos/containers-mooca-2026-11-05/interiores/luz
BLENDER="/c/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe"
for t in ${@:-individual individual-pne casal quadruplo casal-bebe refeitorio convivencia}; do
  echo "== $t $(date +%H:%M)"
  "$BLENDER" -b --factory-startup experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend --python-exit-code 1 \
    --python $L/bake_horario.py -- --tipologia $t > $L/logs/bake-$t.log 2>&1
  grep -c LARANJEIRAS_LUZ_CHAVE $L/logs/bake-$t.log
  C:/Python314/python.exe $L/empacotar_horario.py $t > $L/logs/empacotar-$t.log 2>&1
  tail -c 300 $L/logs/empacotar-$t.log; echo
done
echo "== fim $(date +%H:%M)"
