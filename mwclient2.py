"""
Extends mwclient seamlessly with additional functionality, like performing
opensearch, and getting page components conveniently.

Pages retrieved here have two new members:
- categories_initialized, for holding the retrieved categories
- expanded, for holding the retrieved expanded text

@author      Erki Suurjaak <erki@lap.ee>
@created     30.03.2011
"""
import types

import mwclient
import mwclient.client as client
import mwclient.listing as listing
import mwclient.page as page
from mwclient.errors import *


class Site(client.Site):
    def __init__(self, *args, **kwargs):
        client.Site.__init__(self, *args, **kwargs)
        self.Pages.get = types.MethodType(_get_page2, self.Pages, type(listing.PageList))


    def opensearch(self, search, namespace = '0', limit = 15):
        """
        Returns the results of an opensearch ([limit] pages with names matching
        the search string), as a string list.
        """
        kwargs = dict(listing.List.generate_kwargs('', search=search, namespace=namespace, limit=limit))
        # opensearch returns an array with two elements, 1-search word, 2-search results array
        # http://en.wikipedia.org/w/api.php?action=opensearch&search=Fanta&format=jsonfm&limit=22
        data = self.raw_api('opensearch', **kwargs)
        return data[1]



def _get_page2(self, name, info = ()):
    """Wrapper for PageList.__getitem__, to return augmented Page objects."""
    item = type(self).get(self, name, info)
    if type(item) is page.Page:
        item.categories_initialized = None
        item.expanded = None

    return item


if "__main__" == __name__:
    term = "Biblio"
    site = Site(host="en.wikipedia.org")
    pages = site.opensearch(term, limit=100)
    results = 0
    print pages
    for i in pages:
        results += 1
        print (u"%d. result for '%s': %s." % (results, term, i)).encode("utf-8")
        p = site.Pages[i]
        print p.foobar
        if results >= 10:
            break
