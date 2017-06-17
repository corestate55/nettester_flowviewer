
function addIndexToFlows(flows) {
    "use strict";
    flows.forEach(function(flow, index) {
        flow["index"] = index;
    });
    return flows;
}

function parseFlowStringsFrom(flowTableTextArea) {
    "use strict";
    var lines = flowTableTextArea.value
        .split("\n")
        .filter(function(thisobj) {
            // discard header, empty line, and so on.
            return thisobj.match(/^\s+cookie/i);
        });

    return lines.map(function(line) {
        // console.log("No: " + index + " line=", line);
        var flow = { // defaults
            "switch": flowTableTextArea.name,
            "ruleStr": line, // original flow rule string
            "in_port": null,
            "output": null,
            "priority": null,
            "vlan": null,
            "mac": null,
            "actionFlood": false,
            "floodMark": false
        };

        // parse numeric values
        var numericValues = ["priority", "in_port", "dl_vlan"];
        numericValues.forEach(function(numValue) {
            var re = new RegExp(numValue + "=(\\d+)");
            var result = line.match(re);
            if (result) {
                if (numValue === "dl_vlan") {
                    numValue = "vlan_id";
                }
                flow[numValue] = Number(result[1]);
            }
        });
        // parse mac address
        var macValues = ["dl_dst", "dl_src"];
        macValues.forEach(function(macValue) {
            var re = new RegExp(macValue + "=(\\S+)");
            var result = line.match(re);
            // set svg item class key by mac_address
            if (result) {
                flow["mac"] = result[1];
            }
        });
        // parse actions
        var result = line.match(/actions=(\S+)/);
        if (result) {
            var actionsStr = result[1];
            if (actionsStr.match(/FLOOD/)) {
                // flood action only used in ssw
                flow.output = "FLOOD";
                flow.actionFlood = true;
                flow.floodMark = true;
            }
            var res;
            res = actionsStr.match(/output:(\d+)/);
            if (res) {
                flow.output = Number(res[1]);
            }
            res = actionsStr.match(/mod_vlan_vid:(\d+)/);
            if (res) {
                // for exclusive mode wire
                flow.vlan = res[1];
            }
        }
        return flow;
    });
}

function parseFlowStrings(sswTextArea, pswTextArea) {
    "use strict";
    var sswFlows = parseFlowStringsFrom(sswTextArea);
    var pswFlows = parseFlowStringsFrom(pswTextArea);

    return addIndexToFlows(sswFlows.concat(pswFlows));
}

function generateNodeName(switchName, port, flowIndex, dir) {
    "use strict";
    return [switchName, "port", port, "flow", flowIndex, dir].join("_");
}

function convertMacToTag(mac) {
    "use strict";
    return "mac_" + mac.replace(/:/g, "");
}

function generateTags(flow) {
    "use strict";
    var tags = ["sw_" + flow.switch];
    if (!flow.actionFlood && flow.mac) {
        tags.push(convertMacToTag(flow.mac));
    }
    if (flow.floodMark) {
        tags.push("flood");
    }
    if (flow.switch === "ssw") {
        if (flow.in_port > 1) { // ssw edge port
            tags.push("to_testee");
        } else {
            tags.push("to_tester");
        }
    } else if (flow.in_port > 1 && (flow.output === 1 || flow.actionFlood)) {
        // psw edge port
        tags.push("to_tester");
    } else if (flow.in_port === 1 && flow.output > 1) {
        tags.push("to_testee");
    } else {
        tags.push("rule_" + flow.index);
    }

    return tags.join(" ");
}

function generateNode(flow, dir) {
    "use strict";
    var sPort, dPort;
    if (dir === "source") {
        sPort = flow.in_port;
        dPort = flow.output;
    } else {
        dPort = flow.in_port;
        sPort = flow.output;
    }
    return {
        "name": generateNodeName(flow.switch, sPort, flow.index, dir),
        "switch": flow.switch,
        "tags": generateTags(flow),
        "flowIndex": flow.index,
        "type": dir,
        "sourcePort": sPort,
        "targetPort": dPort,
        "data": flow
    };
}

function buildFlows(flows) {
    "use strict";
    var nodes = [];
    flows.forEach(function(flow) {
        nodes.push(generateNode(flow, "source"));
        nodes.push(generateNode(flow, "target"));
    });
    return nodes;
}

function nestNodes(nodes) {
    "use strict";
    return d3.nest()
        .key(function(d) { return d.switch; })
        .sortKeys(d3.ascending)
        .key(function(d) { return d.sourcePort; })
        .sortKeys(function(a, b) { return a - b; })
        .entries(nodes);
}

function complementTags(paths) {
    "use strict";
    // create mac addr table
    var macTable = {
        "ssw": {},
        "psw": {}
    };
    function recordMacTable(node) {
        if (node.sourcePort > 1 && !node.data.actionFlood && node.data.mac) {
            // port1 of ssw/psw is inter_switch link
            // so, port1 is not tied to any host(mac addr).
            if (!macTable[node.switch][node.sourcePort]) {
                macTable[node.switch][node.sourcePort] = [];
            }
            macTable[node.switch][node.sourcePort].push(node.data.mac);
        }
    }
    paths.forEach(function(path) {
        recordMacTable(path.source.data);
        recordMacTable(path.target.data);
    });

    // complement tag info
    function complementTagInfo(source, target) {
        var portMacs = macTable[source.switch][source.sourcePort] || null;
        if (!source.data.mac && portMacs) {
            portMacs.forEach(function(mac) {
                var macTag = convertMacToTag(mac);
                source.tags = source.tags + " " + macTag;
                target.tags = target.tags + " " + macTag;
            });
        }
    }
    paths.forEach(function(path) {
        var source = path.source.data;
        var target = path.target.data;
        complementTagInfo(source, target);
    });
    return paths;
}

function generatePaths(nodes) {
    "use strict";
    var paths = [];
    var nodesNameMap = d3.map(nodes, function(d) {
        return d.data.name;
    });
    nodes.forEach(function(node) {
        if (node.data.type === "source") {
            var targetName = generateNodeName(
                node.data.switch, node.data.targetPort, node.data.flowIndex, "target");
            paths.push({
                "source": node,
                "target": nodesNameMap.get(targetName)
            });
        }
    });

    return complementTags(paths);
}

function stratifyNodes(nodes) {
    "use strict";
    var data = {
        // root node
        "key": "whole switches",
        "values": nestNodes(nodes)
    };
    return d3.hierarchy(data, function(d) {
        return d.values;
    });
}
