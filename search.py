"""
Wiki search functionality.

NB! All wiki querying must happen in one thread, simultaneous requests
are not allowed.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   30.03.2011
"""
import Queue
import threading

import common
import conf
import gui
import mwclient2


messageHandler = None
messageQueue = None # Message queue to search
site = None         # Mwclient site instance

def init():
    global messageHandler, messageQueue, site
    messageQueue = Queue.Queue()
    messageHandler = MessageHandler()
    site = mwclient2.Site(conf.WikiUrl)


def search(term):
    common.log("Searching for '%s'.", term)
    messageQueue.put(term)



class MessageHandler(threading.Thread):
    """Performs searches with messages passed to message queue."""
    def __init__(self):
        threading.Thread.__init__(self)
        self.daemon = True # Daemon threads do not keep application running
        self.start()


    def run(self):
        self.isRunning = True
        while self.isRunning:
            term = messageQueue.get() # Gives a single string
            results = 0
            page = site.Pages[term]
            if page.exists:
                common.log("Page '%s' exists for term '%s'.", page.page_title, term)
                results += 1
                gui.message("page", results, page)
                # Retrieve more data and signal
                page.expanded = "".join(page.get_expanded()) # Force a retrieval
                page.categories_initialized = list(page.categories())
                gui.message("page", results, page)
            else:
                common.log("No single page for '%s' exists.", term)
                pp = site.search(term, what="text")
                titles = []
                for i in pp:
                    results += 1
                    gui.message("page", results, i)
                    #gui.message("page", counter, site.Pages[i["title"]])
                    titles.append(i["title"])
                    common.log("%d. result for '%s': %s (%s).", results, term, i["title"], i["snippet"])
                    if results >= conf.MaxResults:
                        break
                for i in range(len(titles)):
                    page = site.Pages[titles[i]]
                    # Retrieve more data and signal
                    page.expanded = "".join(page.get_expanded()) # Force a retrieval
                    page.categories_initialized = list(page.categories()) # Force a retrieval
                    common.log("Page '%s', expanded text %s chars, %s categories.", page.page_title, len(page.expanded), len(page.categories_initialized))
                    gui.message("page", i + 1, page)
                #    import time
                #    time.sleep(0.5)
                if not results:
                    common.log("No pages found for '%s'.", term)
                    gui.message("no results")
            gui.message("status", "Search for '%s' complete, %s result(s)." % (term, results))
