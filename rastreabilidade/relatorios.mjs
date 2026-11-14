const sources=['root','forwarded','own_return','uncertain']
const sourceFields={root:'rootEntries',forwarded:'forwardedEntries',own_return:'ownReturns',uncertain:'uncertainEntries'}
const ms=value=>value?.toMillis?value.toMillis():new Date(value).getTime()
const metric=()=>({sessions:0,estimatedVisitors:0,pageViews:0,activeMs:0,rootEntries:0,forwardedEntries:0,ownReturns:0,uncertainEntries:0})

// Coorte de sessões iniciadas no período; distintos nunca são somados por dia/corretor.
export function resumir(sessoes,{propertyId,from,to,now=Date.now(),truncated=false,includeUnits=false}){
  const summary=metric(),visitors=new Set(),brokers=new Map(),sections=new Map()
  const units=new Map();let sessionsWithUnit=0,unitActiveMs=0
  const sourceGroups=new Map(sources.map(source=>[source,{sourceClass:source,sessions:0,activeMs:0,visitors:new Set()}]))
  for(const session of [...sessoes].sort((a,b)=>ms(a.startedAt)-ms(b.startedAt))){
    if(session.propertyId!==propertyId||session.consentGranted!==true||ms(session.expiresAt)<=now
      ||ms(session.startedAt)<ms(from)||ms(session.startedAt)>=ms(to))continue
    const source=sources.includes(session.sourceClass)?session.sourceClass:'uncertain'
    const amount=Number.isSafeInteger(session.activeMs)&&session.activeMs>=0?session.activeMs:0
    const views=Number.isSafeInteger(session.pageViews)&&session.pageViews>=0?session.pageViews:0
    if(!brokers.has(session.brokerUid))brokers.set(session.brokerUid,{brokerUid:session.brokerUid,
      brokerName:typeof session.brokerName==='string'&&session.brokerName.trim()?session.brokerName.trim().slice(0,200):'Corretor',...metric(),visitors:new Set()})
    const broker=brokers.get(session.brokerUid),group=sourceGroups.get(source)
    for(const target of [summary,broker]){
      target.sessions++;target.pageViews+=views;target.activeMs+=amount;target[sourceFields[source]]++
    }
    group.sessions++;group.activeMs+=amount
    if(typeof session.visitorHash==='string'){
      visitors.add(session.visitorHash);broker.visitors.add(session.visitorHash);group.visitors.add(session.visitorHash)
    }
    for(const [key,value] of Object.entries(session.sections??{})){
      const bucket=sections.get(key)??{page:value.page,section:value.section,views:0,activeMs:0}
      bucket.views+=value.views;bucket.activeMs+=value.activeMs;sections.set(key,bucket)
    }
    if(includeUnits){
      let mapped=false
      for(const [unitKey,value] of Object.entries(session.units??{})){
        if(!/^p\d{2}-f\d{2}$/.test(unitKey)||!Number.isSafeInteger(value.activeMs)||value.activeMs<0)continue
        const unit=units.get(unitKey)??{unitKey,sessions:0,returns:0,activeMs:0,visitors:new Set()}
        unit.sessions++;unit.activeMs+=value.activeMs;unitActiveMs+=value.activeMs;mapped=true
        if(typeof session.visitorHash==='string'){
          if(unit.visitors.has(session.visitorHash))unit.returns++
          unit.visitors.add(session.visitorHash)
        }
        units.set(unitKey,unit)
      }
      if(mapped)sessionsWithUnit++
    }
  }
  summary.estimatedVisitors=visitors.size
  return {from:new Date(ms(from)).toISOString(),to:new Date(ms(to)).toISOString(),propertyId,summary,
    byBroker:[...brokers.values()].map(({visitors,...broker})=>({...broker,estimatedVisitors:visitors.size})).sort((a,b)=>a.brokerUid.localeCompare(b.brokerUid)),
    bySource:[...sourceGroups.values()].map(({visitors,...group})=>({...group,estimatedVisitors:visitors.size})),
    bySection:[...sections.values()].sort((a,b)=>(a.page+':'+a.section).localeCompare(b.page+':'+b.section)),
    ...(includeUnits?{byUnit:[...units.values()].map(({visitors,...unit})=>unit)
      .sort((a,b)=>b.sessions-a.sessions||b.activeMs-a.activeMs||a.unitKey.localeCompare(b.unitKey)).slice(0,500),
      unitCoverage:{sessionsWithUnit,unassignedActiveMs:Math.max(0,summary.activeMs-unitActiveMs)}}:{}),
    coverage:{consentedOnly:true,truncated:truncated||units.size>500,retentionDays:30}}
}
