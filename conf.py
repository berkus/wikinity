"""
Miscellaneous application configuration.

@author     Erki Suurjaak <erki@lap.ee>
@created    29.03.2011
@modified   31.03.2011
"""


LogFilename = "wikkr.log"

"""The MediaWiki URL to use."""
WikiUrl = "en.wikipedia.org"

"""Maximum number of results to parse."""
MaxResults = 10

HtmlHeader = "<table><tr><td width='20'><b>#</b></td><td width='150'><b>Title</b></td><td width='400'><b>Snippet</b></td><td width='150'><b>Categories</b></td>"
HtmlFooter = "</table>"

"""
HTML template for a single result entry. Multiple entries will be wrapped between header and footer.
Placeholders: 1-number, 2-title, 3-snippet, 4-categories.
"""
HtmlEntryTemplate = "<tr><td width='20' valign='top'>%s.</td><td width='150' valign='top'><u>%s</u></td><td width='400' valign='top'>%s</td><td width='150' valign='top'><em>%s</em></td></tr>"
