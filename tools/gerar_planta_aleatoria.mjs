import {
  iniciar, aplicar, exportar, exportarMoveis, problemas
} from '../painel/src/components/construtor-planta/modelo.ts';
import { obterDefinicaoMovel } from '../painel/src/components/construtor-planta/catalogoMoveis.ts';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function validarNormativo(leituraJson) {
  const res = spawnSync('python', ['-c', 'import json, sys, pipeline.validar_leitura as v; d=json.load(sys.stdin); errs=v.validar(d); sys.exit(0 if not errs else 1)'], {
    input: leituraJson,
    encoding: 'utf8',
    cwd: rootDir
  });
  return res.status === 0;
}

export function gerarPlantaAleatoria(idUnico = 'casa-moderna-' + Math.floor(Math.random() * 9000 + 1000)) {
  let s = iniciar(idUnico);

  // 1. Sala Estar & Jantar integrada (4.0m x 5.0m)
  s = aplicar(s, {
    type: 'add',
    name: 'Sala de Estar e Jantar',
    widthMm: 4000,
    depthMm: 5000,
    ceilingHeightMm: 2700,
    xMm: 0,
    yMm: 0
  });

  // 2. Cozinha Americana (3.0m x 3.2m) ao lado da Sala
  s = aplicar(s, {
    type: 'add',
    name: 'Cozinha',
    widthMm: 3000,
    depthMm: 3200,
    ceilingHeightMm: 2700,
    xMm: 4000,
    yMm: 0
  });

  // 3. Área de Serviço (3.0m x 1.8m) ao norte da Cozinha
  s = aplicar(s, {
    type: 'add',
    name: 'Área de Serviço',
    widthMm: 3000,
    depthMm: 1800,
    ceilingHeightMm: 2700,
    xMm: 4000,
    yMm: 3200
  });

  // 4. Hall / Circulação Íntima (2.6m x 1.6m) ao norte da Sala
  s = aplicar(s, {
    type: 'add',
    name: 'Circulação',
    widthMm: 2600,
    depthMm: 1600,
    ceilingHeightMm: 2700,
    xMm: 1400,
    yMm: 5000
  });

  // 5. Banheiro Social (1.4m x 2.6m) ao lado da circulação
  s = aplicar(s, {
    type: 'add',
    name: 'Banheiro Social',
    widthMm: 1400,
    depthMm: 2600,
    ceilingHeightMm: 2700,
    xMm: 0,
    yMm: 5000
  });

  // 6. Quarto / Home Office (3.0m x 3.2m)
  s = aplicar(s, {
    type: 'add',
    name: 'Dormitório',
    widthMm: 3000,
    depthMm: 3200,
    ceilingHeightMm: 2700,
    xMm: 4000,
    yMm: 5000
  });

  // 7. Suíte Principal (4.0m x 3.6m)
  s = aplicar(s, {
    type: 'add',
    name: 'Suíte Master',
    widthMm: 4000,
    depthMm: 3600,
    ceilingHeightMm: 2700,
    xMm: 0,
    yMm: 7600
  });

  // 8. Banheiro da Suíte (1.8m x 2.2m)
  s = aplicar(s, {
    type: 'add',
    name: 'Banheiro Suíte',
    widthMm: 1800,
    depthMm: 2200,
    ceilingHeightMm: 2700,
    xMm: 4000,
    yMm: 8200
  });

  // ---- ADICIONAR ABERTURAS (PORTAS E JANELAS) ----
  // Porta de entrada (Sala Sul)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c1-south',
    offsetMm: 500,
    widthMm: 900,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela da Sala (Sala Oeste)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c1-west',
    offsetMm: 1200,
    widthMm: 2000,
    heightMm: 1200,
    sillMm: 1000
  });

  // Passagem Sala <-> Cozinha (compartilhada c1-east <-> c2-west)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c1-east',
    offsetMm: 800,
    widthMm: 900,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela Cozinha (Leste)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c2-east',
    offsetMm: 1000,
    widthMm: 1200,
    heightMm: 1000,
    sillMm: 1100
  });

  // Porta Cozinha <-> Área de Serviço (c2-north <-> c3-south)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c2-north',
    offsetMm: 500,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela da Área de Serviço (Leste)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c3-east',
    offsetMm: 400,
    widthMm: 1000,
    heightMm: 1000,
    sillMm: 1100
  });

  // Porta Sala <-> Circulação (c1-north <-> c4-south)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c1-north',
    offsetMm: 1800,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0
  });

  // Porta Circulação <-> Banheiro Social (c4-west <-> c5-east)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c4-west',
    offsetMm: 400,
    widthMm: 700,
    heightMm: 2100,
    sillMm: 0
  });

  // Porta Circulação <-> Dormitório (c4-east <-> c6-west)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c4-east',
    offsetMm: 400,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela Dormitório (Leste)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c6-east',
    offsetMm: 800,
    widthMm: 1400,
    heightMm: 1200,
    sillMm: 1000
  });

  // Porta Circulação <-> Suíte Master (c4-north <-> c7-south)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c4-north',
    offsetMm: 600,
    widthMm: 800,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela Suíte Master (Oeste)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c7-west',
    offsetMm: 1000,
    widthMm: 1600,
    heightMm: 1200,
    sillMm: 1000
  });

  // Porta Suíte <-> Banheiro Suíte (c7-east <-> c8-west)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'door',
    wallId: 'c7-east',
    offsetMm: 1200,
    widthMm: 700,
    heightMm: 2100,
    sillMm: 0
  });

  // Janela Banheiro Suíte (Norte)
  s = aplicar(s, {
    type: 'opening-add',
    kind: 'window',
    wallId: 'c8-north',
    offsetMm: 500,
    widthMm: 600,
    heightMm: 600,
    sillMm: 1600
  });

  // ---- ADICIONAR MÓVEIS HUMANIZADOS (FRENTE 1) ----
  function addMovel(tipo, xMm, yMm, rotDegrees = 0) {
    const def = obterDefinicaoMovel(tipo);
    s = aplicar(s, {
      type: 'furniture-add',
      item: {
        tipoCatalogo: def.id,
        tipo3D: def.tipo3D,
        nome: def.nome,
        xMm,
        yMm,
        widthMm: def.widthMm,
        depthMm: def.depthMm,
        rotDegrees,
        cor: def.corPadrao
      }
    });
  }

  // Móveis da Sala de Estar e Jantar
  addMovel('sofa-3', 1000, 2000, 90);
  addMovel('mesa-centro', 1800, 2000, 0);
  addMovel('rack-tv', 3500, 2000, 270);
  addMovel('mesa-jantar-6', 2000, 4200, 0);

  // Móveis da Cozinha
  addMovel('geladeira', 4300, 500, 0);
  addMovel('fogao-4', 5200, 400, 0);
  addMovel('pia-cozinha', 6200, 500, 0);

  // Área de Serviço
  addMovel('maquina-lavar', 4400, 3600, 0);
  addMovel('tanque-lavar', 5300, 3600, 0);

  // Dormitório
  addMovel('cama-solteiro', 4600, 6800, 0);
  addMovel('escrivaninha', 6200, 6000, 270);
  addMovel('guardaroupa', 5800, 7800, 180);

  // Suíte Master
  addMovel('cama-casal', 2000, 9800, 180);
  addMovel('criado', 1000, 9800, 180);
  addMovel('criado', 3000, 9800, 180);
  addMovel('guardaroupa', 2000, 8000, 0);

  // Banheiro da Suíte
  addMovel('box-chuveiro', 5300, 9900, 0);
  addMovel('vaso-sanitario', 4500, 9800, 270);
  addMovel('bancada-banheiro', 4500, 8800, 90);

  // Banheiro Social
  addMovel('box-chuveiro', 700, 7100, 0);
  addMovel('vaso-sanitario', 700, 6100, 0);
  addMovel('bancada-banheiro', 700, 5300, 0);

  const probs = problemas(s.present);
  if (probs.length > 0) {
    throw new Error('Problemas na planta gerada: ' + JSON.stringify(probs));
  }

  const leituraJson = exportar(s);
  const moveisJson = exportarMoveis(s);

  if (!validarNormativo(leituraJson)) {
    throw new Error('Falha no gate de validação normativo python validar_leitura');
  }

  return { session: s, leituraJson, moveisJson };
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith('gerar_planta_aleatoria.mjs')) {
  const saidaPasta = process.argv[2] || path.join(rootDir, 'publicacao', 'm1-1a', 'planta-aleatoria');
  fs.mkdirSync(saidaPasta, { recursive: true });

  const { session, leituraJson, moveisJson } = gerarPlantaAleatoria();

  fs.writeFileSync(path.join(saidaPasta, 'leitura.json'), leituraJson, 'utf8');
  fs.writeFileSync(path.join(saidaPasta, 'moveis.json'), moveisJson, 'utf8');

  console.log(`Planta aleatória gerada com sucesso!`);
  console.log(`- Cômodos: ${session.present.rooms.length}`);
  console.log(`- Aberturas: ${session.present.openings.length}`);
  console.log(`- Móveis humanizados 2D/3D: ${session.present.furniture.length}`);
  console.log(`- Salvo em: ${saidaPasta}`);
}
