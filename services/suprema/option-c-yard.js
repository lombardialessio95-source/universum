'use strict';
// Cantiere interno Suprema ONLINE — stesse classi e formula temporale ordinaria,
// capienza 4000 separata dal cantiere OFFLINE (600).
const I=require('./option-c-inventory');
const resources=['metal','crystal','deuterium'];
function start(supreme,engine,ship,count,id,at,speed=1){
  if(supreme.status!=='docked'||!Object.hasOwn(I.WEIGHTS,ship)||!Number.isSafeInteger(count)||
     count<1||count>4000||typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||
     supreme.shipyardQueue.some(o=>o.id===id)||!Number.isSafeInteger(at)||at<0) {
    throw Error('Ordine cantiere non valido.');
  }
  const queuedSlots=supreme.shipyardQueue.reduce((n,o)=>n+(o.remaining||0)*(I.WEIGHTS[o.ship]||0),0);
  if(I.inventory(supreme.hangar)+queuedSlots+count*I.WEIGHTS[ship]>I.ONLINE_CAPACITY) {
    throw Error('La coda supera la capienza online (4000 slot).');
  }
  const spec=engine.data.SHIPS[ship];
  if(!spec||!spec.cost||!(Number(speed)>0))throw Error('Catalogo cantiere non valido.');
  const raw=(((spec.cost.metal+spec.cost.crystal)+(spec.attack+spec.shield)*0.5+
    (spec.complexity||1)*500)/(2500*13*Math.max(1,Number(speed))))*3600;
  const duration=Math.max(1,Math.floor(raw))*1000;
  supreme.shipyardQueue.push({id,ship,remaining:count,queuedAt:at,
    duration,cost:Object.fromEntries(resources.map(k=>[k,spec.cost[k]||0]))});
  return {orderId:id,durationMs:duration,remaining:count};
}
function reserved(supreme) {
  const first=supreme.shipyardQueue?.[0];
  return first?.finishAt!==undefined?I.WEIGHTS[first.ship]:0;
}
function advance(s,now) {
  if(!Array.isArray(s.shipyardQueue))s.shipyardQueue=[];
  if(!Number.isSafeInteger(now)||now<0)throw Error('Orologio cantiere non valido.');
  let cursor=s.shipyardAt??0,completed=0;
  while(s.shipyardQueue.length) {
    const order=s.shipyardQueue[0];
    if(order.finishAt!==undefined) {
      if(order.finishAt>now)break;
      cursor=order.finishAt;
      s.hangar.reserve[order.ship]=(s.hangar.reserve[order.ship]||0)+1;
      completed++;order.remaining--;
      delete order.finishAt;
      if(!order.remaining){s.shipyardQueue.shift();continue;}
    }
    if(order.queuedAt>now)break;
    if(I.inventory(s.hangar)+I.WEIGHTS[order.ship]>I.ONLINE_CAPACITY||
       resources.some(k=>(s.resources[k]||0)<order.cost[k])) {
      s.shipyardAt=now;return completed;
    }
    for(const k of resources)s.resources[k]-=order.cost[k];
    order.finishAt=Math.max(cursor,order.queuedAt)+order.duration;
  }
  s.shipyardAt=Math.max(s.shipyardAt||0,cursor);
  return completed;
}
module.exports=Object.freeze({start,advance,reserved});
