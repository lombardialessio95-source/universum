"""Run against a local Firestore emulator JAR, without production credentials."""
import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[1]
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
url = f'http://127.0.0.1:{port}'
doc = 'projects/demo-universum/databases/(default)/documents'
game = doc+'/online_universes/F2/'
def call(api, body=None, token=None, method='PATCH'):
    headers = {'Content-Type':'application/json'}
    if token:
        headers['Authorization']='Bearer '+token
    req=urllib.request.Request(url+api, data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=12) as res: return res.status
    except urllib.error.HTTPError as e: return e.code
def token(uid):
    def enc(obj): return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
    return enc({'alg':'none','typ':'JWT'})+'.'+enc({'sub':uid,'user_id':uid,'aud':'demo-universum','iss':'https://securetoken.google.com/demo-universum','iat':int(time.time()),'exp':int(time.time())+3600})+'.'
def field(v):
    if isinstance(v,bool): return {'booleanValue':v}
    if isinstance(v,int): return {'integerValue':str(v)}
    if isinstance(v,str): return {'stringValue':v}
    return {'mapValue':{'fields':{k:field(x) for k,x in v.items()}}}
def write(path,data): return {'name':game+path,'fields':{k:field(v) for k,v in data.items()}}
def put(path,data,user): return call('/v1/'+game+path,write(path,data),user)
def check(result,expected,name):
    assert result==expected,(name,result,expected)
    print('OK',name)
proc=subprocess.Popen(['java','-XX:ActiveProcessorCount=2','-jar',os.environ['FIRESTORE_EMULATOR_JAR'],'--host','127.0.0.1','--port',str(port),'--rules',str(root/'firestore.rules')],stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            if call('',method='GET')==200: break
        except OSError: time.sleep(.2)
    alice=token('A')
    coords={'g':1,'s':2,'p':3}
    data={'state':{'id':'2','coords':coords},'coordKey':'1_2_3','ownerUid':'A','version':1,'destroyed':False}
    key='galattiche/A~2'
    check(call('/v1/'+game+key,token=alice,method='GET'),404,'lettura iniziale documento assente')
    check(put(key,data,alice),200,'prima Galattica')
    check(call('/v1/'+game+key,token=token('B'),method='GET'),403,'inventario privato')
    check(put(key,{**data,'version':2},token('B')),403,'scrittura altro impero')
    check(put(key,{**data,'version':3},alice),403,'versione saltata')
    check(put(key,{**data,'version':2},alice),200,'nuovo checkpoint')
    check(put(key,{**data,'version':2},alice),403,'checkpoint ripetuto')
    check(put(key,{**data,'version':3,'destroyed':True},alice),200,'distruzione persistita')
    check(put(key,{**data,'version':4},alice),403,'ripristino obsoleto dopo distruzione')
    marker={'name':'Vega','ownerName':'Pilot','systemKey':'1_2','coordKey':'1_2_3','ownerUid':'B','destroyed':False,'defenses':{}}
    other={**data,'ownerUid':'B','systemKey':'1_2'}
    check(put('galattiche/B~2',other,token('B')),200,'secondo impero alle stesse coordinate')
    check(put('galatticheMap/B~2',marker,token('B')),200,'indicatore pubblico della Galattica')
    check(put('galatticheMap/B~2',{**marker,'resources':{}},token('B')),403,'inventario escluso dalla mappa')
    f={'attackerUid':'A','defenderUid':'B','mission':'destroyMoon','targetGalatticaId':'B~2','targetKey':'1_2_3','status':'outbound','resolved':False,'arrivalTime':1,'ships':{'deathStar':1}}
    check(put('fleets/f',f,'owner'),200,'missione maturata')
    def strike(id,uid):
        writes=[]
        eta=int(time.time()*1000)+60000
        for path,changes in [('galattiche/'+id,{'destroyed':True,'destroyedBy':'f'}),('galatticheMap/'+id,{'destroyed':True,'destroyedBy':'f'}),('fleets/f',{'status':'returning','phase':'IN RITORNO','resolved':False,'arrivalTime':eta,'returnTime':eta})]:
            writes.append({'update':write(path,changes),'updateMask':{'fieldPaths':list(changes)}})
        return call('/v1/'+doc+':commit',{'writes':writes},token(uid),'POST')
    check(strike('A~2','A'),403,'bersaglio non selezionato')
    check(strike('B~2','C'),403,'terzo impero escluso')
    check(strike('B~2','A'),200,'transizione atomica di bersaglio e flotta')
    check(strike('B~2','A'),403,'seconda distruzione esclusa')
finally:
    proc.terminate()
    proc.wait(timeout=15)
