"""
Main program entrance. Fires up the GUI and other needed threads.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   01.04.2011
"""
import gui
import search
import server


def main():
    search.init()
    server.init()
    gui.init()


if __name__ == "__main__":
    main()
