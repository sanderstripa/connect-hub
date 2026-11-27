#!/usr/bin/env python3
"""Measure actual per-key WebSocket telemetry from the packaged Xray and Sudoku cores."""
import contextlib
import http.cookiejar
import http.server
import json
import os
import pathlib
import secrets
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import uuid

from websockets.sync.client import connect

root = pathlib.Path(__file__).resolve().parent.parent
candidate = root / 'dist/connect-hub'

def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

class Fixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        payload = b'connect-hub-check' * 1024
        self.send_response(200)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def log_message(self, *args):
        pass

def launch(stack, cmd, directory, env=None):
    log = stack.enter_context((directory / f'{len(list(directory.glob("*.log")))}.log').open('w+'))
    process = subprocess.Popen(cmd, cwd=directory, env=env, stdout=log, stderr=log)
    def stop():
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    stack.callback(stop)
    return process, log

def recv_exact(sock, size):
    data = b''
    while len(data) < size:
        part = sock.recv(size - len(data))
        if not part:
            raise OSError('unexpected eof')
        data += part
    return data

def transfer(socks_port, fixture_port):
    with socket.create_connection(('127.0.0.1', socks_port), timeout=2) as sock:
        sock.sendall(b'\x05\x01\x00')
        assert recv_exact(sock, 2) == b'\x05\x00'
        sock.sendall(b'\x05\x01\x00\x01\x7f\x00\x00\x01' + fixture_port.to_bytes(2, 'big'))
        version, status, _, family = recv_exact(sock, 4)
        assert (version, status) == (5, 0)
        address_length = 4 if family == 1 else 16 if family == 4 else recv_exact(sock, 1)[0]
        recv_exact(sock, address_length + 2)
        sock.sendall(b'GET / HTTP/1.0\r\nHost: localhost\r\n\r\n')
        first = recv_exact(sock, 512)
        assert b'connect-hub-check' in first

with tempfile.TemporaryDirectory(prefix='chr-') as name, contextlib.ExitStack() as stack:
    tmp = pathlib.Path(name)
    bin_dir = tmp / 'bin'
    shutil.copytree(candidate / 'bin', bin_dir)
    state = tmp / 'db'
    state.mkdir()
    logs = tmp / 'logs'
    logs.mkdir()
    env = {**os.environ, 'XUI_DB_FOLDER': str(state),
           'XUI_LOG_FOLDER': str(logs), 'XUI_MAIN_FOLDER': str(candidate),
           'XUI_BIN_FOLDER': str(bin_dir), 'XUI_DB_TYPE': 'sqlite',
           'CONNECT_HUB_INTEGRATIONS_DIR': str(tmp / 'integrations'),
           'CONNECT_HUB_SUDOKU': '1',
           'CONNECT_HUB_SUDOKU_BINARY': str(candidate / 'bin/sudoku-linux-amd64'),
           'CONNECT_HUB_SUDOKU_SHA256': (candidate / 'bin/sudoku.sha256').read_text().strip()}
    panel_port = free_port()
    base = f'http://127.0.0.1:{panel_port}/test/'
    password = secrets.token_hex(24)
    binary = str(candidate / 'connect-hub')
    subprocess.run([binary, 'setting', '-username', 'test', '-password', password,
                    '-port', str(panel_port), '-listenIP', '127.0.0.1',
                    '-webBasePath', '/test/', '-parallelTest'], cwd=tmp, env=env, check=True,
                    stdout=subprocess.DEVNULL)
    panel, panel_log = launch(stack, [binary], tmp, env)
    cookie = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(cookie))
    csrf = None

    def api(path, data=None, form=False):
        headers = {'X-CSRF-Token': csrf} if csrf else {}
        body = None
        if data is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            body = (urllib.parse.urlencode(data) if form else json.dumps(data)).encode()
        request = urllib.request.Request(base + path, data=body, headers=headers)
        with client.open(request, timeout=10) as response:
            result = json.load(response)
        assert result['success'], (path, result['msg'])
        return result.get('obj')

    try:
        for _ in range(80):
            try:
                csrf = api('csrf-token')
                break
            except OSError:
                time.sleep(.25)
        api('login', {'username': 'test', 'password': password}, form=True)
        csrf = api('csrf-token')
        for _ in range(80):
            if api('panel/api/server/status')['xray']['state'] == 'running':
                break
            time.sleep(.25)

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        stack.callback(server.shutdown)
        fixture_port = server.server_port

        template = json.loads(api('panel/api/xray/', {}, form=True))['xraySetting']
        template['outbounds'].append({
            'protocol': 'freedom', 'tag': 'local-fixture',
            'settings': {'finalRules': [{'action': 'allow', 'ip': ['127.0.0.1/32']}, {'action': 'block'}]},
        })
        template['routing']['rules'].insert(0, {
            'type': 'field', 'ip': ['127.0.0.1/32'], 'port': str(fixture_port), 'outboundTag': 'local-fixture',
        })
        api('panel/api/xray/update', {'xraySetting': json.dumps(template),
             'outboundTestUrl': f'http://127.0.0.1:{fixture_port}/'}, form=True)

        xray_port, xray_socks, sudoku_port, sudoku_socks = [free_port() for _ in range(4)]
        user_id = str(uuid.uuid4())
        path = '/local-check'
        xhttp = {'network': 'xhttp', 'security': 'none', 'xhttpSettings': {'path': path, 'mode': 'stream-one'}}
        api('panel/api/inbounds/add', {
            'enable': 'true', 'remark': 'Xray smoke', 'listen': '127.0.0.1', 'port': xray_port,
            'protocol': 'vless', 'expiryTime': 0, 'total': 0, 'up': 0, 'down': 0,
            'settings': json.dumps({'clients': [{'id': user_id, 'email': 'live-xray', 'enable': True}],
                                    'decryption': 'none', 'encryption': 'none', 'fallbacks': []}),
            'streamSettings': json.dumps(xhttp),
            'sniffing': json.dumps({'enabled': False}),
        }, form=True)
        xray_client_config = tmp / 'xray-client.json'
        xray_client_config.write_text(json.dumps({
            'log': {'loglevel': 'warning'},
            'inbounds': [{'listen': '127.0.0.1', 'port': xray_socks, 'protocol': 'socks',
                          'settings': {'auth': 'noauth'}}],
            'outbounds': [{'tag': 'vless', 'protocol': 'vless', 'settings': {
                'vnext': [{'address': '127.0.0.1', 'port': xray_port,
                           'users': [{'id': user_id, 'encryption': 'none'}]}]},
                           'streamSettings': xhttp}],
        }))
        launch(stack, [str(candidate/'bin/xray-linux-amd64'), 'run', '-c', str(xray_client_config)], tmp)

        sudoku_path = 'panel/hub/api/sudoku/inbounds'
        inbound = api(sudoku_path, {'name': 'Sudoku smoke', 'host': '127.0.0.1',
                                    'port': sudoku_port, 'aead': 'chacha20-poly1305', 'table': 'prefer_ascii'})
        inbound_path = sudoku_path + '/' + inbound['id']
        device = api(inbound_path + '/devices', {'name': 'live-sudoku'})
        device_config = api(inbound_path + '/devices/' + device['id'] + '/export', {})['config']
        api(inbound_path + '/start', {})
        sudoku_client_config = tmp / 'sudoku-client.json'
        sudoku_client_config.write_text(json.dumps({**device_config, 'local_port': sudoku_socks}))
        sudoku_env = {**os.environ, 'SUDOKU_STATS_PATH': str(tmp/'client-stats.json'),
                      'SUDOKU_POLICY_PATH': str(tmp/'client-policy.json'),
                      'SUDOKU_CONTROL_SOCKET': str(tmp/'client.sock')}
        launch(stack, [str(candidate/'bin/sudoku-linux-amd64'), '-c', str(sudoku_client_config)], tmp, sudoku_env)
        rows = api('panel/api/inbounds/list')
        sudoku_row = next(row for row in rows if row['port'] == sudoku_port)
        settings = sudoku_row['settings']
        if isinstance(settings, str):
            settings = json.loads(settings)
        sudoku_email = settings['clients'][0]['email']

        headers = {'Cookie': '; '.join(f'{c.name}={c.value}' for c in cookie)}
        with connect(base.replace('http:', 'ws:')+'ws', additional_headers=headers, proxy=None) as ws:
            transferred = {}
            positive = {}
            idle_sudoku = False
            deadline = time.monotonic() + 75
            while time.monotonic() < deadline and not (len(positive) == 2 and idle_sudoku):
                if len(positive) < 2:
                    for key, socks_port in [('sudoku', sudoku_socks), ('xray', xray_socks)]:
                        try:
                            transfer(socks_port, fixture_port)
                            transferred[key] = True
                        except (AssertionError, OSError):
                            continue
                for _ in range(20):
                    try:
                        message = json.loads(ws.recv(timeout=.3))
                    except TimeoutError:
                        break
                    if message['type'] != 'traffic':
                        continue
                    payload = message.get('payload', {})
                    for row in payload.get('sudokuClientTraffics') or []:
                        if row['email'] != sudoku_email:
                            continue
                        if row['up'] > 0 and row['down'] > 0 and row['intervalMs'] > 0:
                            positive['sudoku'] = True
                        if len(positive) == 2 and row['up'] == row['down'] == 0:
                            idle_sudoku = True
                    for row in payload.get('clientTraffics') or []:
                        if row['email'] == 'live-xray' and row['up'] > 0 and row['down'] > 0:
                            positive['xray'] = True
            assert len(transferred) == 2 and len(positive) == 2 and idle_sudoku, (transferred, positive, idle_sudoku)
            print('PASS: live VLESS/XHTTP and Sudoku both send real nonzero up/down WebSocket samples')
            print('PASS: authenticated Sudoku later reports measured zero while the data source is available')
    except Exception:
        if panel.poll() is not None:
            panel_log.seek(0)
            print(panel_log.read()[-1800:].replace(password, '[redacted]'))
        raise
