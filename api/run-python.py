from http.server import BaseHTTPRequestHandler
import subprocess, json, tempfile, os, time, sys


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            code = body.get('code', '')
        except Exception as e:
            self._json(400, {'output': '', 'error': str(e), 'elapsed': 0})
            return

        if not code:
            self._json(200, {'output': '', 'error': 'No code provided', 'elapsed': 0})
            return

        tmp = None
        start = time.time()
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(code)
                tmp = f.name

            result = subprocess.run(
                [sys.executable, tmp],
                capture_output=True,
                text=True,
                timeout=9,
            )
            elapsed = int((time.time() - start) * 1000)
            self._json(200, {
                'output':  result.stdout,
                'error':   result.stderr,
                'elapsed': elapsed,
            })
        except subprocess.TimeoutExpired:
            self._json(200, {'output': '', 'error': 'Execution timed out (9s)', 'elapsed': 9000})
        except Exception as e:
            self._json(200, {'output': '', 'error': str(e), 'elapsed': 0})
        finally:
            if tmp:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # suppress access logs
