'use strict';
// Transpile only the small Rules fragment to a JS model. NOT a Firebase compiler.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
let code=rules.slice(rules.indexOf('    function fleetTerminal('),rules.indexOf('    function validOwnerCheckpoint('));
assert(code.includes('function validFleetStructuralUpdate'));
code=code.replace(/\b([\w.]+) is (number|string|map|timestamp)\b/g,(_,v,t)=>`isType(${v},'${t}')`)
 .replace(/(\b\w+\.get\([^\n]*?\)|\b\w+) in (\[[^\]\n]+\])/g,(_,v,l)=>`${l}.includes(${v})`)
 .replace(/(?<![=!<>])==(?!=)/g,'===').replace(/!=(?!=)/g,'!==');
const context=vm.createContext({});
vm.runInContext(`
 const request={auth:{uid:'alice'}};
 const float=Number;
 function isType(v,t){return t==='number'?typeof v==='number':t==='string'?typeof v==='string':t==='timestamp'?v&&v.__ts!==undefined:t==='map'?v!==null&&typeof v==='object'&&!Array.isArray(v)&&v.__ts===undefined:false;}
 Object.defineProperty(Array.prototype,'hasAny',{value:function(keys){return keys.some(k=>this.includes(k));}});
 Object.defineProperty(String.prototype,'matches',{value:function(re){return new RegExp(re).test(this);}});
 Object.defineProperties(Object.prototype,{get:{value:function(k,d){return Object.prototype.hasOwnProperty.call(this,k)?this[k]:d;}},diff:{value:function(o){const n=this;return {affectedKeys:()=>Object.keys({...o,...n}).filter(k=>JSON.stringify(o[k])!==JSON.stringify(n[k]))};}},toMillis:{value:function(){return this.__ts;}}});
 ${code}
`,context);
const T=1795800000000;
const cases=require('./helpers/at04_structural_cases')(T);let allowed=0,denied=0;
const serialize=x=>JSON.stringify(x,(_,v)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT.*Z$/.test(v)?{__ts:Date.parse(v)}:v);
for(const c of cases){const next={...c.old,...c.patch};for(const k of c.remove)delete next[k];const result=vm.runInContext(`request.auth.uid=${JSON.stringify(c.uid)};validFleetStructuralUpdate(${serialize(c.old)},${serialize(next)},${T})`,context);assert.equal(result,c.allow,c.name);if(result)allowed++;else denied++;console.log('PASS',result?'allow':'deny',c.name);}
// All 25 state pairs after due: no backward/terminal revival. No claim about combat outcome.
const phase={outbound:'IN VIAGGIO',returning:'IN RITORNO',embargo:'IN EMBARGO',occupy:'IN OCCUPAZIONE',completed:'COMPLETATA'};
const allowedEdges={outbound:['outbound','returning','embargo','completed'],returning:['returning','completed'],embargo:['embargo','returning'],occupy:['occupy','returning'],completed:['completed']};
for(const a of Object.keys(phase))for(const b of Object.keys(phase)){
 const old={attackerUid:'alice',mission:'embargo',status:a,phase:phase[a],resolved:a==='completed',arrivalTime:T-1000,returnTime:T-1000};
 const next={...old,status:b,phase:phase[b],resolved:b==='completed',...(b==='returning'&&a!==b?{arrivalTime:T+10000,returnTime:T+10000}:{})};
 assert.equal(vm.runInContext(`request.auth.uid='alice';validFleetStructuralUpdate(${serialize(old)},${serialize(next)},${T})`,context),allowedEdges[a].includes(b),`${a}->${b}`);
}
const check=(old,next)=>vm.runInContext(`request.auth.uid='alice';validFleetStructuralUpdate(${serialize(old)},${serialize(next)},${T})`,context);
const o=cases[0].old, terminal={...o,status:'completed',phase:'COMPLETATA',resolved:true,completedAt:T};
assert.equal(check(o,{...o,arrivalTime:T-1,returnTime:T-1}),false);
assert.equal(check(o,terminal),false);
const recalled={...o,mission:'recall',status:'returning',phase:'IN RITORNO',arrivalTime:T-1,returnTime:T-1};
assert.equal(check(o,recalled),true);
assert.equal(check(recalled,{...recalled,status:'completed',phase:'COMPLETATA',resolved:true,completedAt:T}),true);
assert.equal(check(terminal,o),false);
console.log('PASS sequence structural 5/5, residual recall retained');
console.log(`AT04 model ${cases.length}/${cases.length} PASS (${allowed} allow/${denied} deny), 25/25 state pairs; NOT Emulator.`);
