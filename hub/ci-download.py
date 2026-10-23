"""Download our prior CI package for focused diagnostics, never a release gate."""
import io,json,os,pathlib,urllib.error,urllib.request,zipfile
run=int(os.environ['ARTIFACT_RUN']);token=os.environ['GH_TOKEN']
base='https://api.github.com/repos/sanderstripa/connect-hub/actions/'
def authorized(url):return urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'})
with urllib.request.urlopen(authorized(base+'runs/'+str(run)+'/artifacts'),timeout=30)as r:items=json.load(r)['artifacts']
item=next(a for a in items if a['name']=='connect-hub-linux-amd64' and not a['expired'])
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
try:urllib.request.build_opener(NoRedirect).open(authorized(base+'artifacts/'+str(item['id'])+'/zip'),timeout=30)
except urllib.error.HTTPError as e:
 if e.code!=302:raise
 location=e.headers['Location'];assert location.startswith('https://')
 with urllib.request.urlopen(location,timeout=120)as response:data=response.read()
out=pathlib.Path('dist');out.mkdir()
with zipfile.ZipFile(io.BytesIO(data))as z:
 for name in ('connect-hub-linux-amd64.tar.gz','SHA256SUMS'):(out/name).write_bytes(z.read(name))
print('Downloaded own build artifact for runtime diagnostics')
