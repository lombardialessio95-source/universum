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
    if isinstance(v,list): return {'arrayValue':{'values':[field(x) for x in v]}}
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
    # AT03-I01: use canonical coordinates and a real universe fixture.
    room=doc+'/online_universes/F2'
    check(call('/v1/'+room,{'name':room,'fields':{'galaxies':field(3),'systemsPerGalaxy':field(100)}},'owner'),200,'fixture universe')
    home={'ownerUid':'A','serviceRevision':1,'lastUpdated':1,'coords':{'g':1,'s':1,'p':1},'fleet':{'hephaestusForge':1}}
    for pos,owner in [(1,'A'),(2,'A'),(3,'B')]:
        name='1_1_'+str(pos)
        check(put('planets/'+name,{**home,'ownerUid':owner,'coords':{'g':1,'s':1,'p':pos}},'owner'),200,'fixture '+name)
    check(put('players/A',{'serviceRevision':1,'nickname':'A'},'owner'),200,'fixture player')
    check(put('planets/1_1_1',{**home,'lastUpdated':2},alice),403,'checkpoint obsoleto respinto')
    check(put('players/A',{'serviceRevision':4},alice),403,'salto di revisione respinto')
    writes=[{'update':write('planets/1_1_1',{**home,'serviceRevision':2,'lastUpdated':2,'services':{}})},
            {'update':write('players/A',{'serviceRevision':2,'nickname':'A','specialistBuilt':{'hephaestusForge':1}})}]
    check(call('/v1/'+doc+':commit',{'writes':writes},alice,'POST'),200,'checkpoint atomico accettato')
    future=int(time.time()*1000)+600000
    flight={'attackerUid':'A','defenderUid':'A','originCoords':{'g':1,'s':1,'p':1},'targetCoords':{'g':1,'s':1,'p':2},'originKey':'1_1_1','targetKey':'1_1_2','ships':{'hephaestusForge':1},'cargo':{'metal':0,'crystal':0,'deuterium':0},'mission':'deploy','status':'outbound','resolved':False,'arrivalTime':future,'departureTime':future-300000,'returnTime':future+300000}
    check(put('fleets/without-debit',flight,alice),403,'partenza senza addebito respinta R08')
    def transfer(id, fleet):
        writes=[{'update':write('planets/1_1_1',{**home,'serviceRevision':3,'lastUpdated':3,'fleet':{'hephaestusForge':0},'services':{}})},
                {'update':write('players/A',{'serviceRevision':3,'nickname':'A','specialistBuilt':{'hephaestusForge':1},'specialistFlights':[id]})},
                {'update':write('fleets/'+id,fleet)}]
        return call('/v1/'+doc+':commit',{'writes':writes},alice,'POST')
    check(transfer('attack',{**flight,'mission':'attack'}),403,'attacco specialistico respinto anche con addebito')
    check(transfer('other',{**flight,'targetKey':'1_1_3','targetCoords':{'g':1,'s':1,'p':3},'defenderUid':'B'}),403,'destinazione altrui respinta anche con addebito')
    check(transfer('ok',flight),200,'schieramento su colonia propria con addebito atomico')
finally:
    proc.terminate()
    proc.wait(timeout=15)
