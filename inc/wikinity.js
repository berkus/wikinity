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
// @modified  08.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const DEFAULT_LINKS_LIMIT = 5;
const DEFAULT_NEIGHBORHOOD_SIZE = 1;
const RESIZE_STEP_WIDTH = 10;
const RESIZE_STEP_HEIGHT = 20;

var nodes = {};      // {title: node object, }
var graph = null;    // Springy Graph instance
var renderer = null; // Springy Renderer instance
var canvas = null;   // Canvas instance
var canvas_dom = null; // Canvas DOM instance
var layout = null;   // Springy ForceDirected instance
var focused_node = null; // Currently focused node

var limit = DEFAULT_LINKS_LIMIT;
var images_enabled = true;
var autoclear_results = true;
var neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;
var autohide_contents = false;


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
    node.element = create_graph_element(node, !referring_title);
    nodes[node.title] = node;
    if (data.snippet) {
      node.complete = true;
    }
    node.vertice = graph.newNode(node);
    if (referring_title) {
      graph.newEdge(node.vertice, nodes[referring_title].vertice);
    }
    renderer.start();
  } else if (!node.complete) {
    update_graph_element(node, data);
    node.data = data;
    node.complete = true;
  }
  return node;
}


function remove_node(node) {
  if (node) {
    delete nodes[node.title];
    graph.removeNode(node.vertice);
    node.element.remove();
  }
}


function clear_results() {
  $("#results").empty();
  for (var title in nodes) {
    nodes[title].element.remove();
  }
  nodes = {};
  graph.filterNodes(function(node) { return false } );
  renderer.start();
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


var dragged = null;

function on_node_dragstart(event, ui) {
  var element = $(this);
  var element_left = element.position().left;
  var element_top = element.position().top;
  var p = fromScreen({x: element_left - canvas.position().left, y: element_top - canvas.position().top});
  dragged = layout.nearest(p);

  dragged.point.m = 10000.0;

  renderer.start();
};


function on_node_dragstop(event, ui) { 
  dragged = null;
}


function on_node_drag(event, ui) {
  var element = $(this);
  var node = get_node(element);
  var heading = element.find("h1");
  if (!heading) heading = element.find("h2");
  var element_left = element.position().left;
  var element_top = element.position().top;
  var x = element_left - canvas.position().left + element.outerWidth() / 2;
  var y = element_top - canvas.position().top + (heading ? parseInt(heading.css("font-size"))/2 : 0);

  var p = fromScreen({x: x, y: y});

  dragged.point.p.x = p.x;
  dragged.point.p.y = p.y;

  //renderer.start();
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
      term = $.trim($("#search_term").val());
      if (term) { 
        if (autoclear_results) clear_results();
        search(term);
      }
      return false;
    }
  );

  $("#setting_link_limit").val(DEFAULT_LINKS_LIMIT);

  $("#setting_neighborhood_size").val(DEFAULT_NEIGHBORHOOD_SIZE);

  $("#clear_button").click(clear_results);

  $("#settings_button").click(open_settings);

  $("#setting_images_enabled").click(function() { images_enabled = $("#setting_images_enabled").is(":checked"); });

  $("#setting_autoclear_results").click(function() { autoclear_results = $("#setting_autoclear_results").is(":checked"); });

  $("#setting_autohide_contents").click(function() { autohide_contents = $("#setting_autohide_contents").is(":checked"); for (var title in nodes) { nodes[title].autocollapsed = autohide_contents; if (!nodes[title].usercollapsed) on_node_mousewheel(null, autohide_contents ? -100 : 1, nodes[title]); } });

  $("#setting_link_limit").change(function() { limit = parseInt($("#setting_link_limit").val()); if (NaN == limit) limit = DEFAULT_LINKS_LIMIT; });

  $("#setting_neighborhood_size").change(function() { neighborhood_size = parseInt($("#setting_neighborhood_size").val()); if (NaN == neighborhood_size) neighborhood_size = DEFAULT_LINKS_LIMIT; });

  $(window).resize(on_window_resize);


  function on_window_resize() {
    canvas_dom.width = $("#main").width();
    canvas_dom.height = $("#main").height();
    //@arbor sys.screen({"size": {"width": canvas_dom.width, "height": canvas_dom.height}})
    renderer.start();
  }

  canvas = $("#canvas");
  canvas_dom = canvas.get(0);

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
      var ctx = canvas_dom.getContext("2d");
      ctx.clearRect(0,0,canvas_dom.width,canvas_dom.height);
    },
    function drawEdge(edge, p1, p2) {
      var x1 = toScreen(p1).x;
      var y1 = toScreen(p1).y;
      var x2 = toScreen(p2).x;
      var y2 = toScreen(p2).y;

      var ctx = canvas_dom.getContext("2d");
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
    function drawNode(node, p) {
      if (node.data.title) {
        var x = toScreen(p).x;
        var y = toScreen(p).y;

        if ("none" == node.data.element.css("display")) node.data.element.css("display", "block"); // Initially was set to none
        var element = node.data.element;
        var heading = node.data.element.find("h1");
        if (!heading) heading = node.data.element.find("h2");
        var x = canvas.position().left + x - element.outerWidth() / 2;
        var y = heading ? (canvas.position().top + y - parseInt(heading.css("font-size")) / 2) : canvas.position().top + y;
        element.css({"left": x, "top": y});
      }
    }
  );

  on_window_resize();
})
