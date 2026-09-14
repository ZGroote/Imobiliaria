#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { bucket as abrirBucket, nomeDoBucket, lerCredencial } from '../firebase/admin.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

async function initFirebase() {
    // Credencial e nome do bucket vem de firebase/admin.js.
    // Falta de chave para aqui com instrucao, antes de comprimir o modelo.
    const { conta } = lerCredencial();
    return { bucket: abrirBucket(), nome: nomeDoBucket(conta.project_id) };
}

async function compressGLB(inputPath) {
    console.log(`Comprimindo modelo: ${inputPath}...`);
    
    const io = new NodeIO()
        .registerExtensions([KHRDracoMeshCompression])
        .registerDependencies({
            'draco3d.encoder': await draco3d.createEncoderModule(),
            'draco3d.decoder': await draco3d.createDecoderModule(),
        });

    // Ler o arquivo original
    const doc = await io.read(inputPath);

    // Aplicar a compressão Draco (otimização extrema de banda)
    doc.createExtension(KHRDracoMeshCompression)
        .setRequired(true)
        .setEncoderOptions({
            method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
            encodeSpeed: 5,
            decodeSpeed: 5,
            quantizationBits: {
                POSITION: 14,
                NORMAL: 10,
                COLOR: 8,
                TEX_COORD: 12,
                GENERIC: 12
            }
        });

    // Escrever o binário comprimido em memória
    const glbBuffer = await io.writeBinary(doc);
    console.log(`Compressão concluída. Tamanho final: ${(glbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    
    return glbBuffer;
}

async function uploadToStorage(bucket, nomeBucket, buffer, imobiliariaId, imovelId) {
    const destinationPath = `modelos/${imobiliariaId}/${imovelId}.glb`;
    const file = bucket.file(destinationPath);

    console.log(`Fazendo upload para: gs://${nomeBucket}/${destinationPath}...`);
    
    await file.save(buffer, {
        metadata: {
            contentType: 'model/gltf-binary',
            // === PROTEÇÃO DE BANDA (CACHE-CONTROL) ===
            // 31536000 segundos = 1 ano. 
            // Garante que o usuário só baixe o modelo 1 vez.
            cacheControl: 'public, max-age=31536000' 
        }
    });
    
    console.log('Upload finalizado com sucesso!');
    console.log(`O arquivo foi marcado com Cache-Control agressivo para economizar sua fatura (Egress).`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log("Uso: node upload_modelo.js <caminho_do_arquivo.glb> <id_imobiliaria> <id_imovel>");
        process.exit(1);
    }

    const [inputPath, imobiliariaId, imovelId] = args;

    try {
        const { bucket, nome } = await initFirebase();
        
        // 1. Otimizar e comprimir com Draco
        const compressedBuffer = await compressGLB(inputPath);
        
        // 2. Upload pro Storage com headers corretos
        await uploadToStorage(bucket, nome, compressedBuffer, imobiliariaId, imovelId);
        
    } catch (error) {
        console.error("Erro durante o processo:", error);
    }
}

main();
