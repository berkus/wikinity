// All page logic. Expects the jQuery and Arbor scripts to be included.
//
// wikinity_backend or wikinity_direct must also be included.
//
// @author    Erki Suurjaak
// @created   02.04.2011
// @modified  03.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const WIKI_API_URL = "http://en.wikipedia.org/w/api.php?callback=?";
const MAX_IMG_WIDTH = 60;
const MAX_IMG_HEIGHT = 80;
const DEFAULT_LINKS_LIMIT = 5;
const DEFAULT_NEIGHBORHOOD_SIZE = 1;

var sys = null; // Arbor ParticleSystem instance
var gfx = null; // Arbor Graphics instance
var nodes = {}; // {title: jquery_node, }
var focused_node = null; // Currently focused node

var limit = DEFAULT_LINKS_LIMIT;
var images_enabled = true;
var autoclear_results = true;
var neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;


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


function add_node(data) {
  var node = nodes[data.title];
  var heading = null;
  var heading_click_function = null;
  if (!node) {
    node = $("<div />");
    node.json = data;
    node.links_queried = false;
    node.is_complete = false;
    $("<a />").attr({"class": "wiki", "title": "open wiki", "href": "http://en.wikipedia.org/wiki/"+data.title}).text("w").appendTo(node);
    $("<a />").attr({"class": "close", "title": "close"}).text("x").click(function() { remove_node(node); return false; }).appendTo(node);
    if (data.snippet) {
      node.css("background", "#DFF")
    } else {
      heading = $("<h2 />").html(data.title).appendTo(node);
    }
    node.appendTo("#results");
    sys.addNode(data.title, {"title": data.title, "element": node});
    nodes[data.title] = node;
    node.hover(function() { focused_node = node; }, function() { focused_node = null; });
  } else {
    if (!node.is_complete) {
      node.json = data;
      node.css("background", "#EFF");
      node.children().not("a").remove(); // New info arrived, empty all except close/wiki links
    }
  }
  if (data.snippet) {
    update_settings();
    heading = $("<h1 />").html(data.title).appendTo(node);
    // Wrap snippet in <span> as it can contain a flat list of HTML
    snippet = $($("<span />").html(data.snippet));
    // Parse out tables, those tend to not have text content
    snippet.find("table").empty().remove(); // Emptying first should be faster
    snippet.find("div").remove();
    snippet.find("strong.error").remove(); // Wiki error messages
    snippet.find("span.IPA").remove(); // phonetic alphabet media content
    snippet.find("img").remove();
    shorter_snippet = $("<table />").append($("<tr />").append($("<td />").append($(snippet.html().substr(0, 1000))))).appendTo(node);
    shorter_snippet.find("a").each(function(index, a) {
      var href = ($(this)).attr("href");
      if ("#" == href[0]) {
        // On-page link, remove. @todo leave link contents
        $(this).remove();
      } else if ("/wiki/" == href.slice(0, 6)) {
        ($(this)).attr("href", "http://en.wikipedia.org" + href);
        // Have the link make a search
        ($(this)).click(function() { get_page(decodeURIComponent(href.slice(6)), neighborhood_size, data.title); return false; });
      }
    });
    heading_click_function = function() { if (!node.links_queried) node.links_queried = true; get_see_also(data.title, neighborhood_size); };

    node.is_complete = true;
  } else {
    heading_click_function = function() { if (!node.links_queried) node.links_queried = true; get_page(data.title, neighborhood_size); }
  }
  heading.click(heading_click_function);
  heading.hover(function() { if (!node.links_queried) heading.css('cursor','pointer'); }, function() { heading.css('cursor','auto'); });
  return node;
}


function remove_node(node) {
  delete nodes[node.json.title];
  sys.pruneNode(node.json.title);
  node.remove();
}


function clear_results() {
  $("#results").empty();
  for (var title in nodes) {
    nodes[title].remove();
  }
  nodes = {};
  if (sys) sys.prune(function(node, from, to) {
    // dummy nodes don't have the element member
    if (node.data.element) return true;
  });
  if (gfx) gfx.clear();
}


function open_settings() {
  $("#settings").slideToggle("fast");
}


function update_settings() {
  limit = parseInt($("#setting_link_limit").val());
  if (NaN == limit) {
    limit = DEFAULT_LINKS_LIMIT;
  }
  images_enabled = $("#setting_images_enabled").is(":checked");
  autoclear_results = $("#setting_autoclear_results").is(":checked");
  neighborhood_size = parseInt($("#setting_neighborhood_size").val());
  if (NaN == neighborhood_size) {
    neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;
  }
}


var Renderer = function(elt){
  var dom = $(elt);
  var canvas = dom.get(0);
  var ctx = canvas.getContext("2d");
  gfx = arbor.Graphics(canvas);

  var that = {
    init:function(pSystem){
      sys = pSystem;
      sys.screen({size:{width:dom.width(), height:dom.height()},
                  padding:[36,60,36,60]});

    },
    redraw:function(){
      gfx.clear()
      sys.eachEdge(function(edge, pt1, pt2){
        // edge: {source:Node, target:Node, length:#, data:{}}
        // pt1:  {x:#, y:#}  source position in screen coords
        // pt2:  {x:#, y:#}  target position in screen coords
        // draw a line from pt1 to pt2
        if (edge.source.data.element && edge.target.data.element && edge.source != edge.target) { // To skip dummy elements
          ctx.strokeStyle = "rgba(0,0,0, .333)";
          ctx.lineWidth = (edge.source.data.element == focused_node || edge.target.data.element == focused_node) ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      })
      sys.eachNode(function(node, pt){
        if (node.data.element) {
          node.data.element.css("display", "block"); // Initially was set to none
          var elem = node.data.element.get(0);
          var x = canvas.offsetLeft + pt.x - elem.offsetWidth / 2;
          var y = canvas.offsetTop + pt.y - elem.offsetHeight / 2;
          //@todo needs some tweaking
          //x = Math.max(0, Math.min(x, canvas.offsetWidth));
          //y = Math.max(0, Math.min(y, canvas.offsetHeight));
          node.data.element.css({top: y, left: x});
        }
      })
    },
  }
  
  return that;
}

 
$(document).ready(function(){

  sys = arbor.ParticleSystem()
  // @todo twiddle with these
  //sys.parameters({friction:0.5, stiffness:100, repulsion:1000, gravity: true, fps: 60, dt: 0.08, precision: 1.0});
  sys.parameters({stiffness:900, repulsion:1000, gravity: true, fps: 60, dt: 0.005});
  sys.renderer = Renderer("#canvas")

  // Perhaps I'm an ass, but it seems that Arbor cannot handle just one node in the
  // graph. At all. If there is first only one element, and another is added later,
  // Arbor stops updating. <shrug> So a temporary workaround: use invisible dummies.
  sys.addNode("dummy1", {"title": "dummy1", "fixed": true}); // Reference says on fixed=true the node is
  sys.addNode("dummy2", {"title": "dummy2", "fixed": true}); // unaffected by other nodes, but doesn't seem to work.
  sys.addEdge("dummy1", "dummy2");


  $("#search_form").submit(
    function(){
      term = $.trim($("#search_term").val());
      if (term) { 
        update_settings();
        if (autoclear_results) clear_results();
        get_page(term, neighborhood_size);
      }
      return false;
    }
  );

  $("#setting_link_limit").val(DEFAULT_LINKS_LIMIT);

  $("#clear_button").click(clear_results);

  $("#settings_button").click(open_settings);

  $(window).load(function () { 
    $(':input:visible:enabled:first').focus(); 
  });

})
