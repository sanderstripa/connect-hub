#!/usr/bin/env python3
"""Build the pinned original Sudoku source plus the disclosed compatible patches."""
import hashlib, io, json, os, pathlib, subprocess, tarfile, tempfile, urllib.request

root = pathlib.Path(__file__).resolve().parent.parent

def build(destination):
    source=json.loads((root/'hub/dependencies.json').read_text())['sudokuSource']
    data=urllib.request.urlopen(source['url'],timeout=120).read()
    if hashlib.sha256(data).hexdigest()!=source['sha256']:raise RuntimeError('Sudoku source checksum mismatch')
    with tempfile.TemporaryDirectory(prefix='connect-hub-sudoku-') as temp:
        folder=pathlib.Path(temp)
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            for member in archive.getmembers():
                relative=pathlib.PurePosixPath(*pathlib.PurePosixPath(member.name).parts[1:])
                if not relative.parts:continue
                if relative.is_absolute() or '..' in relative.parts or member.issym() or member.islnk():raise RuntimeError('Unsafe source archive')
                path=folder.joinpath(*relative.parts)
                if member.isdir():path.mkdir(parents=True,exist_ok=True)
                elif member.isfile():
                    path.parent.mkdir(parents=True,exist_ok=True)
                    path.write_bytes(archive.extractfile(member).read())
            for patch in ['sudoku-access-control.patch','sudoku-native-listen.patch']:
                subprocess.run(['git','apply','--check',str(root/'hub/third-party'/patch)],cwd=folder,check=True)
                subprocess.run(['git','apply',str(root/'hub/third-party'/patch)],cwd=folder,check=True)
        subprocess.run(['go','test','./internal/access','./internal/users','./internal/config'],cwd=folder,env={**os.environ,'CGO_ENABLED':'0'},check=True)
        subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(destination),'./cmd/sudoku-tunnel'],cwd=folder,env={**os.environ,'CGO_ENABLED':'0'},check=True)
    return data

if __name__=='__main__':
    import sys
    build(pathlib.Path(sys.argv[1]).resolve())
