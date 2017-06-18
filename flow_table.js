function createFlowTable(nodes) {
    "use strict";
    var previewFlow = document.getElementById("selected_flows");

    var table = document.createElement("table");
    // table header
    var tr = document.createElement("tr");
    ["Switch", "Index", "Rule"].forEach(function(d) {
        var th = document.createElement("th");
        th.textContent = d;
        tr.appendChild(th);
    });
    table.appendChild(tr);
    // table body
    nodes.filter(function(node, index) {
        // 2 nodes (endpoints) per 1-flow.
        // use 1 node.
        return index % 2 === 0;
    }).forEach(function(node) {
        tr = document.createElement("tr");
        tr.setAttribute("class", node.tags);
        [node.switch, node.flowIndex, node.data.ruleStr].forEach(function(d) {
            var td = document.createElement("td");
            td.textContent = d;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
    previewFlow.appendChild(table);
}

function selectFlowTable(tagStr) {
    "use strict";
    var previewFlow = document.getElementById("selected_flows");
    var selectedFlows = previewFlow.getElementsByClassName(tagStr);
    Array.prototype.forEach.call(selectedFlows, function(flow) {
        flow.classList.add("targeted");
    });
}

function clearSelectFlowTable() {
    "use strict";
    var previewFlow = document.getElementById("selected_flows");
    var selectedFlows = previewFlow.getElementsByClassName("targeted");
    Array.prototype.forEach.call(selectedFlows, function(flow) {
        flow.classList.remove("targeted");
    });
}
