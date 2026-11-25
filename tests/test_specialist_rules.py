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
    home={'ownerUid':'A','serviceRevision':1,'lastUpdated':1}
    for name,owner in [('a','A'),('b','A'),('c','B')]: check(put('planets/'+name,{**home,'ownerUid':owner},'owner'),200,'fixture '+name)
    check(put('players/A',{'serviceRevision':1,'nickname':'A'},'owner'),200,'fixture player')
    check(put('planets/a',{**home,'lastUpdated':2},alice),403,'checkpoint obsoleto respinto')
    check(put('players/A',{'serviceRevision':4},alice),403,'salto di revisione respinto')
    writes=[{'update':write('planets/a',{**home,'serviceRevision':2,'lastUpdated':2,'services':{}})},
            {'update':write('players/A',{'serviceRevision':2,'nickname':'A','specialistBuilt':{'hephaestusForge':1}})}]
    check(call('/v1/'+doc+':commit',{'writes':writes},alice,'POST'),200,'checkpoint atomico accettato')
    future=int(time.time()*1000)+600000
    flight={'attackerUid':'A','defenderUid':'A','originCoords':{'g':1},'targetCoords':{'g':1},'originKey':'a','targetKey':'b','ships':{'hephaestusForge':1},'cargo':{},'mission':'deploy','status':'outbound','resolved':False,'arrivalTime':future,'departureTime':future-300000}
    check(put('fleets/ok',flight,alice),200,'schieramento su colonia propria')
    check(put('fleets/attack',{**flight,'mission':'attack'},alice),403,'attacco specialistico respinto')
    check(put('fleets/other',{**flight,'targetKey':'c'},alice),403,'destinazione altrui respinta')
finally:
    proc.terminate()
    proc.wait(timeout=15)
