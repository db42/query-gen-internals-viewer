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
        node.textContent = data.name;
        node.onclick = () => selectTransformer(id);
        
        container.appendChild(node);
        
        // Add arrow if not last
        if (index < transformers.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'transformer-arrow';
            arrow.textContent = '→';
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
            toggle.textContent = '▶ ';
            toggle.onclick = () => {
                const content = node.querySelector('.node-content');
                toggle.textContent = content.style.display === 'none' ? '▶ ' : '▼ ';
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

// Diff view functions
function generateDiff(prev, curr, path = '') {
    const container = document.createElement('div');
    container.className = 'diff-view';
    
    function addLine(content, type) {
        const line = document.createElement('div');
        line.className = type ? `diff-${type}` : '';
        line.textContent = content;
        container.appendChild(line);
    }
    
    function compareDeeply(prev, curr, path) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (!(key in prev)) {
                addLine(`+ ${currentPath}: ${JSON.stringify(curr[key])}`, 'added');
            } else if (!(key in curr)) {
                addLine(`- ${currentPath}: ${JSON.stringify(prev[key])}`, 'removed');
            } else if (typeof prev[key] === 'object' && typeof curr[key] === 'object') {
                compareDeeply(prev[key], curr[key], currentPath);
            } else if (prev[key] !== curr[key]) {
                addLine(`- ${currentPath}: ${JSON.stringify(prev[key])}`, 'removed');
                addLine(`+ ${currentPath}: ${JSON.stringify(curr[key])}`, 'added');
            }
        }
    }
    
    compareDeeply(prev, curr, path);
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
    
    const prevData = transformers[currentIndex - 1][1].content;
    const currentData = transformers[currentIndex][1].content;
    
    const diff = generateDiff(prevData, currentData);
    container.innerHTML = '';
    container.appendChild(diff);
}

// Event handlers
function selectTransformer(id) {
    currentTransformer = id;
    
    // Update UI
    document.querySelectorAll('.transformer-node').forEach(node => {
        node.classList.remove('active');
    });
    document.querySelector(`div[onclick="selectTransformer('${id}')"]`)
        .classList.add('active');
    
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
