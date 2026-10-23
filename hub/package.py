#!/usr/bin/env python3
"""Package an already-built native Linux panel with checksum-pinned sidecars."""
import hashlib,io,json,os,pathlib,shutil,subprocess,tarfile,urllib.request,zipfile
root=pathlib.Path(__file__).resolve().parent.parent
arch={'x86_64':'amd64','aarch64':'arm64'}.get(os.uname().machine)
if not arch:raise SystemExit('Only native Linux amd64/arm64 builds are supported')
out=root/'dist';out.mkdir(exist_ok=True)
stage=out/'connect-hub';stage.mkdir(exist_ok=False)
subprocess.run(['go','build','-trimpath','-buildvcs=false','-tags=netgo,osusergo','-ldflags=-s -w -linkmode external -extldflags=-static','-o',str(stage/'connect-hub'),'.'],cwd=root,check=True,env={**os.environ,'CGO_ENABLED':'1'})
(stage/'bin').mkdir()
lock=json.loads((root/'hub/dependencies.json').read_text())
for kind,name in [('xray','xray'),('mtg','mtg-multi')]:
 entry=lock[kind][arch]
 data=urllib.request.urlopen(urllib.request.Request(entry['url'],headers={'User-Agent':'Connect-Hub-build'}),timeout=120).read()
 if hashlib.sha256(data).hexdigest()!=entry['sha256']:raise SystemExit(f'{kind} checksum mismatch')
 if kind=='xray':
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   (stage/'bin'/f'xray-linux-{arch}').write_bytes(z.read('xray'))
   for asset in ['geoip.dat','geosite.dat']:
    if asset in z.namelist():(stage/'bin'/asset).write_bytes(z.read(asset))
   for asset in z.namelist():
    if 'license' in asset.lower() and not asset.endswith('/'):(stage/f'XRAY-{pathlib.PurePosixPath(asset).name}').write_bytes(z.read(asset))
 else:
  with tarfile.open(fileobj=io.BytesIO(data)) as t:
   member=next(m for m in t.getmembers() if pathlib.PurePosixPath(m.name).name==name and m.isfile())
   (stage/'bin'/f'mtg-linux-{arch}').write_bytes(t.extractfile(member).read())
   for member in t.getmembers():
    if member.isfile() and 'license' in pathlib.PurePosixPath(member.name).name.lower():(stage/f'MTG-{pathlib.PurePosixPath(member.name).name}').write_bytes(t.extractfile(member).read())
for p in (stage/'bin').iterdir():
 if p.name.startswith(('xray-linux-','mtg-linux-')):p.chmod(0o755)
entry=lock['sudoku'][arch]
data=urllib.request.urlopen(entry['url'],timeout=120).read()
if hashlib.sha256(data).hexdigest()!=entry['sha256']:raise SystemExit('Sudoku checksum mismatch')
with tarfile.open(fileobj=io.BytesIO(data)) as t:
 member=next(m for m in t.getmembers() if m.isfile() and pathlib.PurePosixPath(m.name).name=='sudoku')
 binary=t.extractfile(member).read()
 (stage/'bin'/f'sudoku-linux-{arch}').write_bytes(binary)
 (stage/'bin'/f'sudoku-linux-{arch}').chmod(0o755)
 (stage/'bin'/'sudoku.sha256').write_text(hashlib.sha256(binary).hexdigest())
source=lock['sudokuSource']
data=urllib.request.urlopen(source['url'],timeout=120).read()
if hashlib.sha256(data).hexdigest()!=source['sha256']:raise SystemExit('Sudoku source checksum mismatch')
(stage/'SUDOKU-original-source.tar.gz').write_bytes(data)
with tarfile.open(fileobj=io.BytesIO(data)) as t:
 member=next(m for m in t.getmembers() if m.isfile() and pathlib.PurePosixPath(m.name).name=='LICENSE')
 (stage/'SUDOKU-LICENSE').write_bytes(t.extractfile(member).read())
for name in ['LICENSE','NOTICE','README.md','README.en.md']:shutil.copy2(root/name,stage/name)
shutil.copytree(root/'hub',stage/'hub',ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
revision=os.environ.get('CONNECT_HUB_REVISION') or subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
(stage/'BUILD.json').write_text(json.dumps({'revision':revision,'architecture':arch,'upstream':json.loads((root/'hub/upstream.json').read_text()),'dependencies':lock},indent=2))
archive=out/f'connect-hub-linux-{arch}.tar.gz'
with tarfile.open(archive,'w:gz',format=tarfile.PAX_FORMAT) as t:t.add(stage,arcname='connect-hub')
(out/'SHA256SUMS').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(archive)
