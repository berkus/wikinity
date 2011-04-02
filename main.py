"""
Main program entrance. Fires up the GUI and other needed threads.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   03.04.2011
"""
import gui
import server


def main():
    server.init()
    gui.init()


if __name__ == "__main__":
    main()
