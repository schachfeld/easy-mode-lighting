"""Serve Glow's login identity page over HTTPS inside the test container.

Home Assistant fetches the client ID page to confirm that Glow may use its
glow-lighting:// callback. The container resolves the published identity host
to itself, so this serves the repository's auth-client page instead.
"""

import http.server
import pathlib
import ssl

root = pathlib.Path(__file__).parent
page = (root / "index.html").read_bytes()


class Identity(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/easy-mode-lighting/":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)


server = http.server.HTTPServer(("127.0.0.1", 443), Identity)
context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
context.load_cert_chain(root / "certificate.pem", root / "key.pem")
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
