// static/viewer.js

// Global state
let transformerData = null;
let currentTransformer = null;
let viewMode = 'tree';

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

// Timeline functions
function renderTransformerChain() {
    const container = document.getElementById('transformer-chain');
    const transformers = Object.entries(transformerData)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    transformers.forEach(([id, data], index) => {
        // Create transformer node
        const node = document.createElement('div');
        node.className = 'transformer-node';
        node.id = `transformer-${id}`;
        
        // Add name and timestamp
        const nameSpan = document.createElement('div');
        nameSpan.textContent = data.name;
        nameSpan.className = 'transformer-name';
        
        const timeSpan = document.createElement('div');
        timeSpan.textContent = `t+${data.timestamp - transformers[0][1].timestamp}ms`;
        timeSpan.className = 'transformer-timestamp';
        
        node.appendChild(nameSpan);
        node.appendChild(timeSpan);
        node.onclick = () => selectTransformer(id);
        
        container.appendChild(node);
        
        if (index < transformers.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'transformer-arrow';
            arrow.innerHTML = '&rarr;';
            container.appendChild(arrow);
        }
    });
 }

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

function updateDiffView() {
    const container = document.getElementById('diff-view');
    const transformers = Object.entries(transformerData)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const currentIndex = transformers.findIndex(([id]) => id === currentTransformer);
    
    if (currentIndex === 0) {
        container.innerHTML = '<div class="diff-message">Initial transformation</div>';
        return;
    }
    
    const prevId = transformers[currentIndex - 1][0];
    const prevData = transformerData[prevId].content;
    const currentData = transformerData[currentTransformer].content;
    
    // Debug logs
    console.log('Previous:', prevData);
    console.log('Current:', currentData);
    
    const diff = generateDiff(prevData, currentData);
    
    // Clear and append
    container.innerHTML = '';
    container.appendChild(diff);
}

// Event handlers
function selectTransformer(id) {
    currentTransformer = id;
    
    // Update UI - use the unique id to find the element
    document.querySelectorAll('.transformer-node').forEach(node => {
        node.classList.remove('active');
    });
    
    const selectedNode = document.getElementById(`transformer-${id}`);
    if (selectedNode) {
        selectedNode.classList.add('active');
    }
    
    // Update header
    document.getElementById('current-transformer').textContent = 
        `Current Transformer: ${transformerData[id].name}`;
    
    // Update views
    updateCurrentView();
    updateDiffView();
}

function setViewMode(mode) {
    viewMode = mode;
    
    // Update buttons
    document.getElementById('btn-tree').classList.toggle('active', mode === 'tree');
    document.getElementById('btn-raw').classList.toggle('active', mode === 'raw');
    
    // Update view
    updateCurrentView();
}

// Initialization
async function init() {
    // Load transformer data
    transformerData = await loadTransformerData();
    if (!transformerData) return;
    
    renderTransformerChain();
    
    // Select first transformer by default
    const firstTransformer = Object.keys(transformerData)[0];
    if (firstTransformer) {
        selectTransformer(firstTransformer);
    }
}

// Start the application when loaded
window.onload = init;
