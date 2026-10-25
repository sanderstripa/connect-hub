"""Authenticated HTTPS and actual preserved-key Sudoku traffic after desktop setup."""
import http.cookiejar,http.server,json,pathlib,runpy,ssl,sys,tempfile,threading,urllib.parse,urllib.request
root=pathlib.Path(__file__).resolve().parents[3]
credentials=json.loads(sys.stdin.readline())
certificate=pathlib.Path('/opt/connect-hub/tls/fullchain.pem').read_text()
client=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl.create_default_context(cadata=certificate)),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def api(path,payload=None,token=None,json_body=False):
    headers={'X-CSRF-Token':token} if token else {}
    body=urllib.parse.urlencode(payload).encode() if payload is not None else None
    if json_body:body=json.dumps(payload).encode();headers['Content-Type']='application/json'
    with client.open(urllib.request.Request(credentials['url']+path,data=body,headers=headers),timeout=15) as response:return json.load(response)
def login():
    token=api('csrf-token')['obj'];assert api('login',{'username':credentials['username'],'password':credentials['password']},token)['success'];return token
class Target(http.server.BaseHTTPRequestHandler):
    def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'connect-hub-real-xray')
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Target);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    csrf=login()
    with tempfile.TemporaryDirectory(prefix='desktop-sudoku-proof-') as temp:
        suite=runpy.run_path(str(root/'hub/sudoku-inbounds-smoke.py'))['run']
        inbound,other,device,config,*rest=suite(api,csrf,pathlib.Path('/opt/connect-hub/current/bin/sudoku-linux-amd64'),temp,server.server_port,lambda text:print('PASS:',text,flush=True))
        check=rest[-1]
        key=api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},csrf,json_body=True)['obj']['privateKey']
        print('DESKTOP_UPDATE_READY',flush=True)
        assert sys.stdin.readline().strip()=='UPDATE_DONE'
        csrf=login()
        assert api(f'panel/hub/api/sudoku/inbounds/{inbound}/devices/{device}/export',{},csrf,json_body=True)['obj']['privateKey']==key
        check(config)
        print('PASS: desktop-installed HTTPS panel authenticates; same Sudoku device key still forwards HTTP after desktop update',flush=True)
finally:server.shutdown();server.server_close()
