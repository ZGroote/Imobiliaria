import {onRequest} from 'firebase-functions/v2/https'
import {defineSecret} from 'firebase-functions/params'
import {initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore} from 'firebase-admin/firestore'
import {readFile} from 'node:fs/promises'
import {criarServidorRastreabilidade} from '../servidor.mjs'
import {criarServicoRastreabilidade} from '../modelo.mjs'
import {encaminharFirebase} from '../firebase-http.mjs'
import {criarPublicacaoPublica} from '../publicacao-publica.mjs'
import config from './publication.json' with {type:'json'}
import pages from './lib/public-pages.json' with {type:'json'}

const secret=defineSecret('TRACKING_SECRET')
let server,publicPage
export const conectaTracking=onRequest({region:'southamerica-east1',minInstances:0,maxInstances:1,
  memory:'256MiB',timeoutSeconds:30,concurrency:40,invoker:'public',cors:false,secrets:[secret],
  serviceAccount:'conecta-tracking@imobilaria-deccb.iam.gserviceaccount.com'},async(req,res)=>{
  if(!server){
    const app=initializeApp(),db=getFirestore(app)
    publicPage=criarPublicacaoPublica({db,pages,
      loadPage:page=>readFile(new URL('pages/'+page.file,import.meta.url))})
    const service=criarServicoRastreabilidade({db,secret:secret.value(),publicOrigin:config.publicOrigin,publications:config.publications})
    server=criarServidorRastreabilidade({service,auth:getAuth(app),publicOrigin:config.publicOrigin,
      panelOrigin:config.panelOrigin,legacyPanelOrigin:config.legacyPanelOrigin})
  }
  if(await publicPage(req,res))return
  encaminharFirebase(server,req,res)
})
