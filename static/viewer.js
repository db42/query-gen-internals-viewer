// static/viewer.js

// Global state
let transformerData = null;
let currentTransformer = null;
let viewMode = 'tree';

// First, let's create interfaces for type clarity
const TransformerNodeTypes = {
    START: 'start',
    END: 'end'
};

// Data loading
async function loadTransformerData() {
    try {
        const response = await fetch('transformers.json');
        if (!response.ok) {
            throw new Error('Failed to load transformer data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading transformer data:', error);
        document.body.innerHTML = `<div class="error">Error loading transformer data: ${error.message}</div>`;
    }
}

// Timeline rendering function
function renderTransformerChain(transformerTree) {
    const container = document.getElementById('transformer-chain');
    container.innerHTML = '';
    
    function renderNode(node, depth = 0) {
        // Create node element
        const nodeElement = document.createElement('div');
        nodeElement.className = 'transformer-node';
        nodeElement.style.paddingLeft = `${depth * 24}px`;  // 24px = 2 spaces worth of indentation
        nodeElement.id = `transformer-${node.name}-${node.start}`;
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'transformer-content';
        
        // Create name element
        const nameDiv = document.createElement('div');
        nameDiv.className = 'transformer-name';
        nameDiv.textContent = node.name;
        
        // Create timestamp element
        const timeDiv = document.createElement('div');
        timeDiv.className = 'transformer-timestamp';
        timeDiv.textContent = `t+${node.start}ms`;
        
        contentWrapper.appendChild(nameDiv);
        contentWrapper.appendChild(timeDiv);
        nodeElement.appendChild(contentWrapper);
        
        // Add click handler
        nodeElement.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering parent handlers
            const prevTransformerId = `${node.name}Transformer_before_${node.startTimestamp}`;
            const transformerId = `${node.name}Transformer_after_${node.endTimestamp}`;
            // const transformerId = `${node.name}Transformer_after_${node.start}`;
            selectTransformer(transformerId, prevTransformerId);
        };
        
        // Append the node
        container.appendChild(nodeElement);
        
        // Recursively render children
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                renderNode(child, depth + 1);
            }
        }
    }
    
    // Render each root level transformer
    transformerTree.transformers.forEach(node => renderNode(node, 0));
}

// Helper function to flatten tree into timeline
function flattenTreeToTimeline(tree) {
    const events = [];
    
    function processNode(node, parentStartTime = 0) {

        const id = `${node.name}Transformer_after_${node.endTimestamp}`;
        // Add start event
        events.push({
            type: TransformerNodeTypes.START,
            timestamp: node.startTimestamp,
            id: id,
            name: node.name,
            time: node.start,
            parentStartTime
        });
        
        // Process children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                processNode(child, node.start);
            });
        }
        
        // Add end event
        if (node.end !== null) {
            events.push({
                type: TransformerNodeTypes.END,
                timestamp: node.endTimestamp,
                name: node.name,
                time: node.end
            });
        }
    }
    
    // Process all root level transformers
    tree.transformers.forEach(node => processNode(node));
    
    // Sort by timestamp and handle concurrent events
    return events.sort((a, b) => {
        if (a.timestamp === b.timestamp) {
            // If timestamps are equal, prefer:
            // 1. Parent before child
            // 2. Start before end
            if (a.parentStartTime !== b.parentStartTime) {
                return a.parentStartTime - b.parentStartTime;
            }
            return a.type === TransformerNodeTypes.START ? -1 : 1;
        }
        return a.time - b.time;
    });
}

// Build tree from parsed logs
const buildTransformerTree = (transformerData) => {
    // Convert object keys to log entries
    logs = Object.keys(transformerData).map(key => {
        const match = key.match(/(.+?)_(before|after)_(\d+)/);
        if (!match) return null;
        
        return {
            transformer: match[1].replace('Transformer', ''),
            type: match[2],
            timestamp: parseInt(match[3])
        };
    }).filter(entry => entry !== null);


    const sortedLogs = _.sortBy(logs, ['timestamp', log => log.type !== 'before']);
    const startTime = sortedLogs[0]?.timestamp ?? 0;
    
    const root = { transformers: [] };
    const stack = [];
    
    for (const log of sortedLogs) {
        const relativeMs = (log.timestamp - startTime) % 1000;
        
        if (log.type === 'before') {
            const node = {
                name: log.transformer,
                startTimestamp: log.timestamp,
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
                nodeToClose.endTimestamp = log.timestamp;
                nodeToClose.end = relativeMs;
                const idx = stack.indexOf(nodeToClose);
                stack.splice(idx, 1);
            }
        }
    }
    
    return root;
};


// Tree view functions
function createTreeView(data, level = 0) {
    const container = document.createElement('div');
    container.className = 'tree-view';
    
    Object.entries(data).forEach(([key, value]) => {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.style.marginLeft = `${level * 20}px`;
        
        if (typeof value === 'object' && value !== null) {
            const toggle = document.createElement('span');
            toggle.className = 'node-toggle';
            toggle.innerHTML = '&#9656; ';
            toggle.onclick = () => {
                const content = node.querySelector('.node-content');
                toggle.innerHTML = content.style.display === 'none' ? '&#9656; ' : '&#9662; ';
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            };
            
            const keySpan = document.createElement('span');
            keySpan.className = 'node-key';
            keySpan.textContent = key;
            
            node.appendChild(toggle);
            node.appendChild(keySpan);
            
            const content = document.createElement('div');
            content.className = 'node-content';
            content.style.display = 'none';
            content.appendChild(createTreeView(value, level + 1));
            node.appendChild(content);
        } else {
            const keySpan = document.createElement('span');
            keySpan.className = 'node-key';
            keySpan.textContent = `${key}: `;
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'node-value';
            valueSpan.textContent = value;
            
            node.appendChild(keySpan);
            node.appendChild(valueSpan);
        }
        
        container.appendChild(node);
    });
    
    return container;
}

function generateDiff(prev, curr, path = '') {
    const container = document.createElement('div');
    container.className = 'diff-view';
    let hasChanges = false;

    function addLine(content, type) {
        hasChanges = true;
        const line = document.createElement('div');
        line.className = type ? `diff-${type}` : '';
        line.textContent = content;
        container.appendChild(line);
    }

    function compareDeeply(prev, curr, path) {
        const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
        
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const prevValue = prev?.[key];
            const currValue = curr?.[key];

            if (!prev || !(key in prev)) {
                addLine(`+ ${currentPath}: ${JSON.stringify(currValue)}`, 'added');
            } else if (!curr || !(key in curr)) {
                addLine(`- ${currentPath}: ${JSON.stringify(prevValue)}`, 'removed');
            } else if (typeof prevValue === 'object' && typeof currValue === 'object') {
                if (Array.isArray(prevValue) !== Array.isArray(currValue)) {
                    addLine(`- ${currentPath}: ${JSON.stringify(prevValue)}`, 'removed');
                    addLine(`+ ${currentPath}: ${JSON.stringify(currValue)}`, 'added');
                } else {
                    compareDeeply(prevValue, currValue, currentPath);
                }
            } else if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
                addLine(`- ${currentPath}: ${JSON.stringify(prevValue)}`, 'removed');
                addLine(`+ ${currentPath}: ${JSON.stringify(currValue)}`, 'added');
            }
        }
    }
    
    compareDeeply(prev, curr, path);
    
    if (!hasChanges) {
        const noChanges = document.createElement('div');
        noChanges.className = 'diff-message';
        noChanges.textContent = 'No changes in this transformation';
        container.appendChild(noChanges);
    }
    
    return container;
}

// View update functions
function updateCurrentView() {
    const container = document.getElementById('current-view');
    const data = transformerData[currentTransformer].content;
    
    if (viewMode === 'tree') {
        container.innerHTML = '';
        container.appendChild(createTreeView(data));
    } else {
        container.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

function updateDiffView(currentTransformer, prevId) {
    const container = document.getElementById('diff-view');
    
    // if (currentIndex === 0) {
    //     container.innerHTML = '<div class="diff-message">Initial transformation</div>';
    //     return;
    // }
    
    const prevData = transformerData[prevId].content;
    const currentData = transformerData[currentTransformer].content;
    
    // Debug logs
    console.log('Previous id:', prevId);
    console.log('Current id:', currentTransformer);
    console.log('Previous:', prevData);
    console.log('Current:', currentData);
    
    const diff = generateDiff(prevData, currentData);
    
    // Clear and append
    container.innerHTML = '';
    container.appendChild(diff);
}

function setViewMode(mode) {
    viewMode = mode;
    
    // Update buttons
    document.getElementById('btn-tree').classList.toggle('active', mode === 'tree');
    document.getElementById('btn-raw').classList.toggle('active', mode === 'raw');
    
    // Update view
    updateCurrentView();
}

function selectTransformer(id, prevId) {
    currentTransformer = id;
    
    // Update UI
    document.querySelectorAll('.transformer-node').forEach(node => {
        node.classList.remove('active');
    });
    
    const selectedNode = document.getElementById(`transformer-${id}`);
    if (selectedNode) {
        selectedNode.classList.add('active');
        
        // Update header
        const transformer = transformerData[id];
        document.getElementById('current-transformer').textContent = 
            transformer.name || 'Selected Transformer';
        document.getElementById('transformer-time').textContent = 
            `t+${transformer.timestamp}ms`;
    }
    
    // Update views
    updateCurrentView();
    updateDiffView(currentTransformer, prevId);
}

// Initialization
async function init() {
    // Load transformer data
    transformerData = await loadTransformerData();
    if (!transformerData) return;
    
    transformerTree = buildTransformerTree(transformerData);
    renderTransformerChain(transformerTree);

    const transformerKeys = Object.keys(transformerData).map(key => {
        const match = key.match(/(.+?)_(before|after)_(\d+)/);
        if (!match) return null;
        
        return {
            key,
            type: match[2],
            timestamp: parseInt(match[3])
        };
    }).filter(entry => entry !== null);

    // Select first transformer by default
    // const firstTransformer = Object.keys(transformerData)[0];
    const firstTransformer = transformerTree.transformers[0];
    const firstTransformerId = `${firstTransformer.name}Transformer_after_${firstTransformer.endTimestamp}`;
    const prevId = `${firstTransformer.name}Transformer_before_${firstTransformer.startTimestamp}`;
    if (firstTransformer) {
        selectTransformer(firstTransformerId, prevId);
    }
}

// Start the application when loaded
window.onload = init;
