function resolveReferences(data) {
    let querySpec = data.query_spec;
    // Create lookup maps
    const lookupMaps = new Map();
    
    // Helper to ensure table is always processed as array
    function normalizeTables(tables) {
        if (!tables) return [];
        // If table has numeric keys (0, 1, etc), convert to array
        if (typeof tables === 'object' && !Array.isArray(tables)) {
            if (Object.keys(tables).every(key => !isNaN(key))) {
                return Object.values(tables);
            }
            return [tables];
        }
        return tables;
    }
    
    // Build lookups from query_schema
    if (querySpec.query_schema) {
        // Add tables - handle both single and multiple table cases
        const tables = normalizeTables(querySpec.query_schema.table);
        tables.forEach(table => {
            if (table.alias?.guid) {
                lookupMaps.set(table.alias.guid, table);
            }
            if (table.table?.guid) {
                lookupMaps.set(table.table.guid, table);
            }
        });
        
        // Add columns
        const columns = Array.isArray(querySpec.query_schema.column) ? 
            querySpec.query_schema.column : 
            [querySpec.query_schema.column].filter(Boolean);
        columns.forEach(column => {
            if (column.alias?.guid) {
                lookupMaps.set(column.alias.guid, column);
            }
        });
        
        // Add formulas
        const formulas = Array.isArray(querySpec.query_schema.formula) ?
            querySpec.query_schema.formula :
            [querySpec.query_schema.formula].filter(Boolean);
        formulas.forEach(formula => {
            if (formula.alias?.guid) {
                lookupMaps.set(formula.alias.guid, formula);
            }
        });
    }
    
    // Recursive resolver
    function resolveObject(obj, seenGuids = new Set()) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => resolveObject(item, seenGuids));
        
        const result = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (!value || typeof value !== 'object') {
                result[key] = value;
                continue;
            }
            
            // Handle tables specially
            if (key === 'table' && typeof value === 'object') {
                result[key] = resolveObject(normalizeTables(value), seenGuids);
                continue;
            }
            
            // Handle direct GUID references
            if (value.guid && !seenGuids.has(value.guid)) {
                const resolved = lookupMaps.get(value.guid);
                if (resolved) {
                    seenGuids.add(value.guid);
                    result[key] = {
                        ...value,
                        _resolved: resolveObject(resolved, seenGuids)
                    };
                    continue;
                }
            }
            
            // Handle expression references
            if (value.expr_ref?.ref_id?.guid && !seenGuids.has(value.expr_ref.ref_id.guid)) {
                const resolved = lookupMaps.get(value.expr_ref.ref_id.guid);
                if (resolved) {
                    seenGuids.add(value.expr_ref.ref_id.guid);
                    result[key] = {
                        ...value,
                        expr_ref: {
                            ...value.expr_ref,
                            _resolved: resolveObject(resolved, seenGuids)
                        }
                    };
                    continue;
                }
            }
            
            // Regular recursive resolution
            result[key] = resolveObject(value, seenGuids);
        }
        
        return result;
    }
    
    return {
        query_schema: querySpec.query_schema,
        table: resolveObject(querySpec.table)
    };
}