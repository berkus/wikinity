// Functions for querying the Wikipedia directly, with in-browser JSON
// requests.
// To be included together with wikinity.js.
//
// @author    Erki Suurjaak
// @created   03.04.2011
// @modified  03.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const WIKI_API_URL = "http://en.wikipedia.org/w/api.php?callback=?";
var focused_node = null; // Currently focused node

var limit = DEFAULT_LINKS_LIMIT;
var images_enabled = true;
var autoclear_results = true;


function get_page(title, depth_to_follow, connected_page) {
  $.getJSON(WIKI_API_URL,
    {
      "action": "parse",
      "disablepp": "1",
      "redirects": "1",
      "section": "0",
      "format": "json",
      "page": title,
    },
    function(data) {
        if (data.parse && data.parse.displaytitle) {
          if (data.parse.displaytitle != title && nodes[title]) {
            // Page title is different in the article from the link: remove
            // the old node by this name, as its name can no longer be modified.
            remove_node(nodes[title]);
          }
          var page = {title: data.parse.displaytitle, snippet: (data.parse.text)["*"], images: []};
          for (var i in data.parse.images) {
            if (".svg" != data.parse.images[i].slice(-4)) {
              // SVG images are probably wiki icons
              page.images.push(data.parse.images[i]);
            }
          }

          var node = add_node(page);
          if (page.title != title && connected_page) {
            sys.addEdge(page.title, connected_page);
          }

          update_settings();
          depth_to_follow = typeof(depth_to_follow) != 'undefined' ? depth_to_follow : 1;
          if (depth_to_follow) {
            node.links_queried = true;
            get_see_also(page.title, depth_to_follow)
          }

          if (page.images.length && images_enabled) {
            get_image(page.images[0], page.title)
          }

        } else if (nodes[title]) {
          // Missing wikipedia page: mark as such.
          nodes[title].links_queried = true;
          nodes[title].css({"color": "#AAA", "text-decoration": "line-through"}).find(".wiki").remove();
        } else {
          $("<p />").text("No match for '" + title + "'.").appendTo('#results');
        }
    }
  );
}


function get_image(image_title, article_title) {
  $.getJSON(WIKI_API_URL,
    {
      "action": "query",
      "prop": "imageinfo",
      "iiprop": "url|size",
      "iiurlwidth": 200, // @todo remove magics
      "iiurlheight": 200,
      "redirects": "1",
      "format": "json",
      "titles": "File:" + image_title,
    },
    function(data) {
      $.each(data.query.pages, function(page_id, page_data) {
        var image_data = page_data.imageinfo[0];
        if (image_data.width > 200 || image_data.height > 200) {
          var url = image_data.thumburl;
        } else {
          var url = image_data.url;
        }
        img = $("<img />").attr("src", url).appendTo(nodes[article_title]);
        if (image_data.width > image_data.height && image_data.width > MAX_IMG_WIDTH) {
            ratio = MAX_IMG_WIDTH / data.image_data;
            img.css({"width": MAX_IMG_WIDTH, "height": data.image_data * ratio});
        } else if (image_data.height > image_data.width && image_data.height > MAX_IMG_HEIGHT) {
            ratio = 80 / image_data.height;
            img.css({"width": image_data.width * ratio, "height": MAX_IMG_HEIGHT});
        }
        img.appendTo($("<td />").appendTo(nodes[article_title].find("tr")));
        return false; // break foreach
      });
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
      "page": title,
    },
    function(data) {
      var section_index = null;
      $.each(data.parse.sections, function(i, section_data) { 
        if ("See also" == section_data.line) {
          section_index = section_data.index;
          return false; // break foreach
        }
      });
      if (section_index) {
        $.getJSON(WIKI_API_URL,
          {
            "action": "parse",
            "prop": "links",
            "disablepp": "1",
            "redirects": "1",
            "format": "json",
            "page": title,
            "section": section_index,
          },
          function(data) {
            update_settings();
            $.each(data.parse.links, function(i, link_data) { 
              if (i >= limit) {
                return false; // break foreach
              }
              add_node({"title": link_data["*"]});
              sys.addEdge(title, link_data["*"])

              get_page(link_data["*"], depth_to_follow, title);
            });
          }
        );
      } else {
        // No "see also" links, get categories at least
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
      "titles": title,
    },
    function(data) {
      update_settings();
      $.each(data.query.pages, function(page_id, page_data) { 
        $.each(page_data.categories, function(i, category_data) {
          if (i >= limit) {
            return false; // break foreach
          }
          add_node({"title": category_data.title});
          sys.addEdge(title, category_data.title)

          get_page(category_data.title, depth_to_follow, title);
        });
        return false; // break foreach
      });
    }
  );
}
