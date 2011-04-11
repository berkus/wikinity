// Wikinity, a visual graph browser for Wikipedia.
// Copyright (C) 2011, Erki Suurjaak, Andrï¿½ Karpiï¿½tï¿½enko.
// Wikinity has been published under the GNU Affero General Public License v3.
// See <http://www.gnu.org/licenses/agpl.html>.


// All page logic. Expects the jQuery and Springy scripts to be included.
//
// wikinity_backend or wikinity_wiki must also be included.
//
// To avoid confusion between the jQuery and Springy and Wikinity nodes:
// - node is a Wikinity node
// - element is a jQuery node
// - vertice is an Springy node
//
// @author    Erki Suurjaak
// @created   02.04.2011
// @modified  11.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const DEFAULT_LINKS_LIMIT = 5;
const DEFAULT_NEIGHBORHOOD_SIZE = 1;
const RESIZE_STEP_WIDTH = 10;
const RESIZE_STEP_HEIGHT = 20;
const LOG_URL = "http://erki.lap.ee/wikinity/log.php";

var nodes = {};            // {title: node object }
var graph = null;          // Springy Graph instance
var renderer = null;       // Springy Renderer instance
var canvas = null;         // Canvas instance
var canvas_dom = null;     // Canvas DOM instance
var ctx = null;            // Canvas 2D context instance
var layout = null;         // Springy ForceDirected instance
var focused_node = null;   // Currently focused node
var deadpile = [];         // Nodes closed
var dragged_point = null;  // Springy Point of the dragged node

// For cached lookups, seems faster
var canvasbox_left = null; // $("#canvasbox").position().left;
var canvasbox_right = null; // $("#canvasbox").position().left + $("#canvasbox").width();
var canvasbox_top = null; // $("#canvasbox").position().top;
var canvasbox_bottom = null; // $("#canvasbox").position().top + $("#canvasbox").height();

var limit = DEFAULT_LINKS_LIMIT;
var images_enabled = true;
var autoclear_results = true;
var neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;
var autohide_contents = false;
var autoclose_startdepth = true;
var logging_enabled = true;

var session_id = new Date().getTime(); // For usage statistics @todo use


/**
 * Creates a new graph node and adds it to screen. If a node by this title
 * already exists, updates its contents.
 *
 * @param   data             data object, with title, snippet etc
 * @param   referring_title  title of the node from where the add originates, if any
 * @return                   the node object
 */
function add_node(data, referring_title) {
  var node = nodes[data.title];
  if (!node) {
    node = {links_queried: false, complete: false, autocollapsed: autohide_contents, usercollapsed: false, collapsed: autohide_contents };
    node.id = new Date().getTime();
    node.data = data;
    node.title = data.title;
    node.element = create_element(node, !referring_title);
    node.connections = [];
    nodes[node.title] = node;
    if (data.snippet) {
      node.complete = true;
    }
    node.vertice = graph.newNode(node);
    if (referring_title) {
/*
      if (autoclose_startdepth) {
        autoclose_nodes(nodes[referring_title], autoclose_startdepth, [node]);
      }
*/
      connect_nodes(node, nodes[referring_title]);
    }
    renderer.start();
  } else if (!node.complete) {
    update_graph_element(node, data);
    node.data = data;
    node.complete = true;
  }
  return node;
}


/**
 * Autocloses nodes that are at or farther than cutoff_distance away
 * from startnode.
 *
 * @param   avoidnodes  nodes to avoid when traversing the neighborhood
 */
 /*
function autoclose_nodes(startnode, cutoff_distance, avoid_nodes) {
  for (var i in startnode.connections) {
    if ($.inArray(startnode.connections[i], avoid_nodes) == -1) {
      for (var j in startnode.connections[i].connections) {
        if ($.inArray(startnode.connections[i].connections[j], avoid_nodes) == -1) {
         // remove_node(startnode.connections[i].connections[j]);
        }
      }
    }
  }
}
*/


function log_activity(activity, data) {
  if (logging_enabled) {
    if (!data) {
      data = {};
    }
    data["activity"] = activity;
    var url = LOG_URL + "?" + $.param(data);
    $("#usage").load(url);
  }
}


function remove_node(node, dont_deadpile) {
  if (node) {
    delete nodes[node.title];
    graph.removeNode(node.vertice);
    node.element.remove();
    var initial_connections = node.connections.slice(0);
    for (var i in node.connections) {
      node.connections[i].connections = $.grep(node.connections[i].connections, function(x) { return x != node; });
      if (!node.connections[i].connections.length && initial_connections.length > 1) {
        // Only remove connecteds if that node was a leaf, but this
        // node was a branch.
        remove_node(node.connections[i], true);
      }
    }
    node.connections = initial_connections;

    if (!dont_deadpile) {
      deadpile.push(node);

      var item = $("<div />").html(node.title + (initial_connections ? " [" + initial_connections.length + "]" : "")).attr({
          "title": node.title + (initial_connections ? " [" + initial_connections.length + " connections]" : "") + ". Click to restore."});
      $("<a />").text("x").click(function() { on_close_deadpile(node); }).attr("title", "Remove '" + node.title + "' from list.").prependTo(item);
      item.click(function() { on_click_deadpile(node); });
      node.deadpile_element = item;

      item.appendTo($("#deadpile_content"));
      $("#deadpile_scroll").animate({scrollTop: $("#deadpile_content").height() - $("#deadpile_scroll").height()}, 100);
    }
  }
}






/**
 * Creates a symmetrical connection between the two node objects.
 */
function connect_nodes(node1, node2) {
  if (node1 && node2) {
    if ($.inArray(node2, node1.connections) == -1) {
      node1.connections.push(node2);
    }
    if ($.inArray(node1, node2.connections) == -1) {
      node2.connections.push(node1);
    }
    var edges1 = graph.getEdges(node1.vertice, node2.vertice);
    var edges2 = graph.getEdges(node2.vertice, node1.vertice);
    if (!edges1.length && !edges2.length) {
      graph.newEdge(node1.vertice, node2.vertice);
    }
  }
}



function clear_results(clear_deadpile) {
  $("#results").empty();
  for (var title in nodes) {
    nodes[title].element.remove();
  }
  nodes = {};
  graph.filterNodes(function(node) { return false } );
  if (clear_deadpile) $("#deadpile_content").empty();
  deadpile = [];
  renderer.start();
}




/**
 * Creates and returns the jQuery div element for the node.
 *
 * @param   node         the local graph node object
 * @param   is_searched  whether is the result of a search, gets coloured differently
 * @return               the jQuery div object containing the node HTML
 */
function create_element(node, is_searched) {
  var element = $("<div />").css("display", "none").appendTo("#results");
  element.attr("wid", node.id); // Attach wikinity id to the element
  if (is_searched) {
    element.addClass("searched_node");
  }
  $("<a />").attr({"class": "wiki", "title": "open wiki", "href": "http://en.wikipedia.org/wiki/"+node.data.title}).text("w").appendTo(element);
  $("<a />").attr({"class": "close", "title": "close"}).text("x").click(function() { remove_node(node); return false; }).appendTo(element);
  $("<a />").attr({"class": "toggle", "title": "toggle visibility"}).text("*").click(function() { node.usercollapsed = !node.collapsed; on_node_mousewheel(null, node.collapsed ? 1 : -100, node); return false; }).appendTo(element);
  var heading = $(node.data.snippet ? "<h1 />" : "<h2 />").html(node.data.title).appendTo(element);
  element.hover(function() { focused_node = node; if (node.collapsed && !node.usercollapsed) on_node_mousewheel(null, 1, node); }, function() { focused_node = null; if (autohide_contents && node.autocollapsed) on_node_mousewheel(null, -100, node); });
  element.mousewheel(function(event, delta) { on_node_mousewheel(event, delta, node); node.usercollapsed = !node.usercollapsed && node.collapsed; node.autocollapsed = node.autocollapsed && node.collapsed && !node.usercollapsed; });
  if (node.data.snippet) {
    // Wrap snippet in <span> as it can contain a flat list of HTML
    var snippet = $("<span />").html(node.data.snippet);
    // Parse out tables and divs, those tend to not have text content
    snippet.find("table").empty().remove(); // Emptying first could be faster
    snippet.find("div").remove();
    snippet.find("strong.error").remove(); // Wiki error messages
    snippet.find("span.IPA").remove(); // phonetic alphabet media content
    snippet.find("img").remove();
    process_links(snippet, node);
    var shorter_snippet = $($.trim(snippet.html().substr(0, 1000)));
    var content = $("<div />").attr("class", "content").css("display", autohide_contents ? "none": "block").append($("<div />").attr("class", "text").append(shorter_snippet));
    content.appendTo(element);
    node.snippet_element = snippet;
    node.shorter_snippet_element = shorter_snippet;
    heading_click_function = function() { log_activity("click_to_expand", {"title": node.data.title}); if (!node.links_queried) node.links_queried = true; get_see_also(node.data.title, neighborhood_size); };
  } else {
    var heading_click_function = function() { log_activity("click_to_retrieve", {"title": node.data.title}); if (!node.links_queried) node.links_queried = true; get_page(node.data.title, neighborhood_size); }
  }
  element.appendTo("#results");
  element.draggable({
    containment: "#main",
    //cursor: "crosshair",
    start: on_node_dragstart,
    stop: on_node_dragstop,
    drag: on_node_drag,
  });
  heading.click(heading_click_function);
/*
trying to add middle click drag, so far nothing..
  element.mousedown(function(event) { if (2 == event.which) { event.which = 1; element.trigger("mousedown", [event]); } });
  element.mousemove(function(event) { if (2 == event.which) { event.which = 1; element.trigger("mousemove", [event]); } });
  element.mouseup(function(event) { if (2 == event.which) { event.which = 1; element.trigger("mouseup", [event]) } });
*/
  heading.hover(function() { if (!node.links_queried) heading.css('cursor','pointer'); }, function() { heading.css('cursor','auto'); });
  return element;
}


function open_settings() {
  $("#settings").slideToggle("fast");
}


function update_settings() {
  limit = parseInt($("#setting_link_limit").val());
  if (NaN == limit) {
    limit = DEFAULT_LINKS_LIMIT;
  }
  neighborhood_size = parseInt($("#setting_neighborhood_size").val());
  if (NaN == neighborhood_size) {
    neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;
  }
  images_enabled = $("#setting_images_enabled").is(":checked");
  autoclear_results = $("#setting_autoclear_results").is(":checked");
  autohide_contents = $("#setting_autohide_contents").is(":checked");
}


/**
 * Returns the node instance for the specified jQuery object.
 */
function get_node(element) {
  var wid = element.attr("wid")
  for (var title in nodes) {
    if (nodes[title].id == wid)
      return nodes[title];
  }
}


function on_click_deadpile(node) {
  node.deadpile_element.remove();
  deadpile = $.grep(deadpile, function(x) { return x != node; });

  node.element = create_element(node); // @todo pane juurde hoidma kusagil searchimist
  node.vertice = graph.newNode(node);
  nodes[node.title] = node;
  for (var i in node.connections) {
    if (!nodes[node.connections[i].title]) {
      node.connections[i].element = create_element(node.connections[i]); // @todo pane juurde hoidma kusagil searchimist
      node.connections[i].vertice = graph.newNode(node.connections[i]);
      nodes[node.connections[i].title] = node.connections[i];
    }
    connect_nodes(node, node.connections[i]);
  }

  renderer.start();
}


function on_close_deadpile(node) {
  node.deadpile_element.remove();
  deadpile = $.grep(deadpile, function(x) { return x != node; });
  // @todo ühendatud nodede eemaldamine, kui neid oli
}


/**
 * Makes the node bigger or smaller, and updates its display to show
 * more text if needed.
 */
function on_node_mousewheel(event, delta, node) {
  if (node) {
    var element = node.element;
  } else {
    var element = $(this);
    node = get_node(element);
  }
  if (node.complete) {
    var content = element.find("div.content");
    var heading = element.find("h1:first");
    var text = content.find("div:first");

    if (text) {
      var current_width = element.width();
      var current_height = element.height();
      if (!node.initial_full_width && !node.collapsed) {
        // Remember first dimensions, to animate uncollapsing
        node.initial_full_width = current_width;
        node.initial_full_height = current_height;
      }
      var new_width = current_width + RESIZE_STEP_WIDTH * delta;
      var new_height = current_height + RESIZE_STEP_HEIGHT * delta;

      var new_inner_width = new_width - element.outerWidth() + current_width;
      var new_inner_height = new_height - element.outerHeight() + current_height;
      if (node.collapsed && delta > 0) {
        // Enlarge node to initial default
        if (node.initial_full_width) {
          element.css("max-width", "");
          element[0].style["max-width"] = ""; 
          //element.animate({"width": node.initial_full_width, "height": node.initial_full_height}, 200, function() { content.css("display", "block"); } );
          element.css({"width": node.initial_full_width, "height": node.initial_full_height});
          content.css("display", "block");
        } else  {
            content.css("display", "block");
        }
        //element.css({"height": "auto", "width": 200});
        node.collapsed = false;
      } else {
        if (delta > 0 || heading.height() < new_inner_height && heading.width() < new_inner_width) {
          // Skip enlarging if we already see everything
          if (!node.resized || !(delta > 0 && element.outerHeight() > content.position().top + content.outerHeight())) {
            if (delta > 0 && !node.fullsnippet_displayed) {
              // Put the full content instead of the shorter one.
              text.empty().append(node.snippet_element);
              node.fullsnippet_displayed = true;
            }
            element.css({"width": new_width, "height": new_height});
            node.resized = true;
          }
        } else if (!node.collapsed) {
          // Sides getting too small - collapse node
          content.css("display", "none");
          // Put back the shorter content.
          text.empty().append(node.shorter_snippet_element);
          element.css({"height": "auto", "width": "auto", "max-width": "200px"});
          node.collapsed = true;
          node.fullsnippet_displayed = false;
          node.resized = false;
        }
      }
    }
  }
  return false;
}


function on_node_dragstart(event, ui) {
  var element = $(this);
  var node = get_node(element);
  dragged_point = layout.nodePoints[node.vertice.id];

  dragged_point.m = 10000.0;

  renderer.start();
};


function on_node_dragstop(event, ui) { 
  dragged_point.m = 1.0;
  dragged_point = null;
}


function on_node_drag(event, ui) {
  var element = $(this);
  var node = get_node(element);
  var element_left = element.position().left;
  var element_top = element.position().top;
  var x = element_left - canvasbox_left + 100;
  var y = element_top - canvasbox_top + 7;

  var p = fromScreen({x: x, y: y});

  dragged_point.p.x = p.x;
  dragged_point.p.y = p.y;
}



function on_window_resize() {
  $("#about").css({
    left: 0,
    top: 0,
  });
  canvas_dom.width = $("#main").width() - 200;
  canvas_dom.height = $("#main").height() - 100;
  var canvasbox = $("#canvasbox");
  canvasbox_left = canvasbox.position().left;
  canvasbox_right = canvasbox.position().left + canvasbox.width();
  canvasbox_top = canvasbox.position().top;
  canvasbox_bottom = canvasbox.position().top + canvasbox.height();
  renderer.start();
  $("#about").css({
    left: $('#wrapper').position().left + $('#wrapper').outerWidth()/2 - $("#about").outerWidth()/2,
    top: $('#wrapper').position().top + $('#wrapper').outerHeight()/2 - $("#about").outerHeight()/2,
  });
}


function parse_hash() {

    var hashParams = {};
    var e,
        a = /\+/g,  // Regex for replacing addition symbol with a space
        r = /([^&;=]+)=?([^&;]*)/g,
        d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
        q = window.location.hash.substring(1);

    while (e = r.exec(q))
       hashParams[d(e[1])] = d(e[2]);

    return hashParams;
}


$(document).ready(function(){

  $("#search_form").submit(
    function(){
      var term = $.trim($("#search_term").val());
      if (term) { 
        if (autoclear_results) clear_results();
        search(term);
        log_activity("search", {"term": term}); 
      }
      return false;
    }
  );

  $("#setting_link_limit").val(DEFAULT_LINKS_LIMIT);

  $("#setting_neighborhood_size").val(DEFAULT_NEIGHBORHOOD_SIZE);

  $("#clear_button").click(function() {
    clear_results(true);
    log_activity("button_clear");
  });

  $("#settings_button").click(function() {
    open_settings();
    log_activity("button_settings");
  });

  $("#footer").find("a").click(function() {
    $("#shadow").css({"display": "block"});
    $("#about").css({"display": "block"});
  });

  $("#shadow").click(function() {
    $("#about").css({"display": "none"});
    $("#shadow").css({"display": "none"});
  });

  $("#closeabout").click(function() {
    $("#about").css({"display": "none"});
    $("#shadow").css({"display": "none"});
  });

  $("#setting_images_enabled").click(function() { 
    images_enabled = $("#setting_images_enabled").is(":checked");
    log_activity("setting", {"images_enabled": images_enabled});
  });

  $("#setting_autoclear_results").click(function() {
    autoclear_results = $("#setting_autoclear_results").is(":checked");
    log_activity("setting", {"autoclear_results": autoclear_results});
  });

  $("#setting_autohide_contents").click(function() {
    autohide_contents = $("#setting_autohide_contents").is(":checked");
    for (var title in nodes) { 
      nodes[title].autocollapsed = autohide_contents; 
      if (!nodes[title].usercollapsed)
        on_node_mousewheel(null, autohide_contents ? -100 : 1, nodes[title]);
    }
    log_activity("setting", {"autohide_contents": autohide_contents});
  });

  $("#setting_link_limit").change(function() {
    limit = parseInt($("#setting_link_limit").val());
    log_activity("setting", {"limit": limit});
    if (NaN == limit) limit = DEFAULT_LINKS_LIMIT; 
  });

  $("#setting_neighborhood_size").change(function() {
    neighborhood_size = parseInt($("#setting_neighborhood_size").val());
    log_activity("setting", {"neighborhood_size": neighborhood_size});
    if (NaN == neighborhood_size) neighborhood_size = DEFAULT_LINKS_LIMIT;
  });

  $("#deadpile_scroll").mousewheel(function(event, delta) {
    if (delta > 0 || $("#deadpile_scroll").attr("scrollTop") + $("#deadpile").height() < $("#deadpile_content").height()) {
      $("#deadpile_scroll").attr({scrollTop: $("#deadpile_scroll").attr("scrollTop") - delta * 21});
    }
  });

  $(window).resize(on_window_resize);

  canvas = $("#canvas");
  canvas_dom = canvas.get(0);
  ctx = canvas_dom.getContext("2d");

  $(window).load(function () { 
    $('#search_term').focus(); 

    // Get parameters from hash string, like #images_enabled=1&link_limit=1&neighborhood_size=10&term=SEARCHTERM
    var hash_params = parse_hash();
    for (var name in hash_params) {
      if ("term" == name) {
        $("#search_term").val(hash_params[name]);
      } else if ("limit" == name) {
        $("#setting_link_limit").val(hash_params[name]);
      } else if ("depth" == name) {
        $("#setting_neighborhood_size").val(hash_params[name]);
      } else if ("images" == name) {
        $("#setting_images_enabled").attr("checked", "0" != hash_params[name]);
      } else if ("autohide" == name) {
        $("#setting_autohide_contents").attr("checked", "0" != hash_params[name]);
      } else if ("autoclear" == name) {
        $("#setting_autoclear_results").attr("checked", "0" != hash_params[name]);
      }
    }
    update_settings();
    if (hash_params["term"]) {
      $("#search_form").submit();
    }
  });

  graph = new Graph();

  var stiffness = 100.0; // 400.0;
  var repulsion = 400.0;
  var damping = 0.8; // 0.5;
  layout = new Layout.ForceDirected(graph, stiffness, repulsion, damping);

  // convert to/from screen coordinates
  var toScreen = function(p) {
    var size = layout.getBoundingBox().topright.subtract(layout.getBoundingBox().bottomleft);
    var sx = p.subtract(layout.getBoundingBox().bottomleft).divide(size.x).x * $("#canvas").get(0).width;
    var sy = p.subtract(layout.getBoundingBox().bottomleft).divide(size.y).y * $("#canvas").get(0).height;
    return new Vector(sx, sy);
  };

  fromScreen = function(s) {
    var size = layout.getBoundingBox().topright.subtract(layout.getBoundingBox().bottomleft);
    var px = (s.x / $("#canvas").get(0).width) * size.x + layout.getBoundingBox().bottomleft.x;
    var py = (s.y / $("#canvas").get(0).height) * size.y + layout.getBoundingBox().bottomleft.y;
    return new Vector(px, py);
  };

  renderer = new Renderer(10, layout,
    function clear() {
      ctx.clearRect(0,0,canvas_dom.width,canvas_dom.height);
    },
    function drawEdge(edge, p1, p2) {
      var x1 = toScreen(p1).x;
      var y1 = toScreen(p1).y;
      var x2 = toScreen(p2).x;
      var y2 = toScreen(p2).y;

      if ("none" == edge.source.data.element.css("display")) edge.source.data.element.css("display", "block"); // Initially was set to none
      if ("none" == edge.target.data.element.css("display")) edge.target.data.element.css("display", "block"); // Initially was set to none
      if (focused_node == edge.source.data) {
        var element_left = edge.source.data.element.position().left;
        var element_top = edge.source.data.element.position().top;
        var x1 = element_left - canvasbox_left + 100;
        var y1 = element_top - canvasbox_top + 7;
      } else if (focused_node == edge.target.data) {
        var element_left = edge.target.data.element.position().left;
        var element_top = edge.target.data.element.position().top;
        var x2 = element_left - canvasbox_left + 100;
        var y2 = element_top - canvasbox_top + 7;
      }

      ctx.strokeStyle = "rgba(0,0,0, .333)";
      ctx.lineWidth = (edge.source.data == focused_node || edge.target.data == focused_node) ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      //ctx.lineTo(x2, y2);
      var cp1x = (x1 + x2) / 2 + 15 * (x2 - x1 < 0 ? -1 : 1);
      var cp1y = (y1 + y2) / 2 + 15 * (y2 - y1 < 0 ? -1 : 1);
      ctx.quadraticCurveTo(cp1x, cp1y, x2, y2)
      ctx.stroke();
    },
    function drawNode(vertice, p) {
      if (vertice.data.title && vertice.data != focused_node) {
        var x = toScreen(p).x;
        var y = toScreen(p).y;

        var element = vertice.data.element;
        var heading = vertice.data.element.find("h1");
        if (!heading) heading = vertice.data.element.find("h2");
        var height = element.outerHeight();
        var new_x = canvasbox_left + x - 100;
        var new_y = heading ? (canvasbox_top + y - 7) : canvasbox_top + y;
        if (new_y + height > canvasbox_bottom) {
          new_y = canvasbox_bottom - height + 7;
        }
        element.css({"left": new_x, "top": new_y});
        if ("none" == vertice.data.element.css("display")) vertice.data.element.css("display", "block"); // Initially was set to none
      }
    }
  );

  on_window_resize();
})
