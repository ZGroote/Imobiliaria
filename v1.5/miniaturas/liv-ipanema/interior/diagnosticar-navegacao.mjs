/** Read-only probe using the same InteriorNavigation, on the viewer's actual PL_R dump. */
import fs from 'node:fs'
import vm from 'node:vm'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const base=path.dirname(fileURLToPath(import.meta.url))
const d=JSON.parse(fs.readFileSync(path.join(base,'../qa/interior-colisao-debug.json'),'utf8'))
const polyIn=(poly,x,z)=>{
  let inside=false
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,zi]=poly[i],[xj,zj]=poly[j]
    if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))inside=!inside
  }
  return inside
}
vm.runInThisContext(fs.readFileSync(path.join(base,'../../../../v1.5/renderizador-v16-moveis/interior/navigation.js'),'utf8'))
const pl={...d,contorno:d.comodos.map(c=>c.poly),W:(u,v)=>[u,v]}
const alto=['aereo','coifa','ripado','rack','cortina','box']
const MOVEIS=Object.fromEntries(alto.map(k=>[k,{alto:1}]))
function probe(radius,step,omit=[]){
  const INT={pl,moveis:d.moveis.filter((m,i)=>!omit.includes(i))}
  const nav=globalThis.InteriorNavigation.create({INT,dentroDaPlanta:(p,x,z)=>p.contorno.some(poly=>polyIn(poly,x,z)),
    paraUV:(x,z)=>[x,z],MOVEIS,ESP:.13,RAIO:radius,OLHO:1.6})
  const cols=Math.round(8.5/step),rows=Math.round(6.25/step),cells=new Set(),coords=new Map()
  for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++){
    const x=-4.25+i*step,z=-3.125+j*step
    if(nav.livre(x,z)){let k=i+','+j;cells.add(k);coords.set(k,[x,z])}
  }
  const nearest=(x,z)=>[...cells].sort((a,b)=>{
    const aa=coords.get(a),bb=coords.get(b)
    return Math.hypot(aa[0]-x,aa[1]-z)-Math.hypot(bb[0]-x,bb[1]-z)
  })[0]
  const start=nearest(2.5,1.9),visited=new Set([start]),queue=[start]
  for(let head=0;head<queue.length;head++){
    const [i,j]=queue[head].split(',').map(Number)
    for(const [di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const k=(i+di)+','+(j+dj)
      if(cells.has(k)&&!visited.has(k)){visited.add(k);queue.push(k)}
    }
  }
  return {radius,step,omit,walkableCells:cells.size,connectedCells:visited.size,
    rooms:d.comodos.map(c=>({room:c.nome,total:[...cells].filter(k=>polyIn(c.poly,...coords.get(k))).length,
      reached:[...visited].filter(k=>polyIn(c.poly,...coords.get(k))).length}))}
}
const report=[probe(.30,.10),probe(.30,.05),probe(.25,.05),probe(.22,.05),probe(.30,.05,[24]),probe(.30,.05,[17])]
fs.writeFileSync(path.join(base,'diagnostico-navegacao.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
