"""Actual Firestore Rules diagnostic. Isolated demo project only."""
import os, re, json, time, base64, urllib.request, urllib.error
host=os.environ.get('FIRESTORE_EMULATOR_HOST','')
assert re.fullmatch(r'127\.0\.0\.1:[0-9]+',host), 'Local emulator required'
project='demo-universum-at05'
root=f'http://{host}/v1/projects/{project}/databases/(default)/documents/'
def token(uid):
    enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    now=int(time.time())
    return enc({'alg':'none','typ':'JWT'})+'.'+enc({'sub':uid,'user_id':uid,'aud':project,'iss':'https://securetoken.google.com/'+project,'iat':now,'exp':now+3600})+'.'
def value(x):
    if x is None:return {'nullValue':None}
    if isinstance(x,bool):return {'booleanValue':x}
    if isinstance(x,int):return {'integerValue':str(x)}
    if isinstance(x,str):return {'stringValue':x}
    if isinstance(x,list):return {'arrayValue':{'values':[value(i) for i in x]}}
    return {'mapValue':{'fields':{k:value(v) for k,v in x.items()}}}
def request(path,auth,method='GET',data=None):
    raw=json.dumps({'fields':{k:value(v) for k,v in data.items()}}).encode() if data is not None else None
    req=urllib.request.Request(root+path,data=raw,method=method,headers={'Authorization':'Bearer '+auth,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=15) as res:return res.status,res.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
def seed(name,receipt=None):
    base='online_universes/'+name
    profile={'uid':'pilot','joinedAt':1,'serviceRevision':3}
    if receipt:profile['ordinaryDispatchReceipt']=receipt
    for p,d in [(base,{'founderUid':'pilot','ownerUid':'pilot','speed':1}),(base+'/players/pilot',profile),(base+'/planets/1_1_1',{'ownerUid':'pilot','fleet':{'lightFighter':10},'serviceRevision':3})]:
        status,body=request(p,'owner','PATCH',d)
        assert status==200,(status,body)
    return base,profile
receipt={'operationId':'original','originKey':'1_1_1','expectedRevision':2,'terminalRevision':3,'profileJoinedAt':1,'status':'committed','acknowledged':False}
auth=token('pilot')
def fleet():
    now=int(time.time()*1000)
    return {'attackerUid':'pilot','defenderUid':'enemy','originCoords':{'g':1,'s':1,'p':1},'originKey':'1_1_1','targetCoords':{'g':1,'s':1,'p':3},'targetKey':'1_1_3','mission':'attack','status':'outbound','resolved':False,'departureTime':now,'arrivalTime':now+600000,'returnTime':now+1200000,'ships':{'lightFighter':3},'cargo':{'metal':0,'crystal':0,'deuterium':0}}
base,p=seed('control',receipt)
assert request(base+'/players/pilot',auth)[0]==200,'positive auth control'
assert request(base+'/players/pilot',token('other'),'PATCH',{**p,'serviceRevision':4})[0]==403,'negative auth control'
print('PASS authenticated positive and negative controls',flush=True)
cases=[]
for name,existing,op in [
    ('overwrite',receipt,lambda b,p:request(b+'/players/pilot',auth,'PATCH',{**p,'serviceRevision':4,'ordinaryDispatchReceipt':{**receipt,'operationId':'other'}})),
    ('erase',receipt,lambda b,p:request(b+'/players/pilot',auth,'PATCH',{'uid':'pilot','joinedAt':1,'serviceRevision':4})),
    ('forge',None,lambda b,p:request(b+'/players/pilot',auth,'PATCH',{**p,'serviceRevision':4,'ordinaryDispatchReceipt':{**receipt,'expectedRevision':3,'terminalRevision':4}})),
    ('delete_profile',receipt,lambda b,p:request(b+'/players/pilot',auth,'DELETE')),
    ('fleet_without_receipt',None,lambda b,p:request(b+'/fleets/old',auth,'PATCH',fleet())),
    ('fleet_after_cancellation',{**receipt,'status':'cancelled'},lambda b,p:request(b+'/fleets/original',auth,'PATCH',fleet()))
]:
    b,p=seed(name,existing)
    code,body=op(b,p)
    passed=code==403
    print(('PASS ' if passed else 'FAIL ')+name+' HTTP '+str(code),flush=True)
    if code not in (200,403):print(body.decode(errors='replace'),flush=True)
    cases.append(passed)
raise SystemExit(0 if all(cases) else 1)
