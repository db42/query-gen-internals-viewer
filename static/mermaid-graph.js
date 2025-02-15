// Utility functions
function sanitizeId(guid) {
    return guid.replace(/-/g, '_');
  }
  
  function createNodeLabel(title, details) {
    return `["${title}<br/>${details}"]`;
  }
  
  /**
   * Generates a Mermaid flowchart specification from a query specification
   * Handles multiple tables in the spec
   */
  function generateMermaidSpec(spec) {
    let nodes = [];
    let edges = [];
    let styles = [];
    
    // Handle both single table and array of tables
    const tables = Array.isArray(spec.table) ? spec.table : [spec.table];
    
    tables.forEach(table => {
      if (!table.id || !table.column) return; // Skip invalid table entries
  
      // Add table node
      const tableId = sanitizeId(table.id.guid);
      pushNode(nodes,`${tableId}${createNodeLabel('Query Table', 
        `GUID: ${table.id.guid}<br/>${table.id.description || ''}`)}`);
      styles.push(`class ${tableId} table`);
  
      const columns = Array.isArray(table.column) ? table.column : [table.column];
      // Process columns for this table
      columns.forEach(col => {
        if (!col.id || !col.output_id) return;
        
        const resolved = col.id._resolved;
        const colId = sanitizeId(col.id.guid);
        
        // Add column node
        pushNode(nodes,`${colId}${createNodeLabel(col.id.name,
          `Output: ${col.output_id.name}<br/>GUID: ${col.id.guid}<br/>Type: ${col.column_type}<br/>DataType: ${col.data_type}`)}`);
        styles.push(`class ${colId} column`);
        edges.push(`${tableId} --> ${colId}`);
  
        if (resolved) {
          // Process function-based columns
          if (resolved.expr?.expr_class === 'EXPR_FUNCTION') {
            processFunctionColumn(resolved, colId, nodes, edges, styles);
          } 
          // Process direct column references
          else if (resolved.column) {
            processDirectColumn(resolved, colId, nodes, edges, styles);
          }
        }
      });
    });
  
    // Generate the complete Mermaid specification
    spec =  `flowchart TD
      %% Style definitions
      classDef table fill:#ffd7f5,color:#000
      classDef function fill:#e6e6ff,color:#000
      classDef column fill:#bfb
      classDef resolved fill:#f0f0f0,stroke-dasharray: 5 5
  
      %% Nodes
      ${nodes.join('\n    ')}
  
      %% Relationships
      ${edges.join('\n    ')}
  
      %% Styling
      ${styles.join('\n    ')}`;
    console.log(spec);
    return spec;
  }
  
  function processFunctionColumn(resolved, parentId, nodes, edges, styles) {
    // Add expression node
    // const expressionId = resolved.expr.expression_id;
    const expressionId = `${parentId}_expr`;
    pushNode(nodes,`${expressionId}${createNodeLabel('Function',
      `Name: ${resolved.expr.function.name}<br/>Is Aggregate: ${resolved.expr.function.is_aggregate}<br/>Type: ${resolved.expr.data_type}`)}`);
    styles.push(`class ${expressionId} function`);
    edges.push(`${parentId} --> ${expressionId}`);
  
    // Process function argument
    const f = resolved.expr.function;
    const args = Array.isArray(f.arguments) ? f.arguments : [f.arguments];
    for (const arg of args) {
        if (arg?.expr_ref?.ref_id) {
            //Add function node
            const argId = sanitizeId(arg.expr_ref.ref_id.guid);
            pushNode(nodes,`${argId}${createNodeLabel(arg.expr_ref.ref_id.name,
                `GUID: ${arg.expr_ref.ref_id.guid}<br/>Type: ${arg.data_type}`)}`);
            edges.push(`${expressionId} --> ${argId}`);
            styles.push(`class ${argId} resolved`);
        
            // Process argument resolution
            if (arg.expr_ref.ref_id._resolved) {
                // Process function-based columns
                resolved = arg.expr_ref.ref_id._resolved;
                if (resolved.expr?.expr_class === 'EXPR_FUNCTION') {
                    processFunctionColumn(resolved, argId, nodes, edges, styles);
                }
            } else if (arg.expr_ref._resolved) {
                // Process direct column references
                processDirectColumn(arg.expr_ref._resolved, argId, nodes, edges, styles);
            }
        } else if (arg.expr_class === 'EXPR_CONSTANT') {
            // Process constant nodes
            processConstantColumn(arg, expressionId, nodes, edges, styles);
        }
    }
  }

  function pushNode(nodes, label) {
    console.log(label);
    nodes.push(label);
  }
  
  function processDirectColumn(resolved, colId, nodes, edges, styles) {
    if (!resolved.column?.guid || !resolved.table_alias?.guid) return;
  
    // Add resolved column node
    const resolvedId = sanitizeId(resolved.column.guid);
    pushNode(nodes,`${resolvedId}${createNodeLabel('Resolved Column',
      `Name: ${resolved.column.name}<br/>GUID: ${resolved.column.guid}<br/>Type: ${resolved.data_type}`)}`);
    edges.push(`${colId} --> ${resolvedId}`);
    styles.push(`class ${resolvedId} column`);
  
    // Add table reference
    const tableId = sanitizeId(resolved.table_alias.guid);
    pushNode(nodes,`${tableId}${createNodeLabel('Table',
      `Name: ${resolved.table_alias.name}<br/>GUID: ${resolved.table_alias.guid}`)}`);
    edges.push(`${resolvedId} --> ${tableId}`);
    styles.push(`class ${tableId} table`);
  }

  function processConstantColumn(argument, parentId, nodes, edges, styles) {
    // {
    //     "expr_class": "EXPR_CONSTANT",
    //     "constant": {
    //       "int_value": 1
    //     },
    //     "data_type": "INT64"
    //   }
    const constantId = `${parentId}_const`;
    const constValue = encodeURI(JSON.stringify(argument.constant));
    const nodeDetails = `Value: ${constValue}<br/>Type: ${argument.data_type}`;
    pushNode(nodes,`${constantId}${createNodeLabel('Constant',nodeDetails)}`);
    edges.push(`${parentId} --> ${constantId}`);
    styles.push(`class ${constantId} constant`);
  }
  
  
  // Example usage:
  /*
  const querySpec = {
    table: [
      {
        id: {...},
        column: [...]
      },
      {
        id: {...},
        column: [...]
      }
    ]
    // Or single table:
    // table: {
    //   id: {...},
    //   column: [...]
    // }
  };
  
  const mermaidDiagram = generateMermaidSpec(querySpec);
  console.log(mermaidDiagram);
  */