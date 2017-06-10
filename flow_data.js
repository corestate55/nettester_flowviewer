"use strict";

function add_index_to_flows(flows) {
    flows.forEach(function(flow, index) {
        flow["index"] = index;
    });
    return flows;
}

function parse_flows(ssw_textarea, psw_textarea) {
    var ssw_flows = parse_flows_from(ssw_textarea);
    var psw_flows = parse_flows_from(psw_textarea);

    return add_index_to_flows(ssw_flows.concat(psw_flows));
}

function parse_flows_from(flow_table_textarea) {
    var lines = flow_table_textarea.value
        .split("\n")
        .filter(function (thisobj) {
            // discard header, empty line, and so on.
            return thisobj.match(/^\s+cookie/i);
        });

    var numeric_values = ["priority", "in_port", "dl_vlan"];
    var mac_values = ["dl_dst", "dl_src"];
    return lines.map(function (line) {
        // console.log("No: " + index + " line=", line);
        var data = { // defaults
            "switch" : flow_table_textarea.name,
            "rule_str" : line, // original flow rule string
            "in_port" : null,
            "output" : null,
            "priority" : null,
            "vlan" : null,
            "mac" : null,
            "action_flood": false,
            "flood_mark" : false
        };

        // parse numeric values
        numeric_values.forEach(function (nvalue) {
            var re = new RegExp(nvalue + "=(\\d+)");
            var result = line.match(re);
            if(result) {
                if(nvalue === "dl_vlan") nvalue = "vlan_id";
                data[nvalue] = Number(result[1]);
            }
        });
        // parse mac address
        mac_values.forEach(function (svalue) {
            var re = new RegExp(svalue + "=(\\S+)");
            var result = line.match(re);
            // set svg item class key by mac_address
            if(result) {
                data["mac"] = result[1];
            }
        });
        // parse actions
        var result = line.match(/actions=(\S+)/);
        if(result) {
            var actions_str = result[1];
            if(actions_str.match(/FLOOD/)) {
                // flood action only used in ssw
                data.output = "FLOOD";
                data.action_flood = true;
                data.flood_mark = true;
            }
            var res;
            res = actions_str.match(/output:(\d+)/);
            if(res) {
                data.output = Number(res[1]);
            }
            res = actions_str.match(/mod_vlan_vid:(\d+)/);
            if(res) {
                // for exclusive mode wire
                data.vlan = res[1];
            }
        }
        return data;
    });
}

function generate_node_name(switch_name, port, flow_index, dir) {
    return [switch_name, "port", port, "flow", flow_index, dir].join("_");
}

function convert_mac_to_tag(mac) {
    return "mac_" + mac.replace(/:/g, "");
}

function generate_tags(data) {
    var tags = [ "sw_" + data.switch ];
    if(!data.action_flood && data.mac) {
        tags.push(convert_mac_to_tag(data.mac));
    }
    if(data.flood_mark) {
        tags.push("flood");
    }
    if (data.switch === "ssw") {
        if(data.in_port > 1) { // ssw edge port
            tags.push("to_testee");
        } else {
            tags.push("to_tester");
        }
    } else {
        if(data.in_port > 1
            && (data.output === 1 || data.action_flood)) {
            // psw edge port
            tags.push("to_tester");
        } else if(data.in_port === 1 && data.output > 1){
            tags.push("to_testee");
        } else {
            tags.push("rule_" + data.index);
        }
    }
    return tags.join(" ");
}

function generate_node(data, dir) {
    var sport, dport;
    if(dir === "source") {
        sport = data.in_port;
        dport = data.output;
    } else {
        dport = data.in_port;
        sport = data.output;
    }
    return {
        "name" : generate_node_name(data.switch, sport, data.index, dir),
        "switch" : data.switch,
        "tags" : generate_tags(data),
        "flow_index" : data.index,
        "type" : dir,
        "source_port" : sport,
        "target_port" : dport,
        "data" : data
    };
}

function build_flows(flows) {
    var nodes = [];
    flows.forEach(function(d) {
        nodes.push(generate_node(d, "source"));
        nodes.push(generate_node(d, "target"));
    });
    return nodes;
}

function nest_nodes(nodes) {
    return d3.nest()
        .key(function(d) { return d.switch; })
        .sortKeys(d3.ascending)
        .key(function(d) { return d.source_port; })
        .sortKeys(function(a,b) { return a - b; })
        .entries(nodes);
}

function complement_tags(paths) {
    // create mac addr table
    var mac_table = {
        "ssw" : {},
        "psw" : {}
    };
    function record_table(data) {
        if(data.source_port > 1 && !data.data.action_flood && data.data.mac) {
            // port1 of ssw/psw is inter_switch link
            // so, port1 is not tied to any host(mac addr).
            if(!mac_table[data.switch][data.source_port]) {
                mac_table[data.switch][data.source_port] = [];
            }
            mac_table[data.switch][data.source_port].push(data.data.mac);
        }
    }
    paths.forEach(function(path) {
        record_table(path.source.data);
        record_table(path.target.data);
    });

    // complement tag info
    function complement_tag_info(source, target) {
        var port_macs = mac_table[source.switch][source.source_port] || null;
        if(!source.data.mac && port_macs) {
            port_macs.forEach(function(mac) {
                var mac_tag = convert_mac_to_tag(mac);
                source.tags = source.tags + " " + mac_tag;
                target.tags = target.tags + " " + mac_tag;
            });
        }
    }
    paths.forEach(function(path) {
        var source = path.source.data;
        var target = path.target.data;
        complement_tag_info(source, target);
    });
    return paths;
}

function generate_path(nodes) {
    var paths = [];
    var nodes_name_map = d3.map(nodes, function(d) {
        return d.data.name;
    });
    nodes.forEach(function(d) {
        if(d.data.type === "source") {
            var target_name = generate_node_name(
                d.data.switch, d.data.target_port, d.data.flow_index, "target");
            paths.push({
                "source" : d,
                "target" : nodes_name_map.get(target_name)
            });
        }
    });

    return complement_tags(paths);
}

function stratify_nested_nodes(nodes) {
    var data = {
        "key" : "whole switches",
        "values": nest_nodes(nodes)
    };
    return d3.hierarchy(data, function(d) {
        return d.values;
    });
}
