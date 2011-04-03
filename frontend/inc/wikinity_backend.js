// Functions for querying the Wikipedia through a custom backend.
// To be included together with wikinity.js.
//
// @author    Erki Suurjaak
// @created   03.04.2011
// @modified  03.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const SERVER_URL = "http://localhost:8888/?callback=?";


function get_page(title, depth_to_follow, connected_page) {
  $.getJSON(SERVER_URL,
    {
      "action": "get_page",
      "param": title,
    },
    function(data) {
      if (data.title) {
        update_settings();
        if (data.title != title && nodes[title]) {
          // Page title is different in the article from the link: remove
          // the old node by this name, as its name can no longer be modified.
          remove_node(nodes[title]);
        }
        var node = add_node(data);
        if (data.title != title && connected_page) {
          sys.addEdge(data.title, connected_page);
        }

        depth_to_follow = typeof(depth_to_follow) != 'undefined' ? depth_to_follow : 1;
        if (depth_to_follow) {
          node.links_queried = true;
          get_see_also(data.title, depth_to_follow)
        }

        if (data.images.length && images_enabled) {
          get_image(data.images[0], data.title)
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
  $.getJSON(SERVER_URL,
    {
      "action": "get_image",
      "param": image_title,
    },
    function(data) {
      img = $("<img />").attr("src", data.url).appendTo(nodes[article_title]);
      if (data.width > data.height && data.width > MAX_IMG_WIDTH) {
          ratio = MAX_IMG_WIDTH / data.width;
          img.css({"width": MAX_IMG_WIDTH, "height": data.height * ratio});
      } else if (data.height > data.width && data.height > MAX_IMG_HEIGHT) {
          ratio = 80 / data.height;
          img.css({"width": data.width * ratio, "height": MAX_IMG_HEIGHT});
      }
      img.appendTo($("<td />").appendTo(nodes[article_title].find("tr")));
    }
   );
}


function get_categories(title, depth_to_follow) {
  depth_to_follow--;
  $.getJSON(SERVER_URL,
    {
      "action": "get_categories",
      "param": title,
    },
    function(data) {
      update_settings();
      $.each(data, function(i, page_title) { 
        if (i >= limit) {
          return;
        }
        add_node({"title": page_title});
        sys.addEdge(title, page_title)

        get_page(page_title, depth_to_follow, title);
      });
    }
   );
}


function get_see_also(title, depth_to_follow) {
  depth_to_follow--;
  $.getJSON(SERVER_URL,
    {
      "action": "get_see_also",
      "param": title,
    },
    function(data) {
        var no_data = true;
        update_settings();
        $.each(data, function(i, page_title) { 
          if (i >= limit) {
            return;
          }
          no_data = false;
          add_node({"title": page_title});
          sys.addEdge(title, page_title)

          get_page(page_title, depth_to_follow, title);
        });
      if (no_data) {
        // No "see also" links, get categories at least
        get_categories(title, depth_to_follow+1);
      }
    }
   );
}
