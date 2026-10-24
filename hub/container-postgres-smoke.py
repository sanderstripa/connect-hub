#!/usr/bin/env python3
"""Original optional PostgreSQL container flow, in a separate disposable project."""
import hashlib,http.cookiejar,json,os,pathlib,secrets,ssl,subprocess,tempfile,time,urllib.parse,urllib.request

root=pathlib.Path(__file__).resolve().parent.parent
password=secrets.token_hex(24)
env={**os.environ,'CONNECT_HUB_DB_TYPE':'postgres','CONNECT_HUB_POSTGRES_PASSWORD':password,'CONNECT_HUB_DB_DSN':f'postgres://connecthub:{password}@postgres:5432/connecthub?sslmode=disable'}
with tempfile.TemporaryDirectory(prefix='connect-hub-pg-test-') as raw:
    override=pathlib.Path(raw)/'image.json'
    override.write_text(json.dumps({'services':{'connect-hub':{'image':'connect-hub-test-connect-hub:latest'}}}))
    command=['docker','compose','-p','connect-hub-postgres-test','--profile','postgres','-f',str(root/'docker-compose.yml'),'-f',str(override)]
    def docker(*args,check=True):
        result=subprocess.run([*command,*args],cwd=root,env=env,capture_output=True,text=True,check=check)
        return result.stdout.strip()
    def no_sqlite():
        result=subprocess.run([*command,'exec','-T','connect-hub','test','-e','/etc/connect-hub/connect-hub.db'],cwd=root,env=env,capture_output=True)
        assert result.returncode==1,'PostgreSQL setup unexpectedly created a separate SQLite database'
    try:
        docker('up','-d','--no-build')
        for _ in range(180):
            try:
                text=docker('exec','-T','connect-hub','cat','/etc/connect-hub/initial-access.txt')
                credentials=dict(line.split('=',1)for line in text.splitlines());break
            except subprocess.CalledProcessError:time.sleep(.5)
        else:raise AssertionError('PostgreSQL panel did not initialize')
        def session(certificate=None):
            address=docker('port','connect-hub','2053').rsplit(':',1)[1]
            scheme='https' if certificate else 'http'
            base=credentials['URL'].replace('http://127.0.0.1:2053',scheme+'://127.0.0.1:'+address)
            handlers=[urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())]
            if certificate:handlers.append(urllib.request.HTTPSHandler(context=ssl.create_default_context(cadata=certificate)))
            client=urllib.request.build_opener(*handlers)
            token=None
            def api(path,payload=None):
                headers={'X-CSRF-Token':token} if token else {}
                body=None
                if payload is not None:body=json.dumps(payload).encode();headers['Content-Type']='application/json'
                with client.open(urllib.request.Request(base+path,data=body,headers=headers),timeout=20) as response:return json.load(response)
            for _ in range(120):
                try:token=api('csrf-token')['obj'];break
                except OSError:time.sleep(.5)
            else:raise AssertionError('PostgreSQL panel HTTP listener did not start')
            login=urllib.parse.urlencode({'username':credentials['USERNAME'],'password':credentials['PASSWORD']}).encode()
            with client.open(urllib.request.Request(base+'login',data=login,headers={'X-CSRF-Token':token}),timeout=20) as response:assert json.load(response)['success']
            return api
        api=session();no_sqlite()
        created=api('panel/hub/api/sudoku/inbounds',{'name':'PostgreSQL preserved inbound','host':'127.0.0.1','port':18448,'aead':'chacha20-poly1305','table':'prefer_ascii'})
        assert created['success'],created.get('msg');inbound=created['obj']['id']
        added=api('panel/hub/api/sudoku/inbounds/'+inbound+'/devices',{'name':'PG phone'})
        assert added['success'],added.get('msg');device=added['obj']['id']
        exported=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{})
        assert exported['success'];key_hash=hashlib.sha256(exported['obj']['privateKey'].encode()).hexdigest()
        docker('exec','-T','connect-hub','env','CONNECT_HUB_TLS_MODE=selfsigned','CONNECT_HUB_DOMAIN=127.0.0.1','bash','/app/hub/cert.sh')
        certificate=docker('exec','-T','connect-hub','cat','/opt/connect-hub/tls/fullchain.pem')
        no_sqlite()
        docker('up','-d','--no-build','--force-recreate')
        api=session(certificate);no_sqlite()
        after=docker('exec','-T','connect-hub','cat','/etc/connect-hub/initial-access.txt')
        after=dict(line.split('=',1)for line in after.splitlines())
        assert after['USERNAME']==credentials['USERNAME'] and after['PASSWORD']==credentials['PASSWORD']
        exported=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{})
        assert exported['success'] and hashlib.sha256(exported['obj']['privateKey'].encode()).hexdigest()==key_hash
        print('PASS: optional PostgreSQL profile, normal native Sudoku records, TLS configuration and container recreation preserve the database, login and device key')
    finally:
        docker('down',check=False)

