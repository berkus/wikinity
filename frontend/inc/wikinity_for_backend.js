// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const SERVER_URL = "http://localhost:8888/?callback=?";
const MAX_IMG_WIDTH = 60;
const MAX_IMG_HEIGHT = 80;
const DEFAULT_LINKS_LIMIT = 5;

var sys = null; // Arbor ParticleSystem instance
var gfx = null; // Arbor Graphics instance
var nodes = {}; // {title: jquery_node, }
var focused_node = null; // Currently focused node

var limit = DEFAULT_LINKS_LIMIT;
var images_enabled = true;
var autoclear_results = true;


function add_node(data) {
  var node = nodes[data.title];
  var heading = null;
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
    heading = $("<h1 />").html(data.title).appendTo(node);
    // Wrap snippet in <span> as it can contain a flat list of HTML
    snippet = $($("<span />").html(data.snippet));
    // Parse out tables, those tend to not have text content
    snippet.find("table").empty().remove(); // Emptying first should be faster
    snippet.find("div").remove();
    snippet.find("img").remove();
    $("<table />").append($("<tr />").append($("<td />").append($(snippet.html().substr(0, 500))))).appendTo(node);
    click_function = function() { if (!node.links_queried) node.links_queried = true; get_see_also(data.title, 1); };
    node.is_complete = true;
  } else {
    click_function = function() { if (!node.links_queried) node.links_queried = true; get_page(data.title, 1); }
  }
  heading.click(click_function);
  heading.hover(function() { if (!node.links_queried) heading.css('cursor','pointer'); }, function() { heading.css('cursor','auto'); });
  return node;
}


function remove_node(node) {
  sys.pruneNode(node.json.title);
  node.remove();
  delete nodes.title;
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


function update_settings() {
  limit = parseInt($("#setting_link_limit").val());
  if (NaN == limit) {
    limit = DEFAULT_LINKS_LIMIT;
  }
  images_enabled = $("#setting_images_enabled").is(":checked");
  autoclear_results = $("#setting_autoclear_results").is(":checked");
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
        get_page(term, 1);
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
