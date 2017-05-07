"use strict";

function pos_x(radius, theta) {
    return radius * Math.cos(theta);
}

function pos_y(radius, theta) {
    return radius * Math.sin(theta);
}

function gen_path_edges(flow_paths) {
    var edge_table = {
        "$psw" : {},
        "$ssw" : {}
    };

    flow_paths.forEach(function(path) {
        path.src.type = "src";
        path.src.flow = path.flow;
        path.src.pair = path.dst;
        path.dst.type = "dst";
        path.dst.flow = path.flow;
        path.dst.pair = path.src;

        if(edge_table[path.src.sw][path.src.port]) {
            edge_table[path.src.sw][path.src.port].push(path.src);
        } else {
            edge_table[path.src.sw][path.src.port] = [ path.src ];
        }
        if(edge_table[path.dst.sw][path.dst.port]) {
            edge_table[path.dst.sw][path.dst.port].push(path.dst);
        } else {
            edge_table[path.dst.sw][path.dst.port] = [ path.dst ];
        }
    });
    console.log(edge_table);

    // serialize order by switch/port
    var all_edges = [];
    Object.keys(edge_table).forEach(function(sw) {
        var port_table = edge_table[sw];
        Object.keys(port_table).sort().forEach(function(port) {
            all_edges = all_edges.concat(port_table[port])
        });
    });
    // add index number
    var index = 0;
    all_edges.forEach(function(edge) {
        edge["index"] = index;
        index = index + 1;
    });
    console.log(all_edges);

    return all_edges;
}

function draw_flow_data(flow_data, nested_flow_data, flow_paths) {
    // console.log(flow_data);
    // console.log(nested_flow_data);
    console.log(flow_paths);

    var size = 600;
    var svg = d3.select("body")
        .select("div#flow_view")
        .append("svg")
        .attrs({
            "width": size,
            "height": size
        })
        .append("g")
        .attr("transform",
            "translate(" + size / 2 + "," + size / 2 + ")"); // centering

    var all_edges = gen_path_edges(flow_paths);

    var lradius = size / 3;
    var cradius = lradius * Math.PI / all_edges.length * 0.8;
    var theta = d3.scalePoint()
        .domain(Object.keys(all_edges).concat(all_edges.length))
        .range([0, 2 * Math.PI]);

    function descr(d) {
        return d.sw + " " + d.port
        + " (" + d.flow.in_port + "->" + d.flow.output + ")";
    }
    svg.selectAll("circle")
        .data(all_edges)
        .enter()
        .append("circle")
        .attrs({
            "class" : function(d) { return d.type + " " + d.flow.tags; },
            "cx": function(d) { return pos_x(lradius, theta(d.index)); },
            "cy": function(d) { return pos_y(lradius, theta(d.index)); },
            "r" : cradius
        })
        .append("title")
        .text(descr);

    svg.selectAll("text")
        .data(all_edges)
        .enter()
        .append("text")
        .attrs({
            "x": function(d) { return pos_x(lradius, theta(d.index)); },
            "y": function(d) { return pos_y(lradius, theta(d.index)); }
        })
        .text(descr);

    var mid = 0.3;
    var line = d3.line()
        .curve(d3.curveBundle.beta(0.9))
        .x(function(d, i) {
            var x = pos_x(lradius, theta(d));
            return (0 < i && i < 3) ? mid * x : x;
        })
        .y(function(d, i) {
            var y = pos_y(lradius, theta(d));
            return (0 < i && i < 3) ? mid * y : y;
        });

    flow_paths.forEach(function(flow_path) {
        svg.append("path")
            .attrs({
                "class" : "path", // TODO
                "d" : line(gen_path_index(flow_path))
            });
    });
}

function gen_path_index(flow_path) {
    var src = flow_path.src.index;
    var dst = flow_path.dst.index;
    return [src, src, dst, dst];
}

// ref
// Banded Arcs - bl.ocks.org https://bl.ocks.org/mbostock/938288