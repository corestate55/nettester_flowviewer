"use strict";

function add_index_to_flows(flows) {
    flows.forEach(function(flow, index) {
        flow["index"] = index;
    });
    return flows;
}

function build_flow_data(ssw_textarea, psw_textarea) {
    var ssw_flows = build_flow_data_from(ssw_textarea);
    var psw_flows = build_flow_data_from(psw_textarea);

    return add_index_to_flows(ssw_flows.concat(psw_flows));
}

function build_flow_data_from(flow_table_textarea) {
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
