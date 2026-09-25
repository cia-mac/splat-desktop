#!/usr/bin/env python3
"""Local server for the depth-splat prototype.

Serves this folder on 127.0.0.1 and accepts POST /result/<name> so the page can
write benchmark JSON, screenshots and recordings into ./results/. Local only.
"""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(ROOT, 'results')
os.makedirs(RESULTS, exist_ok=True)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        m = re.fullmatch(r'/result/([A-Za-z0-9_.-]{1,120})', self.path)
        if not m:
            self.send_error(404); return
        n = int(self.headers.get('Content-Length', 0))
        with open(os.path.join(RESULTS, m.group(1)), 'wb') as f:
            f.write(self.rfile.read(n))
        self.send_response(204); self.end_headers()

    def log_message(self, fmt, *args):
        if 'POST' in (args[0] if args else ''):
            sys.stderr.write('POST %s\n' % args[0])


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
