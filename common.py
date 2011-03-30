"""
Common functionality, like logging.

@author      Erki Suurjaak <erki@lap.ee>
@created     29.03.2011
"""
import datetime
import inspect
import os

import conf
import gui




def log(message, *args):
    """Logs the message to file and GUI."""
    if args:
        message = message % args
    caller = inspect.currentframe().f_back
    callerModule = os.path.basename(caller.f_code.co_filename)
    now = datetime.datetime.now()
    line = u"%s %s [%s:%s]" % (now.strftime("%Y-%m-%d %H:%M:%S"), message, callerModule, caller.f_lineno)
    if hasattr(conf, "LogFilename") and conf.LogFilename:
        f = open(conf.LogFilename, "ab")
        f.write(line.encode("utf-8"))
        f.write("\n")
        f.close()
    gui.message("log", line)
