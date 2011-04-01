"""
Small quick dirty module for querying wiki.

@author     Erki Suurjaak <erki@lap.ee>
@created    31.03.2011
@modified   02.04.2011
"""
import urllib2
import json
import re

import common
import conf


BASE_URL = "http://%s/w/api.php?" % conf.WikiUrl

opener = urllib2.build_opener()
opener.addheaders = [("User-agent", "Wikkr/%s" % conf.Version)]



def get_page(page_title):
    """
    Returns the page with the specified title, as a dict with pageid, title
    (properly capitalized), snippet, and images. Or an empty dict if not found.
    """
    result = {}

    # Simply make 
    query = "action=parse&disablepp=1&redirects=1&section=0&page=%s" % urllib2.quote(page_title)
    data = query_json(query)
    if data:
        snippet = data["parse"]["text"].values().pop()
        error_regex = re.compile("<strong[^>]+class=[\"']error[\"'].+</strong>", re.DOTALL)
        snippet = re.sub(error_regex, "", snippet)
        infotable_regex = re.compile("<table[^>]+class=[\"']infobox.+</table>", re.DOTALL)
        snippet = re.sub(infotable_regex, "", snippet)
        result["snippet"] = snippet
        result["title"] = data["parse"]["displaytitle"]
        result["images"] = []
        for image in data["parse"]["images"]:
            result["images"].append("File:%s" % image)

    return result


def get_categories(page_title):
    """
    Returns the categories for the page, as a list of titles.
    """
    result = []
    query = "action=query&prop=categories&clshow=!hidden&cllimit=100&redirects=1&titles=%s" % urllib2.quote(page_title)
    data = query_json(query)
    if data:
        for pageid, props in data["query"]["pages"].items():
            if pageid is not "-1":
                for category in props["categories"]:
                    result.append(category["title"])

    return result


def get_image(image_title):
    """
    Returns data for the specified image, with title and url, or an empty
    dict if not found. If the full size image is wider than 200px, returns a 
    thumbnail URL.
    """
    result = {}
    query = "action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=200&iiurlheight=200&redirects=1&titles=%s" % urllib2.quote(image_title)
    data = query_json(query)
    if data:
        for pageid, props in data["query"]["pages"].items():
            if pageid is not "-1" and "imageinfo" in props:
                if props["imageinfo"][0]["width"] > 200 or props["imageinfo"][0]["height"] > 200:
                    url = props["imageinfo"][0]["thumburl"]
                else:
                    url = props["imageinfo"][0]["url"]
                result = {"title": props["title"], "url": url}
                result["pageid"] = pageid
                result["title"] = props["title"]
                break

    return result



def query_json(query_string):
    """
    Makes a query to wikipedia with the specified query string
    ("action=query&prop=.."), and returns the parsed JSON as dict.
    If an error resulted, returns an empty dict.
    """
    result = {}
    url = "%s%s&format=json" % (BASE_URL, query_string)
    common.log(url)
    page = opener.open(url).read()
    data = json.loads(page)
    if "error" not in data:
        result = data
    return result
