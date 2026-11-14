import {
  iniciar, aplicar, exportar, problemas
} from '../painel/src/components/construtor-planta/modelo.ts';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function validarNormativo(leituraJson) {
  const res = spawnSync('python', ['-c', 'import json, sys, pipeline.validar_leitura as v; d=json.load(sys.stdin); errs=v.validar(d); sys.exit(0 if not errs else 1)'], {
    input: leituraJson,
    encoding: 'utf8',
    cwd: rootDir
  });
  return res.status === 0;
}

// Fixtures sintéticas com paletas distintas; não são homologação nem prova normativa.
export const CASAS = [
  {
    id: 'casa-01-studio-minimalista-31m',
    titulo: 'Studio Urbano Minimalista · 30,8 m²',
    estiloLuz: 'Meio-Dia / Sol Alto 60° (Branco Natural Puro)',
    estiloTextura: 'Minimalista Clean (Branco Neve + Porcelanato Cinza Acetinado)',
    luzConfig: { solCor: '0xFFFFFF', solInt: 2.8, hemiCeu: '0xF0F4FA', hemiChao: '0x22262C', solPos: [15, 48, 12] },
    cores: { parede: '#F7F7F6', piso_frio: '#C2C0BC', piso_madeira: '#B89E7E', teto: '#FAFAFA' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Living Integrado', widthMm: 4500, depthMm: 4200, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha', widthMm: 2500, depthMm: 2200, ceilingHeightMm: 2700, xMm: 4500, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Banheiro', widthMm: 2500, depthMm: 2000, ceilingHeightMm: 2700, xMm: 4500, yMm: 2200 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1200, widthMm: 2000, heightMm: 1400, sillMm: 900 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 600, widthMm: 1200, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 2600, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 600, widthMm: 1200, heightMm: 1000, sillMm: 1100 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 600, widthMm: 800, heightMm: 600, sillMm: 1600 });
      return s;
    }
  },
  {
    id: 'casa-02-1q-executivo-42m',
    titulo: '1 Dormitório Executivo · 42,5 m²',
    estiloLuz: 'Golden Hour / Pôr do Sol 25° (Dourado Quente Aconchegante)',
    estiloTextura: 'Industrial Contemporâneo (Cimento Queimado + Vinílico Castanho)',
    luzConfig: { solCor: '0xFFD699', solInt: 3.2, hemiCeu: '0xFFE8CC', hemiChao: '0x3D2B1F', solPos: [38, 20, 18] },
    cores: { parede: '#C5BFB8', piso_frio: '#ABA59E', piso_madeira: '#8C6843', teto: '#F0ECE6' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Sala de Estar e Jantar', widthMm: 4000, depthMm: 4000, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha e Serviço', widthMm: 2600, depthMm: 4000, ceilingHeightMm: 2700, xMm: 4000, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 1600, depthMm: 1500, ceilingHeightMm: 2700, xMm: 0, yMm: 4000 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 2400, depthMm: 1500, ceilingHeightMm: 2700, xMm: 1600, yMm: 4000 });
      s = aplicar(s, { type: 'add', name: 'Dormitório Casal', widthMm: 4000, depthMm: 2800, ceilingHeightMm: 2700, xMm: 0, yMm: 5500 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 500, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 800, widthMm: 1400, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 1000, widthMm: 1500, heightMm: 1100, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c3-east', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c4-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c3-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-west', offsetMm: 1000, widthMm: 1600, heightMm: 1200, sillMm: 1000 });
      return s;
    }
  },
  {
    id: 'casa-03-2q-padrao-58m',
    titulo: '2 Dormitórios Standard · 58,0 m²',
    estiloLuz: 'Manhã Suave / Luz Matinal 35° (5000K Arejado)',
    estiloTextura: 'Escandinavo Aconchegante (Linho Claro + Carvalho Nórdico)',
    luzConfig: { solCor: '0xFFFAF2', solInt: 2.7, hemiCeu: '0xE8F0FA', hemiChao: '0x2A323A', solPos: [28, 35, 24] },
    cores: { parede: '#EFECE6', piso_frio: '#D1CCC4', piso_madeira: '#A88E6E', teto: '#FBF9F5' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Sala Estar e Jantar', widthMm: 3800, depthMm: 4400, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha', widthMm: 2800, depthMm: 2800, ceilingHeightMm: 2700, xMm: 3800, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Área de Serviço', widthMm: 2800, depthMm: 1600, ceilingHeightMm: 2700, xMm: 3800, yMm: 2800 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 2400, depthMm: 2400, ceilingHeightMm: 2700, xMm: 1400, yMm: 4400 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 1400, depthMm: 2400, ceilingHeightMm: 2700, xMm: 0, yMm: 4400 });
      s = aplicar(s, { type: 'add', name: 'Dormitório 1 Casal', widthMm: 3800, depthMm: 3000, ceilingHeightMm: 2700, xMm: 0, yMm: 6800 });
      s = aplicar(s, { type: 'add', name: 'Dormitório 2 Solteiro', widthMm: 2800, depthMm: 3600, ceilingHeightMm: 2700, xMm: 3800, yMm: 4400 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1000, widthMm: 2000, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 600, widthMm: 1200, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 800, widthMm: 1400, heightMm: 1000, sillMm: 1100 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c2-north', offsetMm: 1000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 400, widthMm: 1000, heightMm: 800, sillMm: 1300 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 1600, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-west', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-west', offsetMm: 800, widthMm: 1600, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-east', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-east', offsetMm: 800, widthMm: 1400, heightMm: 1200, sillMm: 1000 });
      return s;
    }
  },
  {
    id: 'casa-04-2q-suite-moderno-68m',
    titulo: '2 Dormitórios com 1 Suíte · 68,4 m²',
    estiloLuz: 'Céu Encoberto / Soft Studio (Luz Difusa 4800K)',
    estiloTextura: 'Clássico Moderno (Off-White Acetinado + Crema Marfil)',
    luzConfig: { solCor: '0xEDE6DB', solInt: 2.2, hemiCeu: '0xF4F0EA', hemiChao: '0x403C36', solPos: [20, 50, 20] },
    cores: { parede: '#ECE7E0', piso_frio: '#D3CBC1', piso_madeira: '#967448', teto: '#F7F5F0' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Sala Estar e Jantar', widthMm: 4200, depthMm: 4600, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha', widthMm: 3000, depthMm: 3200, ceilingHeightMm: 2700, xMm: 4200, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Área de Serviço', widthMm: 3000, depthMm: 1400, ceilingHeightMm: 2700, xMm: 4200, yMm: 3200 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 2400, depthMm: 2400, ceilingHeightMm: 2700, xMm: 1800, yMm: 4600 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 1800, depthMm: 2400, ceilingHeightMm: 2700, xMm: 0, yMm: 4600 });
      s = aplicar(s, { type: 'add', name: 'Dormitório 2', widthMm: 3000, depthMm: 3400, ceilingHeightMm: 2700, xMm: 4200, yMm: 4600 });
      s = aplicar(s, { type: 'add', name: 'Suíte Master', widthMm: 4200, depthMm: 3600, ceilingHeightMm: 2700, xMm: 0, yMm: 7000 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte', widthMm: 1800, depthMm: 2400, ceilingHeightMm: 2700, xMm: 4200, yMm: 8000 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1200, widthMm: 2200, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 800, widthMm: 1400, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 800, widthMm: 1500, heightMm: 1100, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c2-north', offsetMm: 1000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 200, widthMm: 800, heightMm: 800, sillMm: 1300 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 2000, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-west', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-east', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-east', offsetMm: 800, widthMm: 1400, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-west', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c7-east', offsetMm: 1200, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c8-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      return s;
    }
  },
  {
    id: 'casa-05-suite-home-office-74m',
    titulo: 'Suíte Master + Home Office · 74,2 m²',
    estiloLuz: 'Entardecer / Twilight Cênico (Contraste Cobalto e Âmbar)',
    estiloTextura: 'Nobre Contemporâneo (Areia Fosca + Nogueira Escura)',
    luzConfig: { solCor: '0xFFA866', solInt: 2.9, hemiCeu: '0x223B59', hemiChao: '0x261A10', solPos: [42, 14, 15] },
    cores: { parede: '#DDD6CC', piso_frio: '#C3BBB0', piso_madeira: '#7A5B3E', teto: '#EDE7DE' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Living Integrado', widthMm: 4600, depthMm: 4800, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha e Copa', widthMm: 3200, depthMm: 3400, ceilingHeightMm: 2700, xMm: 4600, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Área de Serviço', widthMm: 3200, depthMm: 1400, ceilingHeightMm: 2700, xMm: 4600, yMm: 3400 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 2600, depthMm: 2600, ceilingHeightMm: 2700, xMm: 2000, yMm: 4800 });
      s = aplicar(s, { type: 'add', name: 'Home Office', widthMm: 2000, depthMm: 2600, ceilingHeightMm: 2700, xMm: 0, yMm: 4800 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 2200, depthMm: 1600, ceilingHeightMm: 2700, xMm: 4600, yMm: 4800 });
      s = aplicar(s, { type: 'add', name: 'Suíte Master', widthMm: 4600, depthMm: 3800, ceilingHeightMm: 2700, xMm: 0, yMm: 7400 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte', widthMm: 2200, depthMm: 2000, ceilingHeightMm: 2700, xMm: 4600, yMm: 8000 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 500, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1400, widthMm: 2400, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 1000, widthMm: 1400, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 1000, widthMm: 1600, heightMm: 1100, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c2-north', offsetMm: 1000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 200, widthMm: 800, heightMm: 800, sillMm: 1300 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 2200, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-west', offsetMm: 600, widthMm: 1200, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-east', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-north', offsetMm: 500, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-west', offsetMm: 1200, widthMm: 2000, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c7-east', offsetMm: 800, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c8-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      return s;
    }
  },
  {
    id: 'casa-06-loft-aberto-52m',
    titulo: 'Loft Urbano Conceito Aberto · 52,0 m²',
    estiloLuz: 'Iluminação Noturna Cênica (Spots Warm LED 3000K)',
    estiloTextura: 'Industrial Chic (Concreto Aparente + Antracite + Freijó)',
    luzConfig: { solCor: '0x1A222C', solInt: 0.2, hemiCeu: '0x151D28', hemiChao: '0x0E141C', solPos: [0, 10, 0] },
    cores: { parede: '#B8B4AE', piso_frio: '#827E78', piso_madeira: '#8A6A45', teto: '#2C2B29' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Grande Salão Loft', widthMm: 6000, depthMm: 6500, ceilingHeightMm: 3000, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha Gourmet', widthMm: 2800, depthMm: 3200, ceilingHeightMm: 3000, xMm: 6000, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Spa', widthMm: 2800, depthMm: 3300, ceilingHeightMm: 3000, xMm: 6000, yMm: 3200 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 600, widthMm: 1000, heightMm: 2400, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1500, widthMm: 3500, heightMm: 1800, sillMm: 600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 1000, widthMm: 1800, heightMm: 2600, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 800, widthMm: 1600, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 4500, widthMm: 900, heightMm: 2400, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 800, widthMm: 1000, heightMm: 800, sillMm: 1400 });
      return s;
    }
  },
  {
    id: 'casa-07-3q-familiar-86m',
    titulo: '3 Dormitórios Familiar · 86,0 m²',
    estiloLuz: 'Dia Tropical Intenso (55° Sol Forte e Brilhante)',
    estiloTextura: 'Família Warm (Marfim Nobre + Carvalho Rústico)',
    luzConfig: { solCor: '0xFFFDF0', solInt: 3.0, hemiCeu: '0xEDF4FC', hemiChao: '0x2D2E30', solPos: [25, 45, 20] },
    cores: { parede: '#F2EFE8', piso_frio: '#CFC8BC', piso_madeira: '#9E7B54', teto: '#FCFAF6' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Sala Estar e Jantar', widthMm: 4500, depthMm: 5200, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha', widthMm: 3200, depthMm: 3400, ceilingHeightMm: 2700, xMm: 4500, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Área de Serviço', widthMm: 3200, depthMm: 1800, ceilingHeightMm: 2700, xMm: 4500, yMm: 3400 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 2800, depthMm: 2600, ceilingHeightMm: 2700, xMm: 1700, yMm: 5200 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 1700, depthMm: 2600, ceilingHeightMm: 2700, xMm: 0, yMm: 5200 });
      s = aplicar(s, { type: 'add', name: 'Dormitório 2', widthMm: 3200, depthMm: 3200, ceilingHeightMm: 2700, xMm: 4500, yMm: 5200 });
      s = aplicar(s, { type: 'add', name: 'Suíte Master', widthMm: 4200, depthMm: 3600, ceilingHeightMm: 2700, xMm: 0, yMm: 7800 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte', widthMm: 1800, depthMm: 2200, ceilingHeightMm: 2700, xMm: 4200, yMm: 8400 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 500, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1400, widthMm: 2400, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 800, widthMm: 1400, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 1000, widthMm: 1600, heightMm: 1100, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c2-north', offsetMm: 1000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 200, widthMm: 800, heightMm: 800, sillMm: 1300 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 2200, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-west', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-east', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-east', offsetMm: 800, widthMm: 1400, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-west', offsetMm: 1200, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c7-east', offsetMm: 800, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c8-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      return s;
    }
  },
  {
    id: 'casa-08-casa-em-l-78m',
    titulo: 'Casa em "L" com Pátio · 78,5 m²',
    estiloLuz: 'Luz da Tarde Lateral 40° (Rasante Aconchegante)',
    estiloTextura: 'Casa de Campo Rústica (Terracota + Cerâmica Queimada)',
    luzConfig: { solCor: '0xFFE4C4', solInt: 2.8, hemiCeu: '0xF2EAE1', hemiChao: '0x3D2C1E', solPos: [35, 30, 25] },
    cores: { parede: '#D9C5B5', piso_frio: '#B39A82', piso_madeira: '#A06B3E', teto: '#EFE6DE' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Sala de Estar', widthMm: 4400, depthMm: 4200, ceilingHeightMm: 2800, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha e Copa', widthMm: 3600, depthMm: 4200, ceilingHeightMm: 2800, xMm: 4400, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Circulação Pátio', widthMm: 1600, depthMm: 4200, ceilingHeightMm: 2700, xMm: 0, yMm: 4200 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 2400, depthMm: 1800, ceilingHeightMm: 2700, xMm: 1600, yMm: 4200 });
      s = aplicar(s, { type: 'add', name: 'Dormitório Pátio', widthMm: 3400, depthMm: 2400, ceilingHeightMm: 2700, xMm: 1600, yMm: 6000 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1000, widthMm: 2200, heightMm: 1400, sillMm: 800 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 1000, widthMm: 1600, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 400, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c3-east', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c4-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c3-east', offsetMm: 2400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-east', offsetMm: 800, widthMm: 1600, heightMm: 1200, sillMm: 1000 });
      return s;
    }
  },
  {
    id: 'casa-09-2suites-lavabo-82m',
    titulo: '2 Suítes Independentes + Lavabo · 82,0 m²',
    estiloLuz: 'Fim de Tarde Dourado (Warm Sunset 3200K)',
    estiloTextura: 'Alto Padrão Greige (Greige Suave + Travertino Navona)',
    luzConfig: { solCor: '0xFFC899', solInt: 2.9, hemiCeu: '0xF5ECE1', hemiChao: '0x332218', solPos: [32, 22, 16] },
    cores: { parede: '#D6D0C5', piso_frio: '#C7BEB0', piso_madeira: '#8A6843', teto: '#F7F4EE' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Living Integrado', widthMm: 4800, depthMm: 4600, ceilingHeightMm: 2700, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha Americana', widthMm: 3200, depthMm: 3200, ceilingHeightMm: 2700, xMm: 4800, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Lavabo Social', widthMm: 1600, depthMm: 1400, ceilingHeightMm: 2700, xMm: 4800, yMm: 3200 });
      s = aplicar(s, { type: 'add', name: 'Área de Serviço', widthMm: 1600, depthMm: 1400, ceilingHeightMm: 2700, xMm: 6400, yMm: 3200 });
      s = aplicar(s, { type: 'add', name: 'Circulação', widthMm: 3200, depthMm: 1600, ceilingHeightMm: 2700, xMm: 1800, yMm: 4600 });
      s = aplicar(s, { type: 'add', name: 'Suíte 1', widthMm: 3800, depthMm: 3600, ceilingHeightMm: 2700, xMm: 0, yMm: 6200 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte 1', widthMm: 1800, depthMm: 1600, ceilingHeightMm: 2700, xMm: 0, yMm: 4600 });
      s = aplicar(s, { type: 'add', name: 'Suíte 2', widthMm: 3800, depthMm: 3600, ceilingHeightMm: 2700, xMm: 3800, yMm: 6200 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte 2', widthMm: 2000, depthMm: 1600, ceilingHeightMm: 2700, xMm: 5000, yMm: 4600 });

      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 500, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1400, widthMm: 2600, heightMm: 1400, sillMm: 800 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 800, widthMm: 1600, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 800, widthMm: 1600, heightMm: 1100, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 3600, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c4-east', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 2200, widthMm: 1000, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c5-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c5-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c5-north', offsetMm: 2200, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c5-east', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-west', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-west', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c8-east', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      return s;
    }
  },
  {
    id: 'casa-10-terrea-premium-102m',
    titulo: 'Casa Térrea Contemporânea · 102,5 m²',
    estiloLuz: 'Iluminação Arquitetônica Híbrida (Sol 45° + Rebound Suave)',
    estiloTextura: 'Contemporânea Luxo (Branco Gesso + Porcelanato Polido + Freijó)',
    luzConfig: { solCor: '0xFFFDF8', solInt: 2.7, hemiCeu: '0xF4F7FC', hemiChao: '0x32353A', solPos: [26, 42, 18] },
    cores: { parede: '#F8F7F4', piso_frio: '#DDD7CF', piso_madeira: '#A07647', teto: '#FFFFFF' },
    construir: (s) => {
      s = aplicar(s, { type: 'add', name: 'Living Pé-Direito Alto', widthMm: 5400, depthMm: 5000, ceilingHeightMm: 3000, xMm: 0, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Cozinha com Ilha', widthMm: 3800, depthMm: 3600, ceilingHeightMm: 3000, xMm: 5400, yMm: 0 });
      s = aplicar(s, { type: 'add', name: 'Despensa e Serviço', widthMm: 3800, depthMm: 1400, ceilingHeightMm: 2700, xMm: 5400, yMm: 3600 });
      s = aplicar(s, { type: 'add', name: 'Circulação Central', widthMm: 1800, depthMm: 3400, ceilingHeightMm: 2700, xMm: 3600, yMm: 5000 });
      s = aplicar(s, { type: 'add', name: 'Lavabo Social', widthMm: 1800, depthMm: 1600, ceilingHeightMm: 2700, xMm: 1800, yMm: 5000 });
      s = aplicar(s, { type: 'add', name: 'Dormitório 2', widthMm: 3600, depthMm: 3600, ceilingHeightMm: 2700, xMm: 0, yMm: 6600 });
      s = aplicar(s, { type: 'add', name: 'Suíte Master', widthMm: 3800, depthMm: 4000, ceilingHeightMm: 2700, xMm: 5400, yMm: 5000 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Suíte Master', widthMm: 2200, depthMm: 2400, ceilingHeightMm: 2700, xMm: 5400, yMm: 9000 });
      s = aplicar(s, { type: 'add', name: 'Banheiro Social', widthMm: 1800, depthMm: 1800, ceilingHeightMm: 2700, xMm: 3600, yMm: 8400 });

      // Entradas e Aberturas
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-south', offsetMm: 600, widthMm: 1100, heightMm: 2400, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c1-west', offsetMm: 1200, widthMm: 3000, heightMm: 1800, sillMm: 600 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-east', offsetMm: 1000, widthMm: 1800, heightMm: 2400, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c2-east', offsetMm: 1000, widthMm: 2000, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c2-north', offsetMm: 1200, widthMm: 900, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c3-east', offsetMm: 200, widthMm: 800, heightMm: 800, sillMm: 1300 });

      // Porta Living -> Circulação Central
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c1-north', offsetMm: 4000, widthMm: 1000, heightMm: 2100, sillMm: 0 });

      // Portas Circulação Central (c4)
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 300, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-west', offsetMm: 2000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-east', offsetMm: 1000, widthMm: 800, heightMm: 2100, sillMm: 0 });
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c4-north', offsetMm: 400, widthMm: 800, heightMm: 2100, sillMm: 0 });

      // Suíte Master -> Banheiro Suíte Master
      s = aplicar(s, { type: 'opening-add', kind: 'door', wallId: 'c7-north', offsetMm: 600, widthMm: 800, heightMm: 2100, sillMm: 0 });

      // Janelas externas
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c5-north', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c6-west', offsetMm: 1000, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c7-east', offsetMm: 1200, widthMm: 1800, heightMm: 1200, sillMm: 1000 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c8-east', offsetMm: 600, widthMm: 1000, heightMm: 600, sillMm: 1600 });
      s = aplicar(s, { type: 'opening-add', kind: 'window', wallId: 'c9-north', offsetMm: 400, widthMm: 800, heightMm: 600, sillMm: 1600 });
      return s;
    }
  }
];

export function construirCasa(casa) {
  const session = casa.construir(iniciar(casa.id));
  const erros = problemas(session.present);
  if (erros.length) throw new Error(`Geometria inválida em ${casa.id}: ${JSON.stringify(erros)}`);
  return exportar(session);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function identidadeArtefato(pasta) {
  const html = fs.readFileSync(path.join(pasta, 'maquete.html'));
  const reportBytes = fs.readFileSync(path.join(pasta, 'relatorio.json'));
  const relatorio = JSON.parse(reportBytes);
  const medido = { arquivo: 'maquete.html', bytes: html.length, sha256: sha256(html) };
  const declarado = relatorio.artefato;
  return {
    relatorioOriginalSha256: sha256(reportBytes), declarado, medido,
    confere: declarado?.sha256 === medido.sha256 && declarado?.bytes === medido.bytes,
    geometriaReverificada: false,
  };
}

export function auditarLegado(pastaLote, registrar = false) {
  const casas = fs.readdirSync(pastaLote, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^casa-\d+$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!casas.length) throw new Error('Nenhuma casa encontrada no lote legado.');
  const identidades = casas.map((entry) => ({
    casa: entry.name, ...identidadeArtefato(path.join(pastaLote, entry.name, 'maquete')),
  }));
  const registro = {
    schema: 1, classe: 'auditoria-de-artefatos-legados',
    observacao: 'Hashes dos bytes atuais. O relatório histórico permanece intacto; geometria, desempenho e geração não foram reexecutados.',
    casas: identidades,
  };
  if (registrar) fs.writeFileSync(path.join(pastaLote, 'identidade-artefatos-legados.json'),
    JSON.stringify(registro, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return registro;
}

export function executarBenchmark(saidaBase, quantidade = CASAS.length) {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > CASAS.length)
    throw new Error('Quantidade de casas deve ser de 1 a 10.');
  saidaBase = path.resolve(saidaBase);
  if (fs.existsSync(saidaBase) && fs.readdirSync(saidaBase).length)
    throw new Error('Destino ocupado; escolha uma pasta nova para preservar execuções anteriores.');
  fs.mkdirSync(saidaBase, { recursive: true });
  console.log('Lote sintético local: tempos de geração e tamanho dos arquivos; mobile não medido.');
  const relatorioBenchmark = [];
  const t0Lote = process.hrtime.bigint();

  for (let i = 0; i < quantidade; i++) {
    const c = CASAS[i];
    const t0Item = process.hrtime.bigint();
    console.log(`[${i + 1}/${quantidade}] Construindo ${c.titulo}...`);
    const pastaCasa = path.join(saidaBase, `casa-${String(i + 1).padStart(2, '0')}`);
    fs.mkdirSync(pastaCasa);
    const t0Geo = process.hrtime.bigint();
    const leituraJson = construirCasa(c);
    const tGeo = process.hrtime.bigint() - t0Geo;
    const leituraPath = path.join(pastaCasa, 'leitura.json');
    fs.writeFileSync(leituraPath, leituraJson, 'utf8');
    const t0Val = process.hrtime.bigint();
    if (!validarNormativo(leituraJson)) throw new Error(`Validação normativa falhou para ${c.id}`);
    const tVal = process.hrtime.bigint() - t0Val;

    // Composição ilustrativa do algoritmo existente; não certifica NBR/NKBA ou acessibilidade.
    const t0Mob = process.hrtime.bigint();
    const mobRes = spawnSync('python', ['-c', `import json, sys
import pipeline.mobiliar as mob, pipeline.normalizar_planta as norm
with open(sys.argv[1], encoding='utf-8') as f:
    derivada = norm.normalizar(json.load(f))
moveis, relato, erros, apertos = mob.mobilia({"planta": derivada["planta"]})
print(json.dumps({"moveis": moveis, "erros": erros, "apertos": apertos}))`, leituraPath], {
      encoding: 'utf8', cwd: rootDir, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    if (mobRes.status !== 0) throw new Error(`Mobília falhou em ${c.id}: ${mobRes.stderr || mobRes.error}`);
    const mobilia = JSON.parse(mobRes.stdout);
    const moveisPara3D = mobilia.moveis;
    const tMob = process.hrtime.bigint() - t0Mob;
    fs.writeFileSync(path.join(pastaCasa, 'moveis.json'), JSON.stringify({ moveis: moveisPara3D }, null, 2));

    const leituraObj = JSON.parse(leituraJson);
    const xs = leituraObj.rooms.flatMap(r => [r.xMm, r.xMm + r.widthMm]);
    const ys = leituraObj.rooms.flatMap(r => [r.yMm, r.yMm + r.depthMm]);
    const dimSegura = Math.ceil(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 1000 + 2.5);
    const contexto = {
      schema: 1, propertyId: c.id, agencyId: 'agBenchmark', andar: 0,
      ficha: { titulo: `Demonstração sintética · ${c.titulo}`, empreendimento: 'Lote sintético de teste', tipo: 'venda' },
      cores: c.cores,
      lote: { predio: { largura_m: dimSegura, profundidade_m: dimSegura, pavimentos: 1 } },
      moveis: moveisPara3D,
    };
    // Paleta e móveis entram antes da assinatura do contexto e da geração.
    const contextoPath = path.join(pastaCasa, 'contexto.json');
    fs.writeFileSync(contextoPath, JSON.stringify(contexto, null, 2));
    const t0Comp = process.hrtime.bigint();
    const compRes = spawnSync('python', ['-m', 'pipeline.gerar_maquete', leituraPath,
      '--contexto', contextoPath, '--destino', path.join(pastaCasa, 'maquete')], {
      cwd: rootDir, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    if (compRes.status !== 0) throw new Error(`Maquete falhou em ${c.id}: ${compRes.stderr || compRes.error}`);
    const tComp = process.hrtime.bigint() - t0Comp;
    const identidade = identidadeArtefato(path.join(pastaCasa, 'maquete'));
    if (!identidade.confere) throw new Error(`Hash/tamanho divergem em ${c.id}; artefato recusado.`);
    const html = fs.readFileSync(path.join(pastaCasa, 'maquete', 'maquete.html'));
    const ms = (ns) => Number((Number(ns) / 1e6).toFixed(1));
    relatorioBenchmark.push({
      indice: i + 1, id: c.id, titulo: c.titulo, origem: 'sintetica',
      comodos: leituraObj.rooms.length, aberturas: leituraObj.openings.length, moveis: moveisPara3D.length,
      paleta: c.cores,
      presetLuz: { solicitado: c.estiloLuz, configuracaoSolicitada: c.luzConfig, aplicado: false, motivo: 'Contrato não expõe luz por imóvel; iluminação padrão preservada.' },
      mobilia: { erros: mobilia.erros, apertos: mobilia.apertos, conformidadeNormativa: 'NÃO MEDIDO' },
      tempoGeoMs: ms(tGeo), tempoValMs: ms(tVal), tempoMobMs: ms(tMob), tempoCompMs: ms(tComp),
      bytesCru: html.length, bytesGzipLocal: zlib.gzipSync(html).length,
      bytesBrotliLocal: zlib.brotliCompressSync(html).length, artefato: identidade.medido,
      tempoTotalMs: ms(process.hrtime.bigint() - t0Item),
      caminho: path.relative(saidaBase, path.join(pastaCasa, 'maquete', 'maquete.html')).split(path.sep).join('/'),
    });
  }
  const tempoTotalLoteMs = Number((Number(process.hrtime.bigint() - t0Lote) / 1e6).toFixed(1));
  const relatorio = {
    schema: 2, classe: 'benchmark-sintetico-local', dataIso: new Date().toISOString(),
    metodo: 'Tempos por relógio monotônico; gzip/Brotli locais. Sem rede, aparelho físico ou certificação normativa.',
    naoMedido: ['transferência HTTP', 'tempo de abertura em 3G/4G', 'FPS mobile', 'VRAM', 'abandono', 'custo de CDN'],
    totalCasas: quantidade, tempoTotalLoteMs, tempoMedioPorCasaMs: tempoTotalLoteMs / quantidade,
    casas: relatorioBenchmark,
  };
  fs.writeFileSync(path.join(saidaBase, 'benchmark_relatorio.json'), JSON.stringify(relatorio, null, 2) + '\n');
  console.log(`Lote concluído em ${tempoTotalLoteMs.toFixed(1)} ms. Relatório em ${saidaBase}.`);
  return relatorio;
}

function main(argv) {
  const uso = 'node tools/benchmark_10_casas.mjs --destino PASTA_NOVA [--casas 1..10] | --auditar-legado PASTA [--registrar-legado]';
  const { values } = parseArgs({ args: argv, options: {
    destino: { type: 'string' }, casas: { type: 'string' },
    'auditar-legado': { type: 'string' }, 'registrar-legado': { type: 'boolean' },
    help: { type: 'boolean' },
  } });
  if (values.help) { console.log(uso); return; }
  if (values['auditar-legado']) {
    if (values.destino || values.casas) throw new Error(uso);
    console.log(JSON.stringify(auditarLegado(path.resolve(values['auditar-legado']), !!values['registrar-legado']), null, 2));
  } else {
    if (!values.destino || values['registrar-legado']) throw new Error(uso);
    executarBenchmark(values.destino, values.casas ? Number(values.casas) : CASAS.length);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
