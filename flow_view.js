"use strict";

function draw_flow_data(nodes, paths) {
    var width = 700;
    var height = 700;
    var radius = 0.7 * d3.min([width, height]) / 2;
    var svg = d3.select("body")
        .select("div#flow_view")
        .append("svg")
        .attrs({
            "id" : "flow_view_canvas",
            "width" : width,
            "height" : height
        })
        .append("g")
        .attr("transform",
            "translate(" + width/2 + "," + height/2 + ")"); // centering

    // layout
    var layout = d3.cluster().size([360, radius]);
    layout(nodes);
    var node_size = 0.8 * radius * Math.PI / nodes.descendants().length;

    // draw lines
    var line = d3.radialLine()
        .curve(d3.curveBundle.beta(0.85))
        .radius(function(d) { return d.y; })
        .angle(function(d) { return path_angle(d.x); });
    svg.selectAll("path")
        .data(paths)
        .enter()
        .append("path")
        .attrs({
            "class" : function(d) {
                return d.source.data.tags;
            },
            "d" : function(d) {
                return line(d.source.path(d.target));
            }
        });

    // draw nodes
    svg.selectAll("circle")
        .data(nodes.descendants())
        .enter()
        .append("circle")
        .attrs({
            "class" : function(d) {
                return d.data.type + " " + d.data.tags;
            },
            "cx" : node_x,
            "cy" : node_y,
            "r" : node_size
        })
        .on("mouseover", function() { edge_mouse_event(this, true) })
        .on("mouseout", function() { edge_mouse_event(this, false) })
        .append("title")
        .text(function(d) { return d.data.key || d.data.data.rule_str; });

    // draw text label
    svg.selectAll("text")
        .data(nodes.descendants())
        .enter()
        .append("text")
        .attrs({
            "dx" : function(d) {
                var angle = node_angle_deg(d.x);
                var dx = node_size * 1.3;
                return is_angle_halfside(angle) ? -dx : dx;
            },
            "dy" : node_size/2,
            "text-anchor" : function(d) {
                var angle = node_angle_deg(d.x);
                return is_angle_halfside(angle) ? "end" : "start";
            },
            "transform" : function(d) {
                var angle = node_angle_deg(d.x);
                angle = is_angle_halfside(angle) ? angle + 180 : angle;
                return [
                    "translate(", node_x(d), ",", node_y(d), ")",
                    "rotate(", angle, ")"
                ].join("");
            }
        })
        .text(function(d) {
            var sp, tp;
            if(d.data.type === "source") {
                sp = d.data.source_port;
                tp = d.data.target_port;
            } else {
                tp = d.data.source_port;
                sp = d.data.target_port;
            }
            return d.data.key || [
                "[", d.data.flow_index, "] ",
                d.data.switch, " ", sp, " > ", tp
            ].join("");
        });

    // mouse event (highlight object)
    function edge_mouse_event(th, is_mouse_over) {
        var class_list = th.getAttribute("class").split(" ");
        var mac_tags = [];
        var other_tags = [];
        class_list.forEach(function(tag) {
            if(tag.match(/mac_/)) {
                mac_tags.push(tag);
            } else {
                [/to_/, /flood/, /rule_/].forEach(function(re) {
                    if(tag.match(re)) {
                        other_tags.push(tag);
                    }
                });
            }
        });
        var other_tag_str = other_tags.join(".");
        if(mac_tags.length > 0) {
            mac_tags.forEach(function(mac_tag) {
                svg.selectAll(["", mac_tag, other_tag_str].join("."))
                    .classed("targeted", is_mouse_over);
            });
        } else {
            svg.selectAll(["", other_tag_str].join("."))
                .classed("targeted", is_mouse_over);
        }
    }
}

function path_angle(x) {
    return rad(x);
}
function rad(deg) {
    // degree to radian
    return deg/360 * 2 * Math.PI;
}
function is_angle_halfside(x) {
    // use degree
    return (90 < x && x < 270);
}
function node_angle_deg(x) {
    return x - 90;
}
function node_angle_rad(x) {
    return rad(node_angle_deg(x));
}
function node_x(d) {
    return d.y * Math.cos(node_angle_rad(d.x));
}
function node_y(d) {
    return d.y * Math.sin(node_angle_rad(d.x));
}
