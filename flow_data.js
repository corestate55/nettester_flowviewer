"use strict";

function build_flowdata(ssw_textarea, psw_textarea) {
    var ssw_flows = build_flowdata_from(ssw_textarea);
    var psw_flows = build_flowdata_from(psw_textarea);

    var flows = ssw_flows.concat(psw_flows);
    console.log(flows);

    var nested_flows = nest_flowdata(flows);
    console.log(nested_flows);

    fill_flows(nested_flows);
    setup_key(nested_flows);
    console.log(nested_flows);

    return nested_flows;
}

function nest_flowdata(flows) {
    return d3.nest()
        .key(function(d) { return d.switch; })
        .sortKeys(d3.ascending)
        .key(function(d) { return d.in_port; })
        .sortKeys(function(a,b) { return a - b; })
        .map(flows);
}

function build_flowdata_from(flow_table_textarea) {
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

        numeric_values.forEach(function (nvalue) {
            var re = new RegExp(nvalue + "=(\\d+)");
            var result = line.match(re);
            if(result) {
                if(nvalue === "dl_vlan") nvalue = "vlan_id";
                data[nvalue] = Number(result[1]);
            }
        });
        mac_values.forEach(function (svalue) {
            var re = new RegExp(svalue + "=(\\S+)");
            var result = line.match(re);
            // set svg item class key by mac_address
            if(result) {
                data["mac"] = result[1];
            }
        });

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
                data.vlan = res[1];
            }
        }
        return data;
    });
}

function fill_mac_for_switch_flows(sw_flows) {
    var isp_flows = sw_flows["$1"]; // inter switch port
    isp_flows.forEach(function(flow) {
        if(!flow.action_flood && flow.mac) {
            sw_flows["$" + flow.output].forEach(function(target_flow) {
                target_flow.mac = flow.mac;
            });
        }
    });
}

function mark_flood_for_psw_flows(psw_flows) {
    var edge_ports = Object.keys(psw_flows).filter(
        function(d) { return "$1" !== d; }
    );
    edge_ports.forEach(function(port) {
        psw_flows[port].forEach(function(flow){
            // rule from psw edgeport includes flooding.
            flow.flood_mark = true;
        });
    });
}

function gen_keys(sw, flow) {
    var keys = [ "sw_" + sw.replace(/\$/g, "") ];
    if(!flow.action_flood && flow.mac) {
        keys.push("mac_" + flow.mac.replace(/:/g, ""));
    }
    if(flow.flood_mark) {
        keys.push("flood");
    }
    if (sw === "$ssw") {
        if(flow.in_port > 1) { // ssw edge port
            keys.push("to_testee");
        } else {
            keys.push("to_tester");
        }
    } else {
        if(flow.in_port > 1) { // psw edge port
            keys.push("to_tester");
        } else {
            keys.push("to_testee");
        }
    }
    return keys;
}

function setup_key(nested_flows) {
    Object.keys(nested_flows).forEach(function(sw) {
        var port_table = nested_flows[sw];
        Object.keys(port_table).forEach(function(port) {
            var port_flows = port_table[port];
            port_flows.forEach(function(flow) {
                flow.tags = gen_keys(sw, flow).join(" ");
            });
        });
    });
}

function fill_flows(nested_flows) {
    var ssw_flows = nested_flows["$ssw"];
    fill_mac_for_switch_flows(ssw_flows);
    console.log(ssw_flows);

    var psw_flows = nested_flows["$psw"];
    fill_mac_for_switch_flows(psw_flows);
    mark_flood_for_psw_flows(psw_flows);
    console.log(psw_flows);
}
