"use strict";

function gen_key_str(flow, flow_index) {
    if(flow.key) {
        return "key_" + flow.key.replace(/:/g, "");
    } else {
        return "key_" + flow_index;
    }
}

function add_flow_edge_to(port_table, type, port, flow) {
    var flow_edge = {
        "type" : type,
        "flow" : flow
    };
    if(port_table[port]) {
        port_table[port].push(flow_edge);
    } else {
        port_table[port] = [ flow_edge ];
    }
    return flow_edge;
}

function gen_per_port_flow_edges(ssw_flows) {
    var port_table = {};
    ssw_flows.forEach(function(flow, flow_index) {
        // generate and add edge
        var src_edge = add_flow_edge_to(
            port_table, "src", flow.in_port, flow);
        var dst_edge = add_flow_edge_to(
            port_table, "dst", flow.actions.output, flow);
        // link counter-part edge for each other
        src_edge["pair_edge"] = dst_edge;
        dst_edge["pair_edge"] = src_edge;
        // add key of edge
        src_edge["key"] = gen_key_str(src_edge.flow, flow_index);
        dst_edge["key"] = gen_key_str(dst_edge.flow, flow_index);
    });
    return port_table;
}

function serialize_per_port_flow_edges(per_port_flow_edges) {
    var total_sn = 1; // serial number (sn=0 reserved for specific use)
    var list = [];
    Object.keys(per_port_flow_edges).forEach(function(key) {
        var port_flows = per_port_flow_edges[key]; // flow_edge list
        port_flows.forEach(function(flow_edge) {
            flow_edge["serial_num"] = total_sn; // add serial number
            list.push(flow_edge);
            total_sn = total_sn + 1;
        });
    });
    return list;
}

var radius = 15;

function pos_x(d) {
    return d.serial_num * 2 * radius;
}

var pos_y; // function alias
function ssw_pos_y(d) {
    return 3 * radius;
}
function psw_pos_y(d) {
    return 18 * radius;
}

function pos_y_path_mid(d,i) {
    return pos_y(d) + (i%2 === 0 ? radius : 15 * radius);
}

function pos_x_port_rect(d) {
    return pos_x(d) - radius;
}

function pos_y_port_rect(d) {
    return pos_y(d) - 2 * radius;
}

function draw_flow_edges(target_switch, svg, flow_edges) {
    function mouseivent(th, is_mouseover) {
        var key = th.getAttribute("class")
            .match(/key_(\S+)/)[0];
        svg.selectAll("." + key)
            .classed("targeted", is_mouseover);
    }

    svg.selectAll("circle." + target_switch)
        .data(flow_edges)
        .enter()
        .append("circle")
        .attrs({
            "class" : function(d) {
                return [target_switch, d.type, d.key].join(" ");
            },
            "cx" : pos_x,
            "cy" : pos_y,
            "r" : radius
        })
        .on("mouseover", function() { mouseivent(this, true) })
        .on("mouseout", function() { mouseivent(this, false)})
        .append("title")
        .text(function(d) {
            return "ID:" + d.serial_num
                + ", Pair ID:" + d.pair_edge.serial_num
                + ", Flow:" + d.flow.rule_str;
        });
}

function draw_paths(target_switch, svg, flow_edges) {
    var line = d3.line()
        .curve(d3.curveBundle.beta(0.8))
        .x(pos_x)
        .y(pos_y_path_mid);

    flow_edges.forEach(function(flow_edge) {
        if(flow_edge.type === "src") {
            var src_edge = flow_edge;
            var dst_edge = flow_edge.pair_edge;
            var mid_edge = {
                // position of x-axis
                "serial_num" : (src_edge.serial_num + dst_edge.serial_num) /2.0
            };
            svg.append("path")
                .attrs({
                    "class": [target_switch, src_edge.key].join(" "),
                    "d": line([src_edge, mid_edge, dst_edge])
                });
        }
    });
}

function draw_ports(target_switch, svg, per_port_flow_edge) {
    var ports = [];
    Object.keys(per_port_flow_edge).forEach(function(key) {
        var edge_list = per_port_flow_edge[key];
        ports.push({
            "serial_num" : edge_list[0].serial_num, // position of x
            "port" : key==="FLOOD" ? key : Number(key), // port number (name)
            "size" : edge_list.length // x-axis width
        });
    });

    function label(d) { return "Port:" + d.port; }

    svg.selectAll("rect." + target_switch)
        .data(ports)
        .enter()
        .append("rect")
        .attrs({
            "class" : function(d,i) {
                return [target_switch, i%2===0 ? "even" : "odd"].join(" ");
            },
            "x" : pos_x_port_rect,
            "y" : pos_y_port_rect,
            "width" : function(d) {
                return d.size * radius * 2;
            },
            "height" : radius * 3
        })
        .on("mouseover", function() {
            d3.select(this).classed("targeted", true);
        })
        .on("mouseout", function() {
            d3.select(this).classed("targeted", false);
        })
        .append("title")
        .text(label);

    // label
    svg.selectAll("text." + target_switch)
        .data(ports)
        .enter()
        .append("text")
        .attrs({
            "class" : target_switch,
            "x" : pos_x_port_rect,
            "y" : pos_y_port_rect
        })
        .text(label);
}

function draw_flow_tables(ssw_flows, psw_flows) {
    console.log("## draw_flow_tables");

    var height = 500, width = 1500; // svg canvas size
    var svg = d3.select("body")
        .select("div#flow_view")
        .append("svg")
        .attrs({
            "width": width,
            "height": height}
        );

    // ssw
    pos_y = ssw_pos_y;
    console.log(pos_y);
    var ssw_per_port_flow_edges = gen_per_port_flow_edges(ssw_flows);
    var ssw_flow_edges = serialize_per_port_flow_edges(ssw_per_port_flow_edges);
    console.log(ssw_flow_edges);

    draw_ports("ssw", svg, ssw_per_port_flow_edges);
    draw_flow_edges("ssw", svg, ssw_flow_edges);
    draw_paths("ssw", svg, ssw_flow_edges);

    // psw
    pos_y = psw_pos_y;
    console.log(pos_y);
    var psw_per_port_flow_edges = gen_per_port_flow_edges(psw_flows);
    var psw_flow_edges = serialize_per_port_flow_edges(psw_per_port_flow_edges);
    console.log(psw_flow_edges);

    draw_ports("psw", svg, psw_per_port_flow_edges);
    draw_flow_edges("psw", svg, psw_flow_edges);
    draw_paths("psw", svg, psw_flow_edges);
}
