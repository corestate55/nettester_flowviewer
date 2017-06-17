function rad(deg) {
    "use strict";
    // degree to radian
    return deg / 360 * 2 * Math.PI;
}
function pathAngle(x) {
    "use strict";
    return rad(x);
}
function isAngleHalfside(x) {
    "use strict";
    // use degree
    return (x > 90 && x < 270);
}
function nodeAngleDeg(x) {
    "use strict";
    return x - 90;
}
function nodeAngleRad(x) {
    "use strict";
    return rad(nodeAngleDeg(x));
}
function nodeX(d) {
    "use strict";
    return d.y * Math.cos(nodeAngleRad(d.x));
}
function nodeY(d) {
    "use strict";
    return d.y * Math.sin(nodeAngleRad(d.x));
}

function drawFlowData(nodes, paths) {
    "use strict";

    var width = 700;
    var height = 700;
    var radius = 0.7 * d3.min([width, height]) / 2;
    var svg = d3.select("body")
        .select("div#flow_view")
        .append("svg")
        .attrs({
            "id": "flow_view_canvas",
            "width": width,
            "height": height
        })
        .append("g")
        .attr("transform",
            "translate(" + width / 2 + "," + height / 2 + ")"); // centering

    // layout
    var layout = d3.cluster().size([360, radius]);
    layout(nodes);
    var nodeSize = 0.8 * radius * Math.PI / nodes.descendants().length;

    // draw lines
    var line = d3.radialLine()
        .curve(d3.curveBundle.beta(0.85))
        .radius(function(d) { return d.y; })
        .angle(function(d) { return pathAngle(d.x); });
    svg.selectAll("path")
        .data(paths)
        .enter()
        .append("path")
        .attrs({
            "class": function(d) {
                return d.source.data.tags;
            },
            "d": function(d) {
                return line(d.source.path(d.target));
            }
        });

    // mouse event (highlight object)
    function edgeMouseEvent(th, isMouseOver) {
        var classList = th.getAttribute("class").split(" ");
        var macTags = [];
        var otherTags = [];
        classList.forEach(function(tag) {
            if (tag.match(/mac_/)) {
                macTags.push(tag);
            } else {
                [/to_/, /flood/, /rule_/].forEach(function(re) {
                    if (tag.match(re)) {
                        otherTags.push(tag);
                    }
                });
            }
        });
        var otherTagStr = otherTags.join(".");
        if (macTags.length > 0) {
            macTags.forEach(function(macTag) {
                svg.selectAll(["", macTag, otherTagStr].join("."))
                    .classed("targeted", isMouseOver);
            });
        } else if (otherTagStr.length > 0) {
            svg.selectAll(["", otherTagStr].join("."))
                .classed("targeted", isMouseOver);
        }
    }

    // draw nodes
    svg.selectAll("circle")
        .data(nodes.descendants())
        .enter()
        .append("circle")
        .attrs({
            "class": function(d) {
                return d.data.type + " " + d.data.tags;
            },
            "cx": nodeX,
            "cy": nodeY,
            "r": nodeSize
        })
        .on("mouseover", function() { edgeMouseEvent(this, true); })
        .on("mouseout", function() { edgeMouseEvent(this, false); })
        .append("title")
        .text(function(d) { return d.data.key || d.data.data.ruleStr; });

    // draw text label
    svg.selectAll("text")
        .data(nodes.descendants())
        .enter()
        .append("text")
        .attrs({
            "dx": function(d) {
                var angle = nodeAngleDeg(d.x);
                var dx = nodeSize * 1.3;
                return isAngleHalfside(angle) ? -dx : dx;
            },
            "dy": nodeSize / 2,
            "text-anchor": function(d) {
                var angle = nodeAngleDeg(d.x);
                return isAngleHalfside(angle) ? "end" : "start";
            },
            "transform": function(d) {
                var angle = nodeAngleDeg(d.x);
                angle = isAngleHalfside(angle) ? angle + 180 : angle;
                return [
                    "translate(", nodeX(d), ",", nodeY(d), ")",
                    "rotate(", angle, ")"
                ].join("");
            }
        })
        .text(function(d) {
            var sp, tp;
            if (d.data.type === "source") {
                sp = d.data.sourcePort;
                tp = d.data.targetPort;
            } else {
                tp = d.data.sourcePort;
                sp = d.data.targetPort;
            }
            return d.data.key || [
                    "[", d.data.flowIndex, "] ",
                    d.data.switch, " ", sp, " > ", tp
                ].join("");
        });
}
