"""
Application GUI functionality.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   31.03.2011
"""
import Queue
import threading
import wx
import wx.html
import wx.py

import common
import conf
import search


application = None   # wx application
mainWindow = None    # MainWindow instance
messageQueue = None  # Queue for messages to GUI


def message(msg, *args):
    """Registers a message with the GUI."""
    if messageQueue:
        messageQueue.put([msg, list(args)])



def init():
    """Starts up the GUI and runs until program exit."""
    global application, mainWindow, messageQueue
    messageQueue = Queue.Queue()
    messageHandler = MessageHandler()
    application = wx.App()
    mainWindow = MainWindow()
    mainWindow.console.run("self = gui.mainWindow")
    application.MainLoop()


class MainWindow(wx.Frame):
    """The main frame of the application."""
    title = "Wikkr 0.1"


    def __init__(self):
        wx.Frame.__init__(self, parent=None, id=-1, title=self.title, size=(800, 750))

        self.current_pages = {}
        self.new_search_ongoing = False

        self.panel = wx.Panel(self, -1)

        search_sizer = wx.FlexGridSizer(rows=1, cols=4, vgap=10, hgap=25)
        heading = wx.StaticText(parent=self.panel, id=-1, label="Enter search term:")
        self.search_box = wx.TextCtrl(parent=self.panel, id=-1, size=(120,-1),  style=wx.TE_PROCESS_ENTER)
        self.Bind(wx.EVT_TEXT_ENTER, self.on_search_box, self.search_box)
        search_sizer.Add(heading)
        search_sizer.Add(self.search_box)

        self.search_button = wx.Button(parent=self.panel, id=wx.ID_OK, label="Go!")
        self.search_button.SetDefault()
        self.Bind(wx.EVT_BUTTON, self.on_search_button, self.search_button)
        search_sizer.Add(self.search_button)

        # @todo start using this one?
        #self.search_ctrl = wx.SearchCtrl(parent=self.panel, id=-1)
        #search_sizer.Add(self.search_ctrl)

        self.notebook = wx.Notebook(self.panel, -1, style=wx.NB_TOP)

        self.create_results_page()
        self.create_log_page()
        self.create_console_page()


        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(search_sizer, flag=wx.ALL | wx.EXPAND, border=5)
        box.Add(item=self.notebook, flag=wx.EXPAND | wx.ALL)
        self.panel.SetSizer(box) 

        self.Bind(wx.EVT_CLOSE, self.on_exit)

        self.search_box.SetFocus()

        self.statusbar = self.CreateStatusBar()
        self.Centre()
        self.Show(True)


    def create_console_page(self):
        self.console_page = wx.Panel(self.notebook, -1)
        self.notebook.AddPage(self.console_page, 'Console')
        self.console = wx.py.shell.Shell(parent=self.console_page, id=-1, introText=wx.py.version.VERSION, size=(780, 600))


    def create_log_page(self):
        self.log_page = wx.Panel(self.notebook, -1)
        self.notebook.AddPage(self.log_page, 'Log')

        self.log = wx.TextCtrl(self.log_page, -1, style=wx.TE_MULTILINE, size=(740, 600))
        self.log.SetEditable(False)
        self.clear_log_button = wx.Button(parent=self.log_page, id=-1, label="Clear log")
        self.clear_log_button.Bind(event=wx.EVT_BUTTON, handler=lambda event: self.log.Clear())

        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(self.log, flag=wx.ALL | wx.EXPAND, border=5)
        box.Add(self.clear_log_button)
        self.log_page.SetSizer(box)


    def create_results_page(self):
        self.results_page = wx.Panel(self.notebook, -1)
        self.notebook.AddPage(self.results_page, 'Results')

        self.html = wx.html.HtmlWindow(self.results_page)
        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(self.html, proportion=1, flag=wx.ALL | wx.EXPAND, border=5)
        self.results_page.SetSizer(box)


    def on_exit(self, event):
        self.Destroy()


    def on_search_box(self, event):
        self.on_search_button(event)


    def on_search_button(self, event):
        term = self.search_box.Value.strip()
        if term:
            message("status", "Searching for '%s'.." % term)
            self.new_search_ongoing = True
            search.search(term)


    def log_message(self, message):
        self.log.AppendText(unicode(message) + "\n")


    def add_result(self, result_number, page):
        if self.new_search_ongoing:
            self.current_html = "" # @todo remove debugging var
            self.current_pages.clear()
            self.html.SetPage("")
            self.new_search_ongoing = False
        self.last_page = page
        entry = {"number": result_number, "title": "", "snippet": "", "categories": "", "object": None}
        if type(page) is dict:
            entry.update(page)
        else:
            entry["title"] = page.page_title
            entry["object"] = page
        if entry["title"] in self.current_pages:
            self.current_pages[entry["title"]]["object"] = entry["object"]
        else:
            self.current_pages[entry["title"]] = entry
        self.update_results()


    def update_results(self):
        """Update the whole table, adding in newly arrived page data"""
        self.current_html = conf.HtmlHeader
        ordered = sorted(self.current_pages.values(), key=lambda entry: entry["number"])
        for entry in ordered:
            page = entry["object"]
            if page:
                if page.categories_initialized and not entry["categories"]:
                    entry["categories"] = reduce(lambda str, cat: str + " | " + cat.page_title if str else cat.page_title, page.categories_initialized, "")
                if page.expanded and not entry["snippet"]:
                    entry["snippet"] = page.expanded[:300].replace("<", "&lt;") # @todo horrible, I know
            html_slice = conf.HtmlEntryTemplate % (entry["number"], entry["title"], entry["snippet"], entry["categories"])
            self.current_html += "\n\n" + html_slice
        self.current_html += "\n\n" + conf.HtmlFooter
        self.html.SetPage(self.current_html)
            


    def no_results(self):
        self.current_html = "<em>No results found</em>"
        self.html.SetPage(self.current_html)
        


class MessageHandler(threading.Thread):
    def __init__(self):
        threading.Thread.__init__(self)
        self.daemon = True # Daemon threads do not keep application running
        self.start()

    def run(self):
        self.isRunning = True
        while self.isRunning:
            message = messageQueue.get() # Gives a list, first item the message, second item the arguments
            if "log" == message[0]:
                trunced = message[1][0] if len(message[1][0]) < 130 else message[1][0][:130] + ".."
                mainWindow.log_message(trunced)
            elif "status" == message[0]:
                mainWindow.statusbar.SetStatusText(message[1][0])
            elif "page" == message[0]:
                mainWindow.add_result(*message[1])
            elif "no results" == message[0]:
                mainWindow.no_results()
            else:
                mainWindow.log_message("GUI received unknown message '%s' (%s)." % (message[0], message[1]))
