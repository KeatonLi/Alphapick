import http.server
import socketserver
import os

PORT = 8000
HOST = "0.0.0.0"

os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer((HOST, PORT), Handler)
print(f"Serving at http://{HOST}:{PORT}")
httpd.serve_forever()
