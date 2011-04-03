// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
var SERVER_URL = "http://localhost:8888/?callback=?";
var sys = null; // Arbor ParticleSystem instance
var gfx = null; // Arbor Graphics instance
var nodes = {}; // {title: jquery_node, }


function add_node(data) {
  var node = nodes[data.title];
  var heading = null;
  if (!node) {
    node = $("<div />");
    node.title = data.title;
    node.links_queried = false;
    $("<a />").attr({"class": "wiki", "title": "open wiki", "href": "http://en.wikipedia.org/wiki/"+data.title}).text("w").appendTo(node);
    $("<a />").attr({"class": "close", "title": "close"}).text("x").click(function() { remove_node(node); return false; }).appendTo(node);
    if (data.snippet) {
      node.css("background", "#DFF")
      heading = $("<h1 />").html(data.title).appendTo(node);
      $("<span />").html(data.snippet.substr(0, 300)).css({"text-align": "justified", "font-size": "9px"}).appendTo(node);
    } else {
      heading = $("<h2 />").html(data.title).appendTo(node);
    }
    node.appendTo("#results");
    sys.addNode(data.title, {"title": data.title, "element": node});
    nodes[data.title] = node;
  } else {
    if (data.snippet) {
      node.find("h1").remove();
      node.find("h2").remove();
      node.find("span").remove();
      node.css("background", "#EFF")
      heading = $("<h1 />").html(data.title).appendTo(node);
      $("<span />").html(data.snippet.substr(0, 300)).appendTo(node);
    }
  }
  heading.click(function() { if (!node.links_queried) node.links_queried = true; get_page(data.title, 1); });
  heading.hover(function() { if (!node.links_queried) heading.css('cursor','pointer'); }, function() { heading.css('cursor','auto'); });
  return node;
}


function remove_node(node) {
  sys.pruneNode(node.title);
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


function get_page(title, depth_to_follow, connected_page) {
  $.getJSON(SERVER_URL,
    {
      "action": "get_page",
      "param": title,
    },
    function(data) {
      if (data.title) {
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

        if (data.images.length) {
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
      $("<img />").attr("src", data.url).appendTo(nodes[article_title]);
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
      $.each(data, function(i, page_title) { 
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
        no_data = true;
        $.each(data, function(i, page_title) { 
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


var Renderer = function(elt){
  var dom = $(elt)
  var canvas = dom.get(0)
  var ctx = canvas.getContext("2d");
  gfx = arbor.Graphics(canvas)

  var that = {
    init:function(pSystem){
      sys = pSystem
      sys.screen({size:{width:dom.width(), height:dom.height()},
                  padding:[36,60,36,60]})

    },
    redraw:function(){
      gfx.clear()
      sys.eachEdge(function(edge, pt1, pt2){
        // edge: {source:Node, target:Node, length:#, data:{}}
        // pt1:  {x:#, y:#}  source position in screen coords
        // pt2:  {x:#, y:#}  target position in screen coords
        // draw a line from pt1 to pt2
        if (edge.source.data.element && edge.target.data.element && edge.source != edge.target) { // To skip dummy elements
          ctx.strokeStyle = "rgba(0,0,0, .333)"
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(pt1.x, pt1.y)
          ctx.lineTo(pt2.x, pt2.y)
          ctx.stroke()
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
  
  return that
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
        clear_results();
        get_page(term, 1);
      }
      return false;
    }
  );


  $("#clear_button").click(clear_results);


  $(window).load(function () { 
    $(':input:visible:enabled:first').focus(); 
  });

})
