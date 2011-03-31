"""
Miscellaneous application configuration.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   01.04.2011
"""

Version = "0.1.12"

LogFilename = "wikkr.log"

"""The MediaWiki URL to use."""
WikiUrl = "en.wikipedia.org"

"""Maximum number of results to parse."""
MaxResults = 10

"""HTML template for a single result entry. Placeholders: 1-title, 2-snippet, 3-first image tag, 4-categories."""
HtmlEntryTemplate = "<h1>TITLE: %s</h1><div>SNIPPET: %s<br /></div><p/><div>IMAGE: %s'<br /></div><div><em>CATEGORIES: %s</em></div>"

"""wx.html tends to crash for complex HTML."""
EnableHtmlInSnippet = False