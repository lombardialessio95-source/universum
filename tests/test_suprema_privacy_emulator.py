"""Local Firestore proof for document read visibility. Never uses the live project."""
import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

RULES = """
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /sieges/{id} { allow read: if request.auth != null; }
    match /siegePrivate/{id} { allow read: if request.auth.uid == resource.data.attackerUid; }
  }
}
"""

def token(uid):
    def encode(body):
        return base64.urlsafe_b64encode(json.dumps(body).encode()).decode().rstrip('=')
    now = int(time.time())
    return encode({'alg':'none','typ':'JWT'})+'.'+encode({
        'sub':uid,'user_id':uid,'aud':'demo-universum',
        'iss':'https://securetoken.google.com/demo-universum','iat':now,'exp':now+3600})+'.'

def call(url, auth, fields=None):
    data = json.dumps({'fields':fields}).encode() if fields is not None else None
    request = urllib.request.Request(url,data=data,method='PATCH' if data is not None else 'GET',
                                     headers={'Authorization':'Bearer '+auth,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=8) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as error:
        return error.code,error.read()

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port = sock.getsockname()[1]
base = f'http://127.0.0.1:{port}'
path = base+'/v1/projects/demo-universum/databases/(default)/documents/'
with tempfile.TemporaryDirectory() as temp:
    rules = Path(temp)/'firestore.rules'
    rules.write_text(RULES)
    proc = subprocess.Popen(['java','-XX:ActiveProcessorCount=2','-jar',os.environ['FIRESTORE_EMULATOR_JAR'],
                             '--host','127.0.0.1','--port',str(port),'--rules',str(rules)],
                            stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                if call(base,'owner')[0] == 200:
                    break
            except OSError:
                time.sleep(.2)
        else:
            raise RuntimeError('Emulator did not start')
        public={'attackerUid':{'stringValue':'attacker'},'frequencyHours':{'integerValue':'2'}}
        secret={'mode':{'stringValue':'prudente'},'operatingFuel':{'integerValue':'600000'}}
        defender=token('defender')
        assert call(path+'sieges/combined','owner',{**public,**secret})[0]==200
        code,body=call(path+'sieges/combined',defender)
        assert code==200 and set(json.loads(body)['fields'])==set(public)|set(secret)
        assert call(path+'sieges/redacted','owner',public)[0]==200
        assert call(path+'siegePrivate/redacted','owner',{**secret,'attackerUid':public['attackerUid']})[0]==200
        code,body=call(path+'sieges/redacted',defender)
        assert code==200 and set(json.loads(body)['fields'])==set(public)
        assert call(path+'siegePrivate/redacted',defender)[0]==403
        assert call(path+'siegePrivate/redacted',token('attacker'))[0]==200
        print('Emulatore: il documento condiviso espone tutti i campi; con la separazione il difensore non può leggere la modalità o il carburante.')
    finally:
        proc.terminate()
        proc.wait(timeout=15)
