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

function changeElementTargetting(tagList) {
    "use strict";
    var setTargeted = tagList.length > 0;
    var selectStr = setTargeted ? tagList.join(" ") : "targeted";

    // select elements from both svg and table by class name.
    var elementSet = document.getElementById("viewer");
    var selectedElements = elementSet.getElementsByClassName(selectStr);
    Array.from(selectedElements).forEach(function(element) {
        setTargeted ?
            element.classList.add("targeted") :
            element.classList.remove("targeted");
    });
}

function selectElements(tagList) {
    "use strict";
    changeElementTargetting(tagList);
}

function clearSelectedElements() {
    "use strict";
    changeElementTargetting([]);
}

// mouse event (highlight object)
function edgeMouseEvent(thisObj) {
    "use strict";
    var classList = thisObj.getAttribute("class").split(" ");
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

    if (macTags.length > 0) {
        // if found (several) mac-addr-tag(s)
        clearSelectedElements();
        macTags.forEach(function(macTag) {
            selectElements([macTag].concat(otherTags));
        });
    } else if (otherTags.length > 0) {
        clearSelectedElements();
        selectElements(otherTags);
    }
}

function drawFlowData(nodes, paths) {
    "use strict";

    var width = 0.9 * window.innerWidth * 0.4;
    var height = width;
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
    var nodeSize = 0.8 * radius * Math.PI / nodes.leaves().length;

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

    // draw nodes
    svg.selectAll("circle")
        .data(nodes.leaves())
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
        .on("mouseover", function() { edgeMouseEvent(this); })
        .append("title")
        .text(function(d) {
            return d.data.flowIndex ? "Index:" + d.data.flowIndex : "";
        });

    // draw text label
    svg.selectAll("text")
        .data(nodes.leaves())
        .enter()
        .append("text")
        .attrs({
            "class": function(d) {
                return d.data.type + " " + d.data.tags;
            },
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
        .on("mouseover", function() { edgeMouseEvent(this); })
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
                    "[" + d.data.flowIndex + "]",
                    d.data.switch, sp, ">", tp
                ].join(" ");
        });
}
