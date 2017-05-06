"use strict";

function build_actions_data(actions_str) {
    var data = {};
    var result = null;

    if(actions_str.match(/strip_vlan/)) data["strip_vlan"] = true;
    if(actions_str.match(/FLOOD/)) {
        data["output"] = "FLOOD";
    } else {
        result = actions_str.match(/output:(\d+)/);
        if(result) data["output"] = Number(result[1]);
    }
    result = actions_str.match(/mod_vlan_vid:(\d+)/);
    if(result) data["mod_vlan_vid"] = Number(result[1]);

    return data;
}

function build_flowdata(flow_table_textarea) {
    // check
    console.log("## build_flowdata from " + flow_table_textarea.name);
    // console.log(object.value);

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
        var data = { "rule_str" : line }; // original flow rule string

        numeric_values.forEach(function (nvalue) {
            var re = new RegExp(nvalue + "=(\\d+)");
            var result = line.match(re);
            if(result) {
                data[nvalue] = Number(result[1]);
            }
        });
        mac_values.forEach(function (svalue) {
            var re = new RegExp(svalue + "=(\\S+)");
            var result = line.match(re);
            if(result) {
                // data[svalue] = result[1];
                data.key = result[1]
            }
        });

        var result = line.match(/actions=(\S+)/);
        if(result) {
            data.actions = build_actions_data(result[1]);
        }
        // console.log(line_data);

        return data;
    });
}