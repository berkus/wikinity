"""
Main program entrance. Fires up the GUI and other needed threads.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
"""
import sys

import gui
import search


def main():
    search.init()
    gui.init()


if __name__ == "__main__":
    main()
