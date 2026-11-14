import { collection, doc, getDocFromServer, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { getBlob, ref, uploadBytesResumable, type FirebaseStorage, type UploadTask } from 'firebase/storage'

export const EXTENSOES_MATERIAIS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.zip,.dwg,.dxf,.ifc,.rvt,.skp,.glb,.obj,.mp4,.mov,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
export interface Material {
  id: string; agencyId: string; requestId: string; filename: string; storagePath: string
  type: 'photo' | 'video' | 'floorplan' | 'document' | 'reference' | 'other'; uploadedBy: string
}
export function validarMaterial(file: Pick<File, 'name' | 'size'>) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!EXTENSOES_MATERIAIS.split(',').includes(ext)) throw Error('Formato não permitido. Envie plantas, imagens, vídeos, documentos ou um arquivo ZIP.')
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw Error('O arquivo deve ter conteúdo.')
  const base = file.name.slice(0, -ext.length).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 _.-]/g, '_').slice(0, 120).trim() || 'arquivo'
  return base + ext
}
export const nomeMaterial = (filename: string) => filename.replace(/^[A-Za-z0-9]{20}_/, '')
const categoria = (name: string): Material['type'] => /\.(jpg|jpeg|png|webp|heic)$/i.test(name) ? 'photo'
  : /\.(mp4|mov)$/i.test(name) ? 'video' : /\.(pdf|dwg|dxf|ifc|rvt|skp)$/i.test(name) ? 'floorplan' : 'document'

// O mesmo envio conserva o binário e o id entre tentativas, inclusive se só o registro falhar.
export function prepararMaterial(db: Firestore, storage: FirebaseStorage, pedido: { id: string; agencyId: string }, uid: string, file: File) {
  const nome = validarMaterial(file), registro = doc(collection(db, 'requestAssets'))
  const filename = `${registro.id}_${nome}`, storagePath = `request-assets/${pedido.agencyId}/${pedido.id}/${filename}`
  const dados = { agencyId: pedido.agencyId, requestId: pedido.id, filename, storagePath, type: categoria(nome), uploadedBy: uid }
  let enviado = false, tarefa: UploadTask | null = null
  return {
    id: registro.id, nome,
    cancelar: () => tarefa?.cancel(),
    async enviar(progresso: (porcentagem: number) => void) {
      if (!enviado) {
        tarefa = uploadBytesResumable(ref(storage, storagePath), file, {
          contentType: 'application/octet-stream', contentDisposition: `attachment; filename="${nome.replaceAll('"', '_')}"`,
        })
        await new Promise<void>((resolve, reject) => tarefa!.on('state_changed', s => progresso(Math.round(s.bytesTransferred / s.totalBytes * 100)), reject, resolve))
        enviado = true; tarefa = null
      }
      try { await setDoc(registro, { ...dados, createdAt: serverTimestamp() }) }
      catch (erro) {
        // Um commit confirmado tarde não deve duplicar o anexo nem sobrescrever o registro.
        try {
          const existente = (await getDocFromServer(registro)).data()
          if (existente?.storagePath === storagePath && existente.uploadedBy === uid) return
        } catch {}
        throw erro
      }
    },
  }
}

export async function baixarMaterial(storage: FirebaseStorage, material: Material) {
  if (material.storagePath !== `request-assets/${material.agencyId}/${material.requestId}/${material.filename}`) throw Error('Arquivo inválido.')
  // Download autenticado; não expõe URLs com token permanente de acesso.
  return getBlob(ref(storage, material.storagePath))
}
