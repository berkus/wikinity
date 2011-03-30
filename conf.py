"""
Miscellaneous application configuration.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   30.03.2011
"""


LogFilename = "wikkr.log"

"""The MediaWiki URL to use."""
WikiUrl = "en.wikipedia.org"

"""Maximum number of results to parse."""
MaxResults = 10

"""HTML template for a single result entry. Placeholders: 1-number, 2-title, 3-snippet."""
HtmlEntryTemplate = "<table><tr><td valign='top'>%s</td><td width='150' valign='top'><b>%s</b></td><td>%s</td></tr></table>"