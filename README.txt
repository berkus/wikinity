Wikinity
--------

Wikinity is an experiment in new way of browsing Wikipedia. The final aim is to
create a solution that allows for easy navigation of web content.

The initial solution visualizes a wiki article as a graph node with links to
other articles. The choice of links depends on the content of articles, e.g.
links in "See also", "Categories" and first paragraphs are chosen.

With Wikinity you can navigate the articles graph by clicking on nodes or links
within the text of the nodes. It is also possible to collapse, close and reopen
nodes.


Data
----
Anonymous clickstream is collected from the website to understand the ways the
application gets used. The data is used only for improvements and will not be
sold. It is possible for anyone to disable collection from UI settings.


Further Improvements
--------------------
Immediate improvements will focus on incremental improvements of existing
navigation solution. From usability point of view a cruicial part is the layout
engine that currently makes it hard to conduct actions with nodes while the graph
is stabilizing. For a list of concrete improvement ideas, please see GitHub.

Long-term, implementing zooming on the entire article graph should give awesome
possibilities for exploring Wikipedia. Especially with 3D. Additionally the link
selection algorithm could benefit from text mining, network and clickstream analysis.


Acknowledgements
----------------
 * Special kudos go to Silver, Allan, Ando, Taavi for their ideas on navigating
   the invisible.
 * The implementation is based on jQuery and Springy JavaScript libraries.
 * Katy Börner's book "Atlas of Science" triggered a lot of ideas, some of which
   are implemented in Wikinity.


Copyright (C) 2011 by 
Erki Suurjaak <erki@lap.ee>
Andre Karpistsenko <andre@lap.ee>
Distributed with AGPLv3 license.
All rights reserved, see LICENSE for details.

