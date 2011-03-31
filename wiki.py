"""
Small quick dirty module for querying wiki.

@author     Erki Suurjaak <erki@lap.ee>
@created    31.03.2011
@modified   31.03.2011
"""
import urllib2
import json

import common
import conf


BASE_URL = "http://en.wikipedia.org/w/api.php?"
DEBUG = 0

opener = urllib2.build_opener()
opener.addheaders = [("User-agent", "Wikkr/%s" % conf.WikiUrl)]



def get_page(page_title):
    """
    Returns the page with the specified title, as a dict with pageid, title
    (properly capitalized), snippet, and images. Or an empty dict if not found.
    """
    result = {}

    # Simply make 
    query = "action=parse&section=0&page=%s" % urllib2.quote(page_title.encode("utf-8"))
    data = query_json(query)
    if data:
        result["snippet"] = data["parse"]["text"].values().pop()
        result["title"] = data["parse"]["displaytitle"]
        result["images"] = []
        for image in data["parse"]["images"]:
            result["images"].append("File:%s" % image)

    return result


def get_page_categories(page_title):
    """
    Returns the categories for the page, as a list of titles.
    """
    result = []
    query = "action=query&prop=categories&clshow=!hidden&cllimit=100&titles=%s" % urllib2.quote(page_title)
    data = query_json(query)
    if data:
        for pageid, props in data["query"]["pages"].items():
            if pageid is not "-1":
                for category in props["categories"]:
                    result.append(category["title"])

    return result


def get_image(image_title):
    """
    Returns data for the specified image, with pageid, title, url,
    thumburl, width, height, thumbwidth, thumbheight. Or an empty dict if not
    found.
    """
    result = {}
    query = "action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=200&iiurlheight=200&titles=%s" % urllib2.quote(image_title)
    data = query_json(query)
    if data:
        for pageid, props in data["query"]["pages"].items():
            if pageid is not "-1" and "imageinfo" in props:
                result = props["imageinfo"][0]
                result["pageid"] = pageid
                result["title"] = props["title"]
                break

    return result



def get_page_first_image(page_title):
    """
    @todo this seems unnecessary, remove - getting section 0 already gives the real
    images on the page.

    Returns the first image on the page as a dict, with pageid, title, url,
    thumburl, width, height, thumbwidth, thumbheight. Or an empty dict if not
    found.
    """
    result = {}

    # First, query all images
    query = "action=query&prop=images&imlimit=100&titles=%s" % urllib2.quote(page_title.encode("utf-8"))
    data = query_json(query)

    # Then, get details on one image
    if data:
        for pageid, props in data["query"]["pages"].items():
            if pageid is not "-1" and "images" in props:
                for image in props["images"]:
                    query = "action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=200&iiurlheight=200&titles=%s" % urllib2.quote(image["title"])
                    image_data = query_json(query)
                    if image_data:
                        for image_pageid, image_props in image_data["query"]["pages"].items():
                            if "-1" != image_pageid and "imageinfo" in image_props:
                                result = image_props["imageinfo"][0]
                                result["pageid"] = image_pageid
                                result["title"] = image_props["title"]
                                break
                break

    return result


def query_json(query_string):
    """
    Makes a query to wikipedia with the specified query string
    ("action=query&prop=.."), and returns the parsed JSON as dict.
    If an error resulted, returns an empty dict.
    """
    result = {}
    url = "%sformat=json&%s" % (BASE_URL, query_string)
    if DEBUG:
        print url
    page = opener.open(url).read()
    data = json.loads(page)
    if DEBUG:
        print data
    if "error" not in data:
        result = data
    return result



if "__main__" == __name__:
    page = get_page("fanta")
    print "----------------------------------------------------------------\nPAGE: "
    print page
    print "----------------------------------------------------------------\nIMAGE: "
    for i in page["images"]:
        image = get_image(i)
        print image
    print "----------------------------------------------------------------\nCATEGORIES: "
    categories = get_page_categories("fanta")
    print categories