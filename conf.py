"""
Miscellaneous application configuration.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   02.04.2011
"""

Version = "0.1.14"

BackendPort = 6666

FrontendFile = "index.html"

LogFilename = "wikkr.log"

"""The MediaWiki URL to use."""
WikiUrl = "en.wikipedia.org"

"""Max length of line shown in GUI log."""
GuiMaxLogLineLength = 150

# @deprecated

"""Maximum number of results to parse."""
MaxResults = 10

"""HTML template for a single result entry. Placeholders: 1-title, 2-snippet, 3-first image tag, 4-categories."""
HtmlEntryTemplate = "<h1>TITLE: %s</h1><div>SNIPPET: %s<br /></div><p/><div>IMAGE: %s<br /></div><div><em>CATEGORIES: %s</em></div>"

"""wx.html tends to crash for complex HTML."""
EnableHtmlInSnippet = False