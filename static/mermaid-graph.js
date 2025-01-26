// Complete implementation of generateMermaidDiagram
function generateMermaidDiagram(querySpec) {
    let nodes = new Set();
    let edges = new Set();
    let mermaidCode = 'flowchart TD\n';
    
    // Helper functions
    function createNodeId(guid) {
        return `n${guid.replace(/-/g, '_')}`;
    }
    
    function addNode(guid, label) {
        const nodeId = createNodeId(guid);
        const safeLabel = label.replace(/"/g, '\\"').replace(/\n/g, '<br/>');
        const nodeStr = `    ${nodeId}["${safeLabel}"]\n`;
        nodes.add(nodeStr);
        return nodeId;
    }
    
    function addEdge(fromId, toId, label = '') {
        const safeLabel = label ? label.replace(/"/g, '\\"') : '';
        const edgeStr = safeLabel ? 
            `    ${fromId} -->|${safeLabel}| ${toId}\n` :
            `    ${fromId} --> ${toId}\n`;
        edges.add(edgeStr);
    }

    // Process schema sections
    function processQuerySchemaTables(tables) {
        if (!Array.isArray(tables)) return;
        
        tables.forEach(tableInfo => {
            const tableNode = addNode(tableInfo.alias.guid, 
                `Table: ${tableInfo.alias.name}`);
            
            if (tableInfo.join_path?.join) {
                const join = tableInfo.join_path.join;
                const destTableNode = addNode(join.destination.guid,
                    `Table: ${join.destination.name}`);
                addEdge(tableNode, destTableNode, join.join_type);
            }
        });
    }

    function processQuerySchemaColumns(columns) {
        if (!Array.isArray(columns)) return;
        
        columns.forEach(colInfo => {
            const colNode = addNode(colInfo.alias.guid,
                `Column: ${colInfo.alias.name}<br/>Type: ${colInfo.data_type}`);
            
            if (colInfo.table_alias) {
                const tableNode = createNodeId(colInfo.table_alias.guid);
                addEdge(tableNode, colNode);
            }
        });
    }

    function processExpression(expr, parentNodeId, context = '') {
        if (!expr) return;

        // Handle function expressions
        if (expr.expr_class === 'EXPR_FUNCTION') {
            const funcNode = addNode(`${parentNodeId}_func_${context}`, 
                `Function: ${expr.function.name}<br/>Aggregate: ${expr.function.is_aggregate}`);
            addEdge(parentNodeId, funcNode);
            
            if (Array.isArray(expr.function.arguments)) {
                expr.function.arguments.forEach((arg, idx) => {
                    processExpression(arg, funcNode, `arg${idx}`);
                });
            } else if (expr.function.arguments) {
                processExpression(expr.function.arguments, funcNode, 'arg');
            }
        }

        // Handle column references
        if (expr.expr_ref?.ref_id) {
            const refNode = addNode(expr.expr_ref.ref_id.guid,
                `Reference: ${expr.expr_ref.ref_id.name}`);
            addEdge(parentNodeId, refNode);
        }

        // Handle constants
        if (expr.expr_class === 'EXPR_CONSTANT') {
            const value = expr.constant.str_value || expr.constant.int_value || expr.constant.boolean_value;
            const constNode = addNode(`${parentNodeId}_const_${context}`,
                `Constant: ${value}<br/>Type: ${expr.data_type}`);
            addEdge(parentNodeId, constNode);
        }
    }

    function processFormulas(formulas) {
        if (!Array.isArray(formulas)) return;
        
        formulas.forEach(formula => {
            const formulaNode = addNode(formula.alias.guid,
                `Formula: ${formula.alias.name}`);
            
            if (formula.expr) {
                processExpression(formula.expr, formulaNode);
            }
            
            if (formula.table_alias) {
                const tableNode = createNodeId(formula.table_alias.guid);
                addEdge(tableNode, formulaNode);
            }
        });
    }

    // Process table section
    function processQuerySpecTable(table) {
        if (!table) return;

        const queryNode = addNode(table.id.guid,
            `Query: ${table.id.name}`);
        
        // Process filter
        if (table.filter?.id) {
            const filterNode = addNode(table.filter.id.guid,
                `Filter: ${table.filter.id.name}`);
            addEdge(queryNode, filterNode);
        }
        
        // Process column
        if (table.column?.id) {
            const colNode = addNode(table.column.id.guid,
                `Output: ${table.column.id.name}`);
            addEdge(queryNode, colNode);
            
            if (table.column.output_id) {
                const outputNode = addNode(table.column.output_id.guid,
                    `Output ID: ${table.column.output_id.name}`);
                addEdge(colNode, outputNode);
            }
        }
    }

    // Main processing
    if (querySpec.query_schema) {
        processQuerySchemaTables(querySpec.query_schema.table);
        processQuerySchemaColumns(querySpec.query_schema.column);
        processFormulas(querySpec.query_schema.formula);
    }
    
    if (querySpec.table) {
        processQuerySpecTable(querySpec.table);
    }

    // Combine everything
    mermaidCode += Array.from(nodes).join('') +
                  Array.from(edges).join('') +
                  '\n    %% Style nodes\n' +
                  '    classDef table fill:#f9f,stroke:#333\n' +
                  '    classDef function fill:#bbf,stroke:#333\n' +
                  '    classDef column fill:#bfb,stroke:#333\n' +
                  '    classDef constant fill:#ddd,stroke:#333\n' +
                  '    classDef formula fill:#fdb,stroke:#333\n' +
                  '    classDef query fill:#f9f,stroke:#333\n';
    
    return mermaidCode;
}