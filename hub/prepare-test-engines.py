#!/usr/bin/env python3
"""Download pinned test-only Sudoku and build pinned Core. Not shipped in package."""
import hashlib,io,pathlib,subprocess,tarfile,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
tools=root/'dist/test-tools';tools.mkdir(parents=True,exist_ok=True)
url='https://github.com/sanderstripa/sudoku-ui/releases/download/core-v0.7.0/sudoku-core-linux-amd64.tar.gz'
expected='deb5519d88fec1e7cdc9c9d68217b05e1603577dbdd6dc4dfa945ab6d91a6446'
b=urllib.request.urlopen(url,timeout=120).read()
assert hashlib.sha256(b).hexdigest()==expected,'Sudoku archive checksum mismatch'
with tarfile.open(fileobj=io.BytesIO(b)) as t:
 member=next(m for m in t.getmembers() if m.isfile() and pathlib.PurePosixPath(m.name).name=='sudoku')
 (tools/'sudoku').write_bytes(t.extractfile(member).read());(tools/'sudoku').chmod(0o755)
source=tools/'core-source'
subprocess.run(['git','clone','--no-checkout','https://github.com/sanderstripa/connect-core.git',str(source)],check=True)
subprocess.run(['git','checkout','74a094b52c1da079c90d541863a4d8d3f7f8dba3'],cwd=source,check=True)
subprocess.run(['go','build','-trimpath','-o',str(tools/'connect-control'),'./cmd/connect-control'],cwd=source,check=True)
print('Test-only engines prepared; no existing service was inspected')
