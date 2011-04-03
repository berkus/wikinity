"""
Miscellaneous application configuration.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   03.04.2011
"""

Version = "0.1.18"

Name = "Wikinity"

BackendPort = 8888

FrontendFile = "index.html"

LogFilename = "wikkr.log"

"""The MediaWiki URL to use."""
WikiUrl = "en.wikipedia.org"

"""Max length of line shown in GUI log."""
GuiMaxLogLineLength = 500

"""Maximum image dimensions - thumbnail will be used if original is larger."""
MaxImageWidth = 2500
MaxImageHeight = 2500
ThumbnailWidth = 200
ThumbnailHeight = 200