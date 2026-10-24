import {onRequest} from 'firebase-functions/v2/https'
import {defineSecret} from 'firebase-functions/params'
import {initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore} from 'firebase-admin/firestore'
import {criarServidorRastreabilidade} from '../servidor.mjs'
import {criarServicoRastreabilidade} from '../modelo.mjs'
import {encaminharFirebase} from '../firebase-http.mjs'
import config from './publication.json' with {type:'json'}

const secret=defineSecret('TRACKING_SECRET')
let server
export const conectaTracking=onRequest({region:'southamerica-east1',minInstances:0,maxInstances:1,
  memory:'256MiB',timeoutSeconds:30,concurrency:40,invoker:'public',cors:false,secrets:[secret],
  serviceAccount:'conecta-tracking@imobilaria-deccb.iam.gserviceaccount.com'},(req,res)=>{
  if(!server){
    const app=initializeApp(),db=getFirestore(app)
    const service=criarServicoRastreabilidade({db,secret:secret.value(),publicOrigin:config.publicOrigin,publications:config.publications})
    server=criarServidorRastreabilidade({service,auth:getAuth(app),publicOrigin:config.publicOrigin,
      panelOrigin:config.panelOrigin,legacyPanelOrigin:config.legacyPanelOrigin})
  }
  encaminharFirebase(server,req,res)
})
