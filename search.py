"""
Wiki search functionality.

NB! All wiki querying must happen in one thread, simultaneous requests
are not allowed.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   02.04.2011
"""
import Queue
import threading

import common
import conf
import gui
import wiki


message_handler = None
message_queue = None # Message queue to search

def init():
    global message_handler, message_queue, site
    message_queue = Queue.Queue()
    message_handler = MessageHandler()


def search(term):
    common.log("Searching for '%s'.", term)
    message_queue.put(term)



class MessageHandler(threading.Thread):
    """Performs searches with messages passed to message queue."""
    def __init__(self):
        threading.Thread.__init__(self)
        self.daemon = True # Daemon threads do not keep application running
        self.start()


    def run(self):
        self.is_running = True
        while self.is_running:
            term = message_queue.get() # Gives a single string
            results = 0
            page = wiki.get_page(term)
            if page:
                common.log("Page '%s' exists for term '%s'.", page["title"], term)
                results += 1
                gui.message("page", results, page)
                # Retrieve more data and signal
                common.log("Page '%s', retrieving categories.", page["title"])
                page["categories"] = wiki.get_categories(page["title"])
                common.log("Page '%s', received %d categories.", page["title"], len(page["categories"]))
                gui.message("page", results, page)
                if page["images"]:
                    common.log("Page '%s', retrieving info for image '%s'.", page["title"], page["images"][0])
                    page["first_image"] = wiki.get_image(page["images"][0])
                gui.message("page", results, page)
            else:
                common.log("No pages found for '%s'.", term)
                gui.message("no results")
            gui.message("status", "Search for '%s' complete." % (term))
