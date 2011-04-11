// Wikinity, a visual graph browser for Wikipedia.
// Copyright (C) 2011, Erki Suurjaak, Andre Karpistsenko.
// Wikinity has been published under the GNU Affero General Public License v3.
// See <http://www.gnu.org/licenses/agpl.html>.

// Functions for querying the Wikipedia directly with in-browser JSON
// requests, and doing wiki-specific actions.
//
// To be included together with wikinity.js.
//
// @author    Erki Suurjaak
// @created   03.04.2011
// @modified  11.04.2011

const WIKI_BASE_URL = "http://en.wikipedia.org";
// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const WIKI_API_URL = WIKI_BASE_URL + "/w/api.php?callback=?";
// All the other wikipedia namespaces besides the main one (0). Articles
// in the namespaces have the namespace name as prefix (e.g. WP:Logo).
// http://en.wikipedia.org/wiki/Wikipedia_namespaces
const OTHER_NAMESPACES = ["Wikipedia", "WP", "Project", "WT", "Project talk",
                          "Image", "File", "Image talk", "Portal", "User",
                          "MediaWiki", "Template", "Category", "Book", "Help"];
const MAX_IMG_WIDTH = 60;
const MAX_IMG_HEIGHT = 80;



/**
 * Searches for pages with the specified term. If one found, starts to retrieve
 * it, if multiple found, displays links.
 */
function search(term) {

  // First, query the page straight
  // @todo retain the data if one found, so to not make a superfluous query
  $.getJSON(WIKI_API_URL,
    {
      "action": "query",
      "redirects": "1",
      "format": "json",
      "titles": term
    },
    function(data) {
      var title = null;
      if (data.query && data.query.pages) {
          $.each(data.query.pages, function(id, page_data) {
            if (-1 != id) {
              title = page_data.title;
            }
            return false;
          });
      }
      if (title) {
        get_page(title, neighborhood_size);
      } else {
        $.getJSON(WIKI_API_URL,
          {
            "action": "opensearch",
            "format": "json",
            "limit": 20,
            "search": term
          },
          function(data) {
            if (data && data.length > 1 && data[1].length > 0) {
              if (data[1].length == 1 || data[1][0].toLowerCase() == term.toLowerCase()) {
                get_page(data[1][0], neighborhood_size);
              } else {
                $("#results").css("display", "block");
                $("#results_content").empty();
                $("<p />").text("Multiple matches for '" + term + "':").appendTo('#results_content');
                var list = $("<ul />").appendTo('#results_content');
                for (var i in data[1]) {
                  list.append($("<li />").append($("<a />").attr("href", WIKI_BASE_URL + "/wiki/" + data[1][i].replace(/ /g, "_")).text(data[1][i]).attr("title", data[1][i]).click(function() { get_page(($(this).attr("title")), neighborhood_size); $("#results").css("display", "none"); return false; })));
                }
              }
            } else {
              $("#results").css("display", "block");
              $("#results_content").empty();
              $("<p />").html("<br />No match for '" + term + "'.").appendTo('#results_content');
            }
          }
        );
      }
    }
  );
}


/**
 * Gets the page with the specified title. Skips if the page is already fully
 * retrieved.
 *
 * @return    true if a query was made, false otherwise
 */
function get_page(title, depth_to_follow, connected_page) {
  var result = true;
  if (!nodes[title] || !nodes[title].complete) {
    $.getJSON(WIKI_API_URL,
      {
        "action": "parse",
        "disablepp": "1",
        "redirects": "1",
        "section": "0",
        "format": "json",
        "page": title
      },
      function(data) {
          if (data.parse && data.parse.displaytitle) {

            if (data.parse.redirects && (nodes[data.parse.redirects[0].to] && nodes[data.parse.redirects[0].to].complete)) {
              // The true redirected page already exists here fully.
              remove_node(nodes[data.parse.redirects[0].from], true);
              return;
            }

            if (data.parse.displaytitle != title && nodes[title]) {
              // Page title is different in the article from the link: remove
              // the old node by this name, as its name can no longer be modified.
              remove_node(nodes[title], true);
            }
            var page = {title: $("<span />").html(data.parse.displaytitle).text(), snippet: (data.parse.text)["*"], images: []};
            for (var i in data.parse.images) {
              var accept = true;
              if (".svg" == data.parse.images[i].slice(-4)) { // SVG images are probably wiki icons
                accept = false;
              } else if ("Ambox_content.png" == data.parse.images[i]) {
                accept = false;
              }
              if (accept) {
                page.images.push(data.parse.images[i]);
              }
            }

            var node = add_node(page, connected_page);

            depth_to_follow = typeof(depth_to_follow) != 'undefined' ? depth_to_follow : 1;
            if (depth_to_follow) {
              node.links_queried = true;
              get_see_also(page.title, depth_to_follow);
            }

            if (page.images.length && images_enabled) {
              get_image(page.images[0], page.title);
            }

          } else if (nodes[title]) {
            // Already here, but has no data - missing wikipedia page, mark as such.
            nodes[title].links_queried = true;
            nodes[title].element.css({"color": "#AAA", "text-decoration": "line-through"}).find(".wiki").remove();
          }
      }
    ); 
  } else {
    result = false;
    if (connected_page) {
      connect_nodes(nodes[title], nodes[connected_page]);
    }
  }
  return result;
}


function get_image(image_title, article_title) {
  $.getJSON(WIKI_API_URL,
    {
      "action": "query",
      "prop": "imageinfo",
      "iiprop": "url|size",
      "iiurlwidth": MAX_IMG_WIDTH, // @todo remove magics
      "iiurlheight": MAX_IMG_HEIGHT,
      "redirects": "1",
      "format": "json",
      "titles": "File:" + image_title
    },
    function(data) {
      if (nodes[article_title]) { // If image was retrieved later than article closed
        $.each(data.query.pages, function(page_id, page_data) {
          var image_data = page_data.imageinfo[0];
          if (image_data.width > MAX_IMG_WIDTH || image_data.height > MAX_IMG_HEIGHT) {
            var url = image_data.thumburl;
          } else {
            var url = image_data.url;
          }
          var img = $("<img />").attr({"src": url, "title": image_title}).prependTo(nodes[article_title].element.find("div.content"));
          if (image_data.width > image_data.height && image_data.width > MAX_IMG_WIDTH) {
              ratio = MAX_IMG_WIDTH / data.image_data;
              img.css({"width": MAX_IMG_WIDTH, "height": data.image_data * ratio});
          } else if (image_data.height > image_data.width && image_data.height > MAX_IMG_HEIGHT) {
              ratio = 80 / image_data.height;
              img.css({"width": image_data.width * ratio, "height": MAX_IMG_HEIGHT});
          }
          return false; // break foreach
        });
      }
    }
  );
}


function get_see_also(title, depth_to_follow) {
  depth_to_follow--;
  $.getJSON(WIKI_API_URL,
    {
      "action": "parse",
      "prop": "sections",
      "disablepp": "1",
      "redirects": "1",
      "format": "json",
      "page": title
    },
    function(data) {
      var section_index = null;
      if (data.parse) {
        $.each(data.parse.sections, function(i, section_data) { 
          if ("See also" == section_data.line) {
            section_index = section_data.index;
            return false; // break foreach
          }
        });
      }
      if (section_index) {
        $.getJSON(WIKI_API_URL,
          {
            "action": "parse",
            "prop": "links",
            "disablepp": "1",
            "redirects": "1",
            "format": "json",
            "page": title,
            "section": section_index
          },
          function(data) {
            var count = 0;
            $.each(data.parse.links, function(i, link_data) { 
              if (count >= limit) {
                return false; // break foreach
              }
              var name = link_data["*"];
              var other_namespace = false;
              for (var index in OTHER_NAMESPACES) {
                var prefix = OTHER_NAMESPACES[index] + ":";
                if (prefix == name.slice(0, prefix.length)) {
                  other_namespace = true;
                  break;
                }
              }
              if (!other_namespace) {
                add_node({"title": name}, title);

                if (get_page(name, depth_to_follow, title))
                  count++;
              }
            });
          }
        );
      } else if (nodes[title].links) {
        // No "See also" links, use links from the first section
        var count = 0;
        for (var link_title in nodes[title].links) {
          if (count >= limit) {
            break;
          }
          if (get_page(link_title, depth_to_follow, title))
            count++;
        }
      } else {
        // No "See also" links and no links in the first section, get categories at least
        get_categories(title, depth_to_follow+1);
      }
    }
  );
}


function get_categories(title, depth_to_follow) {
  depth_to_follow--;
  $.getJSON(WIKI_API_URL,
    {
      "action": "query",
      "prop": "categories",
      "clshow": "!hidden",
      "cllimit": limit,
      "redirects": "1",
      "format": "json",
      "titles": title
    },
    function(data) {
      $.each(data.query.pages, function(page_id, page_data) { 
        var count = 0;
        $.each(page_data.categories, function(i, category_data) {
          if (count >= limit) {
            return false; // break foreach
          }
          add_node({"title": category_data.title}, title);

          if (get_page(category_data.title, depth_to_follow, title))
            count++;
        });
        return false; // break foreach
      });
    }
  );
}
