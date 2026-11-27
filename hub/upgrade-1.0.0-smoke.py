#!/usr/bin/env python3
"""Verify the packaged 1.0.0 → candidate upgrade on a fresh hosted runner."""
import hashlib
import http.cookiejar
import json
import os
import pathlib
import socket
import ssl
import subprocess
import tarfile
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIOUS_SHA256 = '93a6dfb9694a633688c3c8170ae8bfcd82b790ca890c9b87ef590301b425eb7f'
PREVIOUS_URL = ('https://github.com/sanderstripa/connect-hub/releases/download/'
                'v1.0.0/connect-hub-linux-amd64.tar.gz')
ACCESS = '/etc/connect-hub/initial-access.txt'
BIN = '/opt/connect-hub/current/connect-hub'


def sudo(*args):
    return subprocess.check_output(['sudo', *map(str, args)], text=True)


def install(script, archive, digest, *flags):
    sudo('env', 'CONNECT_HUB_TLS_MODE=selfsigned', 'CONNECT_HUB_LISTEN=127.0.0.1',
         'CONNECT_HUB_HOST=127.0.0.1', 'bash', script, '--package', archive,
         '--sha256', digest, *flags)


def login(credentials):
    tls = ssl.create_default_context(cadata=sudo('cat', '/opt/connect-hub/tls/fullchain.pem'))
    client = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=tls),
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
    )
    csrf = None

    def request(path, payload=None, form=False):
        headers = {'X-CSRF-Token': csrf} if csrf else {}
        body = None
        if payload is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            body = (urllib.parse.urlencode(payload) if form else json.dumps(payload)).encode()
        req = urllib.request.Request(credentials['LOCAL_URL'] + path, data=body, headers=headers)
        with client.open(req, timeout=15) as response:
            result = json.load(response)
        assert result['success'], f'{path}: {result.get("msg")}'
        return result.get('obj')

    for attempt in range(25):
        try:
            csrf = request('csrf-token')
            break
        except OSError:
            if attempt == 24:
                raise
            time.sleep(1)
    request('login', {'username': credentials['USERNAME'], 'password': credentials['PASSWORD']}, form=True)
    csrf = request('csrf-token')
    return request


def main():
    assert os.environ.get('GITHUB_ACTIONS') == 'true'
    assert os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted'
    assert not pathlib.Path('/opt/connect-hub').exists(), 'A fresh runner is required'
    with tempfile.TemporaryDirectory(prefix='connect-hub-100-upgrade-') as directory:
        temp = pathlib.Path(directory)
        previous = temp / 'previous.tar.gz'
        req = urllib.request.Request(PREVIOUS_URL, headers={'User-Agent': 'Connect-Hub-upgrade-test'})
        with urllib.request.urlopen(req, timeout=120) as response:
            previous.write_bytes(response.read())
        assert hashlib.sha256(previous.read_bytes()).hexdigest() == PREVIOUS_SHA256
        previous_install = temp / 'install.sh'
        with tarfile.open(previous) as archive:
            previous_install.write_bytes(archive.extractfile('connect-hub/hub/install.sh').read())

        try:
            install(previous_install, previous, PREVIOUS_SHA256)
            assert sudo(BIN, '-v').strip() == '1.0.0'
            before = sudo('cat', ACCESS)
            credentials = dict(line.split('=', 1) for line in before.splitlines())
            api = login(credentials)
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                port = listener.getsockname()[1]
            preset = subprocess.check_output(['node', '-e', '''
const {preset, selection} = require('./apps/windows-installer/connections.cjs');
const port = Number(process.argv[1]);
const inbound = preset('sudoku', selection({
  name: 'Upgrade fixture', email: 'upgrade-key', host: '127.0.0.1', port, protocols: ['sudoku'],
}), port);
inbound.listen = '127.0.0.1';
process.stdout.write(JSON.stringify(inbound));
''', str(port)], text=True, cwd=ROOT)
            api('panel/api/inbounds/add', json.loads(preset))

            def inbound(request):
                return next(row for row in request('panel/api/inbounds/list') if row['port'] == port)

            def client(row):
                settings = row['settings']
                return (json.loads(settings) if isinstance(settings, str) else settings)['clients'][0]

            saved = inbound(api)
            saved_key = client(saved)['sudokuKey']
            assert saved_key

            candidate = ROOT / 'dist/connect-hub-linux-amd64.tar.gz'
            install(ROOT / 'hub/install.sh', candidate,
                    hashlib.sha256(candidate.read_bytes()).hexdigest(), '--update')
            expected = (ROOT / 'internal/config/version').read_text().strip()
            assert sudo(BIN, '-v').strip() == expected
            assert sudo('cat', ACCESS) == before
            after = inbound(login(credentials))
            assert (after['id'], after['remark'], after['protocol'], after['enable']) == (
                saved['id'], saved['remark'], saved['protocol'], saved['enable'],
            )
            assert client(after)['sudokuKey'] == saved_key
            assert sudo('find', '/opt/connect-hub/backups', '-name', 'connect-hub.db').strip()
            print(f'PASS: installed 1.0.0 → {expected} retains login, access settings, inbound and key')
        finally:
            subprocess.run(['sudo', 'systemctl', 'stop', 'connect-hub'], check=False)


if __name__ == '__main__':
    main()
