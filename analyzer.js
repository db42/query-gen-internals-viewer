// save as transformer_analysis.js

const _ = require('lodash');  // If running in Node.js
const fs = require('fs');
// For browser, use import _ from 'lodash';

// Parse raw logs to structured format
const parseLogFile = (filename) => {
    const match = filename.match(/(.+?)_(before|after)_(\d+)\.txt/);
    if (!match) return null;
    
    return {
        transformer: match[1].replace('Transformer', ''),
        type: match[2],
        timestamp: parseInt(match[3])
    };
};

// Convert raw log lines to TransformerLog array
const parseLogs = (logLines) => {
    return logLines
        .filter(line => line.trim())
        .map(line => {
            const filename = line.split(' ').pop();
            return filename ? parseLogFile(filename) : null;
        })
        .filter(log => log !== null);
};

// New JSON parser
//add sample input here in comments
// {
//     "Transformer1_before_1000": {
//         "content": "value1",
//     },
//     "Transformer1_after_2000": {
//         "content": "value1",
//     },
const parseTransformerJSON = async (jsonPath) => {
    try {
        const jsonContent = await fs.promises.readFile(jsonPath, { encoding: 'utf8' });
        const data = JSON.parse(jsonContent);
        
        // Convert object keys to log entries
        return Object.keys(data).map(key => {
            const match = key.match(/(.+?)_(before|after)_(\d+)/);
            if (!match) return null;
            
            return {
                transformer: match[1].replace('Transformer', ''),
                type: match[2],
                timestamp: parseInt(match[3])
            };
        }).filter(entry => entry !== null);
    } catch (error) {
        console.error('Error parsing transformers.json:', error);
        throw error;
    }
};

const analyzeTransformerLogs = async (format, logPath) => {
    let parsedLogs;
    
    if (format === 'json') {
        parsedLogs = await parseTransformerJSON(logPath);
    } else {
        const logContent = await fs.promises.readFile(logPath, { encoding: 'utf8' });
        const logLines = logContent.split('\n');
        parsedLogs = parseLogs(logLines);
    }
    
    return buildTransformerTree(parsedLogs);
};

// Build tree from parsed logs
const buildTransformerTree = (logs) => {
    const sortedLogs = _.sortBy(logs, ['timestamp', log => log.type !== 'before']);
    const startTime = sortedLogs[0]?.timestamp ?? 0;
    
    const root = { transformers: [] };
    const stack = [];
    
    for (const log of sortedLogs) {
        const relativeMs = (log.timestamp - startTime) / 1000;

        if (log.type === 'before') {
            const node = {
                name: log.transformer,
                start: relativeMs,
                end: null,
                children: []
            };
            
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(node);
            } else {
                root.transformers.push(node);
            }
            stack.push(node);
        } else { // 'after' log
            const nodeToClose = stack.find(node => node.name === log.transformer);
            if (nodeToClose) {
                nodeToClose.end = relativeMs;
                const idx = stack.indexOf(nodeToClose);
                stack.splice(idx, 1);
            }
        }
    }
    
    return root;
};

// Example printer
const printTree = (tree) => {
    const printNode = (node, depth = 0) => {
        const indent = '  '.repeat(depth);
        const lines = [
            `${indent}${node.name} [start ${node.start}ms${node.end ? `, end ${node.end}ms` : ''}]`
        ];
        
        for (const child of node.children) {
            lines.push(...printNode(child, depth + 1));
        }
        
        return lines;
    };
    
    return tree.transformers.map(node => printNode(node).join('\n')).join('\n');
};

// Usage:
const main = async () => {
    try {
        const tree = await analyzeTransformerLogs('json', '/Users/dushyant.bansal/work/query-spec-generator/output/transformers.json');
        // console.log("Tree structure:");
        console.log(printTree(tree));
        
        console.log("\nJSON output:");
        // console.log(JSON.stringify(tree, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
};

main();