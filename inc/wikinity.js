// All page logic. Expects the jQuery and Arbor scripts to be included.
//
// wikinity_backend or wikinity_wiki must also be included.
//
// To avoid confusion between the jQuery and Arbor and Wikinity nodes:
// - node is a Wikinity node
// - element is a jQuery node
// - vertice is an Arbor node
//
// @author    Erki Suurjaak
// @created   02.04.2011
// @modified  07.04.2011

// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
const DEFAULT_LINKS_LIMIT = 5;
const DEFAULT_NEIGHBORHOOD_SIZE = 1;
const RESIZE_STEP_WIDTH = 10;
const RESIZE_STEP_HEIGHT = 20;

var sys = null;    // Arbor ParticleSystem instance
var gfx = null;    // Arbor Graphics instance
var nodes = {};    // {title: node object, }
var canvas = null; // Canvas instance
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
    node.vertice = sys.addNode(node.id, {"title": node.title, "node": node});
    if (referring_title) {
      sys.addEdge(node.id, nodes[referring_title].id);
    }
    if (data.snippet) {
      node.complete = true;
    }
    node.element.draggable({
      containment: "#canvas",
      //cursor: "crosshair",
      start: function(event, ui) { node.vertice.fixed = true; },
      stop: function(event, ui) { 
        var heading = node.element.find("h1");
        if (!heading) heading = node.data.node.element.find("h2");
        var element_left = node.element.position().left;
        var element_top = node.element.position().top;
        var x = element_left - canvas.position().left + node.element.outerWidth() / 2;
        var y = element_top - canvas.position().top + (heading ? parseInt(heading.css("font-size"))/2 : 0);
        node.vertice.p = sys.fromScreen(arbor.Point(x, y));
        node.vertice.fixed = false;
        node.vertice.tempMass = 1000;
      },
      drag: function(event, ui) {
        var heading = node.element.find("h1");
        if (!heading) heading = node.data.node.element.find("h2");
        var element_left = node.element.position().left;
        var element_top = node.element.position().top;
        var x = element_left - canvas.position().left + node.element.outerWidth() / 2;
        var y = element_top - canvas.position().top + (heading ? parseInt(heading.css("font-size"))/2 : 0);
        node.vertice.p = sys.fromScreen(arbor.Point(x, y));
      }
    });
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
    sys.pruneNode(node.id);
    node.element.remove();
  }
}


function clear_results() {
  $("#results").empty();
  for (var title in nodes) {
    nodes[title].element.remove();
  }
  nodes = {};
  if (sys) sys.prune(function(node, from, to) {
    // dummy nodes don't have the node member
    if (node.data.node) return true;
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
  neighborhood_size = parseInt($("#setting_neighborhood_size").val());
  if (NaN == neighborhood_size) {
    neighborhood_size = DEFAULT_NEIGHBORHOOD_SIZE;
  }
  images_enabled = $("#setting_images_enabled").is(":checked");
  autoclear_results = $("#setting_autoclear_results").is(":checked");
  autohide_contents = $("#setting_autohide_contents").is(":checked");
}


/**
 * Returns the node for the specified wikinity id.
 */
function find_node(wid) {
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
    node = find_node(element.attr("wid"));
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


var Renderer = function(elt){
  canvas = $(elt);
  var canvas_dom = canvas.get(0);
  var ctx = canvas_dom.getContext("2d");
  gfx = arbor.Graphics(canvas_dom);

  var that = {
    init:function(pSystem){
      sys = pSystem;
      sys.screen({size:{width:canvas.width(), height:canvas.height()},
                  padding:[36,60,36,60]});
      $(window).resize(that.resize);
    },
    resize:function(){
      canvas_dom.width = $("#main").width();
      canvas_dom.height = $("#main").height();
      sys.screen({"size": {"width": canvas_dom.width, "height": canvas_dom.height}})
      that.redraw()
    },
    redraw:function(){
      gfx.clear()
      sys.eachEdge(function(edge, pt1, pt2) {
        // edge: {source:Node, target:Node, length:#, data:{}}
        if (edge.source.data.node && edge.target.data.node && edge.source != edge.target) { // To skip dummy elements
          ctx.strokeStyle = "rgba(0,0,0, .333)";
          ctx.lineWidth = (edge.source.data.node == focused_node || edge.target.data.node == focused_node) ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          //ctx.lineTo(pt2.x, pt2.y);
          var cp1x = (pt1.x + pt2.x) / 2 + 15 * (pt2.x - pt1.x < 0 ? -1 : 1);
          var cp1y = (pt1.y + pt2.y) / 2 + 15 * (pt2.y - pt1.y < 0 ? -1 : 1);
          ctx.quadraticCurveTo(cp1x, cp1y, pt2.x, pt2.y)
          ctx.stroke();
        }
      })
      sys.eachNode(function(node, pt) {
        if (node.data.node && !node.fixed) {
          if ("none" == node.data.node.element.css("display")) node.data.node.element.css("display", "block"); // Initially was set to none
          var element = node.data.node.element;
          var heading = node.data.node.element.find("h1");
          if (!heading) heading = node.data.node.element.find("h2");
          var x = canvas.position().left + pt.x - element.outerWidth() / 2;
          var y = heading ? (canvas.position().top + pt.y - parseInt(heading.css("font-size")) / 2) : canvas.position().top + pt.y;
/*
          Was trying out how to better manage not letting divs too much over the edge,
          as the div has dimension, but points don't. Doesn't work very well, is slow
          and buggy. Especially - slow.
          var x = element.position().left;
          var y = element.position().top;
          var new_x = canvas.position().left + pt.x - element.outerWidth() / 2;
          var new_y = heading ? (canvas.position().top + pt.y - parseInt(heading.css("font-size")) / 2) : canvas.position().top + pt.y;
          if (new_x > 0 && new_x + element.outerWidth() < canvas.position().left + canvas.outerWidth()) {
            x = new_x;
          } else {
            x = (new_x < 0) ? canvas.position().left : canvas.position().left + canvas.outerWidth();
          }
          if (new_y > 0 && new_y + element.outerHeight() < canvas.position().top + canvas.outerHeight()) {
            y = new_y;
          } else {
            y = (new_y < 0) ? canvas.position().top : canvas.position().top + canvas.outerHeight();
          }
*/
          //@todo needs some tweaking
          //x = Math.max(0, Math.min(x, canvas_dom.offsetWidth));
          //y = Math.max(0, Math.min(y, canvas_dom.offsetHeight));
          element.css({"left": x, "top": y});
          //node.data.node.element.animate({"top": y, "left": x}, 100);
        }
      })
    },
  }
  
  return that;
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

  sys = arbor.ParticleSystem()
  // @todo twiddle with these. From Arbor doc:
  // NAME     DEFAULT  INFO
  // repulsion  1,000  the force repelling nodes from each other
  // stiffness    600  the rigidity of the edges
  // friction     0.5  the amount of damping in the system
  // gravity    false  an additional force attracting nodes to the origin
  // fps           55  frames per second
  // dt          0.02  timestep to use for stepping the simulation
  // precision    0.6  accuracy vs. speed in force calculations
  //                   (zero is fast but jittery, one is smooth but cpu-intensive)
  //sys.parameters({friction:0.5, stiffness:100, repulsion:1000, gravity: true, fps: 60, dt: 0.08, precision: 1.0});
  sys.parameters({stiffness:900, repulsion:1000, gravity: true});
  sys.renderer = Renderer("#canvas")

  // Perhaps I'm an ass, but it seems that Arbor cannot handle just one node in the
  // graph. At all. If there is first only one element, and another is added later,
  // Arbor stops updating. <shrug> So a temporary workaround: use invisible dummies.
  sys.addNode("dummy1", {"title": "dummy1", "fixed": true}); // Reference says that on fixed=true the node is
  sys.addNode("dummy2", {"title": "dummy2", "fixed": true}); // unaffected by other nodes, but doesn't seem to work.
//  sys.addEdge("dummy1", "dummy2");

})
