"""Receive newly generated, local Chrome review frames; no access to user files."""
from http.server import BaseHTTPRequestHandler,HTTPServer
from pathlib import Path
import hashlib,json,time
out=Path(__file__).resolve().parent/'evidence';out.mkdir(exist_ok=True)
origin='http://astridnext.localhost:4206'
class Handler(BaseHTTPRequestHandler):
 def cors(self):
  self.send_header('Access-Control-Allow-Origin',origin)
  self.send_header('Access-Control-Allow-Headers','Content-Type')
  self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
 def do_OPTIONS(self):
  self.send_response(204);self.cors();self.end_headers()
 def do_POST(self):
  if self.path!='/frame' or self.headers.get('Origin')!=origin:self.send_error(403);return
  size=int(self.headers.get('Content-Length','0'));mime=self.headers.get('Content-Type','').split(';')[0]
  if mime not in ['image/png','video/webm'] or not 0<size<80000000:self.send_error(413);return
  data=self.rfile.read(size)
  if mime=='image/png' and not data.startswith(b'\x89PNG\r\n\x1a\n'):self.send_error(400);return
  if mime=='video/webm' and not data.startswith(b'\x1aE\xdf\xa3'):self.send_error(400);return
  name=f'chrome-{time.time_ns()}'+('.png' if mime=='image/png' else '-silent.webm')
  (out/name).write_bytes(data)
  receipt={'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'capture':'actual Chrome WebGL canvas; UI not included','audio':'none'}
  (out/(name+'.json')).write_text(json.dumps(receipt,indent=2))
  payload=json.dumps(receipt).encode();self.send_response(200);self.cors();self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
 def log_message(self,*args):pass
HTTPServer(('127.0.0.1',4207),Handler).serve_forever()
