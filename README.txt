Wikinity
--------

Wikinity is an experiment in a new way of browsing Wikipedia. The final aim is
to create a solution that allows for easy navigation of web content.

The initial solution visualizes a wiki article as a graph node with links to
other articles. The choice of links is relatively arbitrary at the moment and
depends heavily on the article content.

With Wikinity you can navigate the articles graph by clicking on nodes or links
within the text of the nodes. It is also possible to collapse, close and reopen
nodes.

It's possible to share wikinity links that will autoload a specific search with
detailed parameters:

http://wikinity.cc/#limit=1&depth=5&term=Wikipedia


Browsers
========
Wikinity has not been developed to be browser independent, the idea was to see
what can be done in modern browsers.

Currently supports:
* Firefox 3.6
* Chrome 10
* Safari 5
Has glitches in Opera and does not work in IE at all.


Technical Information
---------------------
All content is coming from wikipedia via JSON (http://en.wikipedia.org/w/api.php).
Uses Springy (https://github.com/dhotson/springy) for the graph layout and
jQuery (http://jquery.com/).

Currently, connections for the automatic node expansion are obtained first from
the article's "See also" section, then from the links in its first section, and
if still nothing found, from the article categories.

The page with included libraries is totally stand-alone and can used from any
local directory as well.


Further Improvements
--------------------
There is a mountain of further improvement to do, to make this into a truly
usable application, as everything at the moment is very ad hoc. A much better
selection of links for autoexpand, an improved interface, more functionality,
more content parsing from wikipedia (seeing more links, more sections,
highlighted external links etc).

For a list of concrete improvement ideas, please see GitHub.

At some point, developing zooming in and out on the entire article graph would
give awesome possibilities for exploring Wikipedia. Especially with a 3D model.
In addition, the link selection algorithm might benefit from using text mining,
and network+clickstream analysis.


Data
----
Anonymous clickstream is collected from the website to understand the ways the
application gets used, and the parts to concentrate on improving. Clickstream
can be disabled from UI settings.


Acknowledgements
----------------
 * Special kudos go to Silver, Allan, Ando, Taavi for their ideas on navigating
   the invisible.
 * Katy Börner's book "Atlas of Science" triggered a lot of ideas, some of which
   are implemented in Wikinity.


Copyright (C) 2011 by 
Erki Suurjaak <erki@lap.ee>
Andre Karpistsenko <andre@lap.ee>
Distributed with AGPLv3 license.
