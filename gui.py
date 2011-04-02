"""
Application GUI functionality.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   03.04.2011
"""
import Queue
import sys
import threading
import webbrowser
import wx
import wx.py

import common
import conf


application = None   # wx application
main_window = None    # MainWindow instance
message_queue = None  # Queue for messages to GUI


def message(msg, *args):
    """Registers a message with the GUI."""
    if message_queue:
        message_queue.put([msg, list(args)])



def init():
    """Starts up the GUI and runs until program exit."""
    global application, main_window, message_queue
    message_queue = Queue.Queue()
    messageHandler = MessageHandler()
    application = wx.App()
    main_window = MainWindow()
    main_window.console.run("self = gui.main_window")
    application.MainLoop()


class MainWindow(wx.Frame):
    """The main frame of the application."""
    title = "%s %s" % (conf.Name, conf.Version)


    def __init__(self):
        wx.Frame.__init__(self, parent=None, id=-1, title=self.title, size=(700, 700))

        self.current_pages = {}

        self.panel = wx.Panel(self, -1)

        self.browser_button = wx.Button(parent=self.panel, id=wx.ID_OK, label="Open frontend in browser")
        self.browser_button.Bind(wx.EVT_BUTTON, self.on_browser_button)

        self.notebook = wx.Notebook(self.panel, -1, style=wx.NB_TOP)

        self.create_log_page()
        self.create_console_page()

        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(self.browser_button, proportion=0, flag=wx.ALL, border=5)
        box.Add(item=self.notebook, proportion=1, flag=wx.EXPAND | wx.ALL)
        self.panel.SetSizer(box) 

        self.Bind(wx.EVT_CLOSE, self.on_exit)

        self.statusbar = self.CreateStatusBar()
        self.Centre()
        self.Show(True)


    def create_console_page(self):
        self.console_page = wx.Panel(self.notebook, -1)
        self.notebook.AddPage(self.console_page, 'Console')
        self.console = wx.py.shell.Shell(parent=self.console_page, id=-1, introText=wx.py.version.VERSION)
        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(self.console, proportion=1, flag=wx.EXPAND, border=5)
        self.console_page.SetSizer(box)


    def create_log_page(self):
        self.log_page = wx.Panel(self.notebook, -1)
        self.notebook.AddPage(self.log_page, 'Log')

        self.log = wx.TextCtrl(self.log_page, -1, style=wx.TE_MULTILINE)
        self.log.SetEditable(False)
        self.clear_log_button = wx.Button(parent=self.log_page, id=-1, label="Clear log")
        self.clear_log_button.Bind(event=wx.EVT_BUTTON, handler=lambda event: self.log.Clear())

        box = wx.BoxSizer(wx.VERTICAL)
        box.Add(self.log, proportion=1, flag=wx.ALL | wx.EXPAND, border=5)
        box.Add(self.clear_log_button, proportion=0)
        self.log_page.SetSizer(box)


    def on_exit(self, event):
        sys.exit()

    def on_browser_button(self, event):
        webbrowser.open(conf.FrontendFile)


    def log_message(self, message):
        self.log.AppendText(unicode(message) + "\n")


class MessageHandler(threading.Thread):
    def __init__(self):
        threading.Thread.__init__(self)
        self.daemon = True # Daemon threads do not keep application running
        self.start()

    def run(self):
        self.is_running = True
        while self.is_running:
            message = message_queue.get() # Gives a list, first item the message, second item the arguments
            if "log" == message[0]:
                trunced = message[1][0] if len(message[1][0]) < conf.GuiMaxLogLineLength else message[1][0][:conf.GuiMaxLogLineLength] + ".."
                main_window.log_message(trunced)
            elif "status" == message[0]:
                main_window.statusbar.SetStatusText(message[1][0])
            else:
                main_window.log_message("GUI received unknown message '%s' (%s)." % (message[0], message[1]))
