"""
Backend server, listens on HTTP for wiki requests, performs requests and
sends results back to frontend, over JSON.

Initially uses a very simple raw HTTP server.

@author     Erki Suurjaak <erki@lap.ee>
@created    01.03.2011
@modified   02.04.2011
"""
import BaseHTTPServer
import cgi
import datetime
import json
import threading
import wsgiref.simple_server

import common
import conf
import wiki

server_thread = None


def init():
    global server_thread
    server_thread = ServerThread()


class RequestHandler(object):
    def __call__(self, environ, start_response):
        server_thread.environ = environ

        arg_list = []
        if "POST" == environ["REQUEST_METHOD"]:
            data = ""
            try:
                data = environ["wsgi.input"].read(int(environ["CONTENT_LENGTH"]))
            except:
                try:
                    data = environ["wsgi.input"].read()
                except:
                    pass
            common.log("Got POST query '%s'.", data)
            arg_list = cgi.parse_qsl(data)
        elif "GET" == environ["REQUEST_METHOD"]:
            data = environ.get("QUERY_STRING", "")
            arg_list = cgi.parse_qsl(data)

        query = dict(arg_list)
        common.log("Got %s query '%s'.", environ["REQUEST_METHOD"], data)

        if "/index.html" == environ["PATH_INFO"]:
            with file(conf.FrontendFile) as f:
                message = f.read()
        else:
            response = {}
            if "action" in query and "param" in query:
                response = getattr(wiki, query["action"])(query["param"])
            message = json.dumps(response)
            common.log("Sending response '%s'.", message)

        server_thread.start_response = start_response("200 OK", [("Content-Type", "text/html")])
        return [ message ]





class ServerThread(threading.Thread):
    """Performs searches with messages passed to message queue."""
    def __init__(self):
        threading.Thread.__init__(self)
        self.daemon = True # Daemon threads do not keep application running
        self.is_running = True
        self.start()


    def run(self):
        self.server = wsgiref.simple_server.WSGIServer(('', conf.BackendPort), SilentHandler)
        handler = RequestHandler()
        self.server.set_app(handler)
        while self.is_running:
            self.server.handle_request()


class SilentHandler(wsgiref.simple_server.WSGIRequestHandler):
    def log_request(self, *args, **kwargs):
        pass