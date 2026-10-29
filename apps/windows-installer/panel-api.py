# Connect Hub desktop panel bridge, 2026. GPL-3.0-only.
# Executed in memory over authenticated SSH; never writes credentials or keys.
import http.cookiejar
import json
import pathlib
import socket
import ssl
import sys
import urllib.parse
import urllib.request


class PanelError(Exception):
    pass


class Panel:
    def __init__(self, access, auth=None):
        url = urllib.parse.urlsplit(access['URL'])
        if url.scheme not in ('http', 'https') or not url.hostname or url.username:
            raise PanelError('PANEL_ACCESS_FAILED')
        # Only a server-local socket is contacted. TLS trust comes from SSH,
        # which has already verified the server's identity with the user.
        self.base = '%s://127.0.0.1:%s%s' % (url.scheme, url.port or (443 if url.scheme == 'https' else 80), url.path.rstrip('/') + '/')
        self.client = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
            urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        self.token = self.request('csrf-token')
        self.request('login', {'username': (auth or {}).get('username') or access['USERNAME'],
                               'password': (auth or {}).get('password') or access['PASSWORD']})

    def request(self, route, payload=None):
        headers = {'X-CSRF-Token': self.token} if hasattr(self, 'token') else {}
        data = None
        if payload is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(payload).encode()
        req = urllib.request.Request(self.base + route, data=data, headers=headers)
        try:
            with self.client.open(req, timeout=20) as response:
                body = json.loads(response.read(4 * 1024 * 1024))
        except Exception as exc:
            raise PanelError('PANEL_ACCESS_FAILED') from exc
        if not isinstance(body, dict) or body.get('success') is not True:
            raise PanelError('PANEL_AUTH_FAILED' if route == 'login' else 'PANEL_REQUEST_FAILED')
        return body.get('obj')

    def run(self, request):
        action = request.get('action')
        if action == 'list':
            return self.request('panel/api/inbounds/list')
        if action == 'keys':
            return self.request('panel/api/server/getNewX25519Cert')
        key_routes = {'vless': 'getNewVlessEnc', 'mldsa': 'getNewmldsa65', 'reality': 'getNewX25519Cert'}
        if action == 'generate' and request.get('kind') in key_routes:
            return self.request('panel/api/server/' + key_routes[request['kind']])
        if action in ('details', 'update'):
            ident = request.get('id')
            if not isinstance(ident, int) or ident < 1:
                raise PanelError('INVALID_CONNECTION')
            current = self.request('panel/api/inbounds/get/' + str(ident))
            if current.get('nodeId'):
                raise PanelError('INVALID_CONNECTION')
            if action == 'details':
                return current
            inbound = request['inbound']
            if inbound.get('protocol') != current.get('protocol'):
                raise PanelError('INVALID_CONNECTION')
            if inbound.get('port') != current.get('port'):
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as check:
                    try:
                        check.bind(('0.0.0.0', inbound['port']))
                    except OSError as exc:
                        raise PanelError('PORT_IN_USE') from exc
            return self.request('panel/api/inbounds/update/' + str(ident), inbound)
        if action != 'create':
            raise PanelError('INVALID_CONNECTION')
        inbound = request['inbound']
        port = inbound['port']
        if not isinstance(port, int) or not 1 <= port <= 65535:
            raise PanelError('INVALID_CONNECTION')
        # Include unrelated services in the collision check. The panel repeats
        # its own checks on insertion, so a stale list never overwrites a row.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as check:
            try:
                check.bind(('0.0.0.0', port))
            except OSError as exc:
                raise PanelError('PORT_IN_USE') from exc
        return self.request('panel/api/inbounds/add', inbound)


def main():
    try:
        request = json.load(sys.stdin)
        root = pathlib.Path('/etc/connect-hub')
        if not (root / '.connect-hub-owned').is_file():
            raise PanelError('PANEL_ACCESS_FAILED')
        access = dict(line.split('=', 1) for line in (root / 'initial-access.txt').read_text().splitlines() if '=' in line)
        print(json.dumps({'ok': True, 'value': Panel(access, request.get('auth')).run(request)}))
    except PanelError as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
    except Exception:
        print(json.dumps({'ok': False, 'error': 'PANEL_ACCESS_FAILED'}))


if __name__ == '__main__':
    main()
