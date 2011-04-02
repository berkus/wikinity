// jQuery replaces ? with the created callback function name, this allows for
// cross-site requests.
var SERVER_URL = "http://localhost:8888/?callback=?";
var sys = null; // Arbor ParticleSystem instance
var gfx = null; // Arbor Graphics instance
var nodes = {}; // title: jquery node


function add_node(data) {
  var node = nodes[data.title];
  if (!node) {
    node = $("<div />");
    node.click(function() { get_page(data.title, 1); });
    node.hover(function() { node.css('cursor','pointer'); }, function() { node.css('cursor','auto'); });
    if (data.snippet) {
      node.css("background", "#DFF")
      $("<h1 />").html(data.title).appendTo(node);
      $("<span />").html(data.snippet.substr(0, 300)).css({"text-align": "justified", "font-size": "9px"}).appendTo(node);
    } else {
      $("<h2 />").html(data.title).appendTo(node);
    }
    node.appendTo("#results");
    sys.addNode(data.title, {title: data.title, element: node});
    nodes[data.title] = node;
  } else {
    if (data.snippet) {
      node.empty();
      node.css("background", "#EFF")
      $("<h1 />").html(data.title).appendTo(node);
      $("<span />").html(data.snippet.substr(0, 300)).appendTo(node);
    }
  }
  return node;
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


function get_page(title, depth_to_follow) {
  $.getJSON(SERVER_URL,
    {
      action: "get_page",
      param: title,
    },
    function(data) {
      if (data.title) {
        add_node(data);

        if (data.images.length) {
          get_image(data.images[0], data.title)
        }

        depth_to_follow = typeof(depth_to_follow) != 'undefined' ? depth_to_follow : 1;
        if (depth_to_follow) {
          get_categories(data.title, depth_to_follow)
        }
      } else {
        $("<p />").text("No match for '" + title + "'.").appendTo('#results');
      }
    }
  );
}


function get_image(image_title, article_title) {
  $.getJSON(SERVER_URL,
    {
      action: "get_image",
      param: image_title,
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
      action: "get_categories",
      param: title,
    },
    function(data) {
      $.each(data, function(i, category) { 
        add_node({title: category});
        sys.addEdge(title, category)

        if (depth_to_follow) {
          get_page(category, depth_to_follow);
        }
      });
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
  sys.addNode("dummy1", {title: "dummy1"});
  sys.addNode("dummy2", {title: "dummy2"});
  sys.addEdge("dummy1", "dummy2");


  $("#search_form").submit(
    function(){
      term = $.trim($("#search_term").val());
      if (term) { 
        clear_results();
        get_page(term, 2);
      }
      return false;
    }
  );


  $("#clear_button").click(clear_results);


  $(window).load(function () { 
    $(':input:visible:enabled:first').focus(); 
  });

})
