"""Loopback-only JSON API and static files; no third-party Python dependencies."""
import argparse
import json
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from .providers import OfficialProvider, DemoProvider, ProviderError
from .service import SnapshotService

ROOT = Path(__file__).resolve().parent.parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, service, **kwargs):
        self.service = service
        super().__init__(*args, directory=str(ROOT/'static'), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def json(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        host = self.headers.get('Host', '').split(':')[0]
        if host not in ('127.0.0.1', 'localhost'):
            return self.json(403, {'error':'Use localhost or 127.0.0.1.'})
        parsed = urlsplit(self.path)
        if parsed.path.startswith('/api/'):
            params = parse_qs(parsed.query)
            mode = params.get('mode',['live'])[0]
            term = params.get('term',[''])[0]
            crn = params.get('crn',[''])[0]
            try:
                if parsed.path == '/api/terms':
                    return self.json(200,self.service.get(mode))
                if parsed.path == '/api/courses' and re.fullmatch(r'[A-Za-z0-9_-]{1,20}',term):
                    return self.json(200,self.service.get(mode,term))
                if parsed.path == '/api/linked' and re.fullmatch(r'[A-Za-z0-9_-]{1,20}',term) and re.fullmatch(r'[A-Za-z0-9_-]{1,20}',crn):
                    return self.json(200,self.service.get(mode,term,crn))
                if parsed.path == '/api/details' and re.fullmatch(r'[A-Za-z0-9_-]{1,20}',term) and re.fullmatch(r'[A-Za-z0-9_-]{1,20}',crn):
                    return self.json(200,self.service.get(mode,term,crn,'details'))
                return self.json(400,{'error':'Unknown route or invalid term.'})
            except ValueError as exc:
                return self.json(400,{'error':str(exc)})
            except ProviderError as exc:
                return self.json(503,{'error':str(exc),'retryAfter':exc.retry_after})
        if parsed.path.endswith('/') and parsed.path != '/':
            return self.json(404, {'error':'Not found.'})
        return super().do_GET()

def main():
    parser = argparse.ArgumentParser(description='UC Merced local course planner')
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--cache-seconds',type=int,default=600)
    args = parser.parse_args()
    service = SnapshotService({'live':OfficialProvider(),'demo':DemoProvider()},ROOT/'.cache',args.cache_seconds)
    server = ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,service=service))
    print(f'Course planner: http://127.0.0.1:{args.port}',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
