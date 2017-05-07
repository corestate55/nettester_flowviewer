"use strict";

function nest_flow_data(flows) {
    return d3.nest()
        .key(function(d) { return d.switch; })
        .sortKeys(d3.ascending)
        .key(function(d) { return d.in_port; })
        .sortKeys(function(a,b) { return a - b; })
        .map(flows);
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

    var psw_flows = nested_flows["$psw"];
    fill_mac_for_switch_flows(psw_flows);
    mark_flood_for_psw_flows(psw_flows);
}

function build_nested_flow_data(flows) {
    var nested_flows = nest_flow_data(flows);
    fill_flows(nested_flows);
    setup_key(nested_flows);

    return nested_flows;
}

function path_edge(sw, port) {
    return {
        "sw" : sw,
        "port" : port
    };
}
function path_elm(src, dst, flow) {
    return {
        "src" : src,
        "dst" : dst,
        "flow" : flow
    };
}

function gen_sw_ports(sw_flows) {
    return Object.keys(sw_flows);
}

function build_path_intra_switch(sw, sw_flows) {
    var paths = [];
    gen_sw_ports(sw_flows).forEach(function(port) {
        var port_flows = sw_flows[port];
        Object.keys(port_flows).forEach(function(flow_index) {
            var flow = port_flows[flow_index];
            paths.push(path_elm(
                path_edge(sw, port),
                path_edge(sw, "$" + flow.output),
                flow
            ));
        });
    });
    return paths;
}

function build_path_inter_switch() {
    var isp = "$1"; // inter switch port
    return [ path_elm(
        path_edge("$ssw", isp),
        path_edge("$psw", isp),
        { "tags" : "" } // customized flow object
    )];
}

function build_flow_path(nested_flows) {
    var ssw_flows = nested_flows["$ssw"];
    var ssw_paths = build_path_intra_switch("$ssw", ssw_flows);

    var psw_flows = nested_flows["$psw"];
    var psw_paths = build_path_intra_switch("$psw", psw_flows);

    var isp_path = build_path_inter_switch();

    var all_paths = ssw_paths.concat(psw_paths, isp_path);
    all_paths.forEach(function(path, index) {
        path["index"] = index;
    });
    return all_paths;
}