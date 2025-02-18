// static/viewer.js
// viewer.js

// Global state
let transformerData = null;
let currentTransformer = null;
let sortedTransformerKeys = null;
let viewMode = 'tree';

// First, let's create interfaces for type clarity
const TransformerNodeTypes = {
    START: 'start',
    END: 'end'
};

const cleanValue = (val) => {
    // Remove quotes and trim
    val = val.trim().replace(/^["']|["']$/g, '');
  
    // Handle booleans
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  
    // If it looks like a GUID or contains letters, keep as string
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /[a-zA-Z]/.test(val)) {
      return val;
    }
  
    // Try to convert to number if it's a numeric string
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      return Number(val);
    }
  
    return val;
};
  
const parseLevel = (lines, indentLevel = 0) => {
    const result = {};
    let i = 0;
  
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }
  
      if (line === '}') {
        return [result, i];
      }
  
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = cleanValue(valueParts.join(':'));
        const trimmedKey = key.trim();
        
        if (trimmedKey in result) {
          if (!Array.isArray(result[trimmedKey])) {
            result[trimmedKey] = [result[trimmedKey]];
          }
          result[trimmedKey].push(value);
        } else {
          result[trimmedKey] = value;
        }
      } else if (line.includes('{')) {
        const key = line.split('{')[0].trim();
        const [nestedResult, consumed] = parseLevel(lines.slice(i + 1));
  
        if (key in result) {
          if (!Array.isArray(result[key])) {
            result[key] = [result[key]];
          }
          result[key].push(nestedResult);
        } else {
          result[key] = nestedResult;
        }
  
        i += consumed + 1;
      }
  
      i++;
    }
  
    return [result, i];
};

const parseProtoText = (text) => {
    const lines = text.split('\n');
    const [parsed] = parseLevel(lines);
    return parsed;
};

//Input is the content of the trace file
//output is a dictionary of transformers - see transformers.json
function parseTransformers(content) {
    const transformers = {};
    // let currentTransformer = null;
    query_spec_str = '';
    start_capture_query_spec = false;
    //create a stack to keep track of the current transformer
    let transformer_stack = [];
    
    const lines = content.split('\n');
    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      const isLastLine = index === lines.length - 1;
      
      // Start of a transformer
      if (trimmed.includes('::transform"')) {
        const nameMatch = trimmed.match(/name: "(.*?)::transform"/);
        if (nameMatch) {
          let transformer = {
            name: nameMatch[1].split('::')[0],
            start_us: null,
            duration_us: null
          };
          // if (transformer.name == 'WorksheetTransformer') {
              console.log('push', transformer.name);
          // }
          transformer_stack.push(transformer);
        }
      }
      
      // child {
      //   name: "TopSortTransformer::transform"
      //   start_us: 1736268554488374
      //   duration_us: 205
      //   chrono_type: CHRONO_SEQUENTIAL
      //   [callosum.CallosumDebugInfo.trace]
      // Collect timing info
      if (transformer_stack.length > 0) { 
        topTransformer = transformer_stack[transformer_stack.length - 1];
        if (trimmed.startsWith('start_us:') && topTransformer.start_us == null) {
          //update the start_us of the transformer on the top of the stack
          // if (transformer_stack.length > 0) {
          topTransformer.start_us = parseInt(trimmed.split(':')[1].trim());
            if (topTransformer.name === 'WorksheetTransformer') {
              console.log('update', topTransformer.name, topTransformer.start_us);
            }
          // }
        } else if (trimmed.startsWith('duration_us:') && topTransformer.duration_us == null) {
          topTransformer.duration_us = parseInt(trimmed.split(':')[1].trim());
          
          // If we have all info, add to transformers
          // if (currentTransformer.name && currentTransformer.start_us && currentTransformer.duration_us) {
          //   const key = `${currentTransformer.name}_${currentTransformer.start_us}_${currentTransformer.duration_us}`;
          //   transformers[key] = { content: {} };
          //   currentTransformer = null;
          // }
  
          // console.log(content);
        } else if (trimmed.startsWith('query_spec {')) {
          start_capture_query_spec = true
        } else if (isLastLine || 
          trimmed.startsWith('child {') ||
          trimmed.startsWith('[callosum.CallosumDebugInfo.trace] {')) { //todo: or last line in content
  
          // If we have all info, add to transformers
          if (query_spec_str.length > 0 && topTransformer.name && topTransformer.start_us && topTransformer.duration_us) {
            const key1 = `${topTransformer.name}_before_${topTransformer.start_us}`;
            endTimeUS = topTransformer.start_us + topTransformer.duration_us;
            const key2 = `${topTransformer.name}_after_${endTimeUS}`;
            // query_spec_str = query_spec_str.split('\n').slice(0, -4).join('\n');
            query_spec_dict=parseProtoText(query_spec_str);
            transformers[key1] = { content: '' };
            transformers[key2] ={ content: query_spec_dict };
              console.log('pop', topTransformer.name);
              // console.log('STRING');
              // console.log(query_spec_str);
            // if (topTransformer.name == 'WorksheetTransformer') {
              console.log('JSON');
              //remove last two lines from query_spec_str
            //   fs.writeFileSync('last_spec.json', JSON.stringify(query_spec_dict));
            // }
  
            transformer_stack.pop();
            // fs.writeFileSync('last_spec.proto', query_spec_str);
            query_spec_str = '';
            start_capture_query_spec = false;
          }
        }
  
        if (start_capture_query_spec) {
          query_spec_str = query_spec_str + '\n' + trimmed;
        }
      }
    };
    
    // fs.writeFileSync('transformers.json', JSON.stringify(transformers));
    console.log('transformer_stack', transformer_stack);
    return transformers;
}
  
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
    console.log('render transformer chain');
    const container = document.getElementById('transformer-chain');
    container.innerHTML = '';
    
    function renderNode(node, depth = 0) {
        const transformerId = `${node.name}Transformer_after_${node.endTimestamp}`;
        // Create node element
        const nodeElement = document.createElement('div');
        nodeElement.className = 'transformer-node';
        nodeElement.style.paddingLeft = `${depth * 24}px`;  // 24px = 2 spaces worth of indentation
        nodeElement.id = transformerId;
        
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
            idToSearch = `${node.name}Transformer_before_${node.startTimestamp}`;
            const prevTransformerId = sortedTransformerKeys[sortedTransformerKeys.indexOf(idToSearch) - 1];
            
            // const prevTransformerId = `${node.name}Transformer_before_${node.startTimestamp}`;
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
    //create an array of sortedTransformerKeys from sortedLogs
    sortedTransformerKeys = sortedLogs.map(log => `${log.transformer}Transformer_${log.type}_${log.timestamp}`);
    console.log(sortedTransformerKeys);
    const startTime = sortedLogs[0]?.timestamp ?? 0;
    
    const root = { transformers: [] };
    const stack = [];
    
    for (const log of sortedLogs) {
        const relativeMs = (log.timestamp - startTime) / 1000;
        
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
        node.style.marginLeft = '10px';
        
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
    } else if (viewMode === 'resolved-tree') {
        container.innerHTML = '';
        container.appendChild(createTreeView(resolveReferences(data)));
    } else if (viewMode === 'graph') {
        mermaidSpec = generateMermaidSpec(resolveReferences(data));
        container.innerHTML = `<div class="mermaid">${mermaidSpec}</div>`;
        return mermaid.init();

        // getMermaidDiagram(data)
        // .then(mermaidDiagram => {
        //     container.innerHTML = `<div class="mermaid">${mermaidDiagram}</div>`;
        //     return mermaid.init();
        // })
        // .catch(error => {
        //     console.error('Error rendering Mermaid diagram:', error);
        //     container.innerHTML = `<div class="error">Error rendering diagram: ${error.message}</div>`;
        // });
    } else {
        container.innerHTML = `<pre>${JSON.stringify(resolveReferences(data), null, 2)}</pre>`;
        container.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

function updateDiffView(currentTransformer, prevId) {
    const container = document.getElementById('diff-view');
    
    const prevContent = JSON.stringify(transformerData[prevId].content, null, 2);
    const currentContent = JSON.stringify(transformerData[currentTransformer].content, null, 2);
    
    const diff = Diff.createPatch(
        "Query spec changes:",
        prevContent,
        currentContent,
        "", // Optional: previous file header lines
        "", // Optional: current file header lines,
        {
            context: 1000 // Number of lines of context around changes (adjust as needed)
        }
    );

    const diffHtml = Diff2Html.html(diff, {
        drawFileList: false,
        matching: 'none',
        outputFormat: 'side-by-side',
        renderNothingWhenEmpty: false
    });

    container.innerHTML = diffHtml;
}

// function updateDiffView(currentTransformer, prevId) {
//     const container = document.getElementById('diff-view');
//     container.innerHTML = '';

//     // Create side-by-side container
//     const sideContainer = document.createElement('div');
//     sideContainer.className = 'side-by-side-container';

//     const prevContent = transformerData[prevId].content;
//     const currentContent = transformerData[currentTransformer].content;

//     // Convert objects to formatted JSON strings
//     const prevLines = JSON.stringify(prevContent, null, 2).split('\n');
//     const currentLines = JSON.stringify(currentContent, null, 2).split('\n');

//     // Create panes with access to both line arrays
//     const prevPane = createDiffPane('Previous Step', prevLines, currentLines, true);
//     const currentPane = createDiffPane('Current Step', currentLines, prevLines, false);

//     sideContainer.appendChild(prevPane);
//     sideContainer.appendChild(currentPane);
//     container.appendChild(sideContainer);
// }

function createDiffPane(title, lines, compareLines, isPrev) {
    const pane = document.createElement('div');
    pane.className = 'diff-pane';

    const header = document.createElement('div');
    header.className = 'diff-header';
    header.textContent = title;
    pane.appendChild(header);

    const content = document.createElement('div');
    content.className = 'diff-content';

    const pre = document.createElement('pre');
    pre.className = 'diff-pre';

    lines.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'diff-line';

        // Add line number
        const lineNum = document.createElement('span');
        lineNum.className = 'diff-line-number';
        lineNum.textContent = (index + 1).toString();
        lineDiv.appendChild(lineNum);

        // Add line content
        const lineContent = document.createElement('span');
        lineContent.className = 'diff-line-content';
        lineContent.textContent = line;
        lineDiv.appendChild(lineContent);

        // Determine if line is added/removed/unchanged
        if (!compareLines.includes(line)) {
            lineDiv.classList.add(isPrev ? 'diff-removed' : 'diff-added');
        }

        pre.appendChild(lineDiv);
    });

    content.appendChild(pre);
    pane.appendChild(content);
    return pane;
}

function renderTreeWithHighlights(content, compareContent) {
    const container = document.createElement('div');
    container.className = 'tree-view';
    
    function renderNode(key, value, compareTo = null, path = '') {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';
        
        // Determine if this node has changed
        if (compareTo !== null) {
            if (!(key in compareTo)) {
                nodeDiv.classList.add('diff-added');
            } else if (JSON.stringify(value) !== JSON.stringify(compareTo[key])) {
                nodeDiv.classList.add('diff-modified');
            }
        }
        
        if (typeof value === 'object' && value !== null) {
            // Object/Array node
            const keySpan = document.createElement('span');
            keySpan.className = 'node-key';
            keySpan.textContent = key;
            
            const toggle = document.createElement('span');
            toggle.className = 'node-toggle';
            toggle.innerHTML = '&#9656; ';
            toggle.onclick = () => {
                const content = nodeDiv.querySelector('.node-content');
                toggle.innerHTML = content.style.display === 'none' ? '&#9656; ' : '&#9662; ';
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            };
            
            nodeDiv.appendChild(toggle);
            nodeDiv.appendChild(keySpan);
            
            const content = document.createElement('div');
            content.className = 'node-content';
            content.style.display = 'none';
            
            const compareObj = compareTo?.[key] ?? null;
            Object.entries(value).forEach(([k, v]) => {
                content.appendChild(renderNode(k, v, compareObj, `${path}.${k}`));
            });
            
            nodeDiv.appendChild(content);
        } else {
            // Leaf node
            const keySpan = document.createElement('span');
            keySpan.className = 'node-key';
            keySpan.textContent = `${key}: `;
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'node-value';
            valueSpan.textContent = JSON.stringify(value);
            
            nodeDiv.appendChild(keySpan);
            nodeDiv.appendChild(valueSpan);
        }
        
        return nodeDiv;
    }
    
    Object.entries(content).forEach(([key, value]) => {
        container.appendChild(renderNode(key, value, compareContent?.[key], key));
    });
    
    return container;
}

function setViewMode(mode) {
    viewMode = mode;
    
    // Update buttons
    document.getElementById('btn-tree').classList.toggle('active', mode === 'tree');
    document.getElementById('btn-resolved-tree').classList.toggle('active', mode === 'resolved-tree');
    document.getElementById('btn-raw').classList.toggle('active', mode === 'raw');
    document.getElementById('btn-graph').classList.toggle('active', mode === 'graph');
    
    // Update view
    updateCurrentView();
}

function selectTransformer(id, prevId) {
    console.log('select transformer:', id, prevId);
    currentTransformer = id;
    
    // Update UI
    document.querySelectorAll('.transformer-node').forEach(node => {
        node.classList.remove('active');
    });
    
    const selectedNode = document.getElementById(`${id}`);
    if (selectedNode) {
        selectedNode.classList.add('active');
        
        // Update header
        const transformer = transformerData[id];
        // document.getElementById('current-transformer').textContent = 
        //     transformer.name || 'Selected Transformer';
        // document.getElementById('transformer-time').textContent = 
        //     `t+${transformer.timestamp}ms`;
    }
    
    // Update views
    updateCurrentView();
    updateDiffView(currentTransformer, prevId);
}

// File upload handler
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = file.name;
    
    try {
        // Method 1: Using File API (modern approach)
        const content = await file.text();
        transformerData = parseTransformers(content)
        loadTransformerJSONData();

    } catch (error) {
        console.error('Error reading file:', error);
        // You might want to show an error message to the user here
    }
}

function loadTransformerJSONData() {
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

function copyContent() {
    const currentView = document.getElementById('current-view');
    const copyButton = document.getElementById('copy-button');
    let contentToCopy;

    if (viewMode === 'resolved-tree') {
        data = resolveReferences(transformerData[currentTransformer].content);
    } else {
        data = transformerData[currentTransformer].content;
    }

    if (currentTransformer && transformerData[currentTransformer]) {
        contentToCopy = JSON.stringify(data, null, 2);
    }

    if (contentToCopy) {
        // Copy to clipboard
        navigator.clipboard.writeText(contentToCopy).then(() => {
            // Show success state
            copyButton.classList.add('success');
            copyButton.textContent = 'Copied!';

            // Reset button after 2 seconds
            setTimeout(() => {
                copyButton.classList.remove('success');
                copyButton.textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Show error state
            copyButton.textContent = 'Failed to copy';
            setTimeout(() => {
                copyButton.textContent = 'Copy';
            }, 2000);
        });
    }
}

// Initialization
async function init() {
    const traceId = getUrlParameter('traceId');
    
    if (traceId) {
        try {
            document.getElementById('file-name').textContent = traceId;
            const traceData = await getTraceById(traceId);
            if (traceData) {
                console.log('Found trace data for ID:', traceId);
                transformerData = parseTransformers(traceData);
                loadTransformerJSONData();
            } else {
                console.log('No trace data found for ID:', traceId);
            }
        } catch (error) {
            console.error('Error loading from IndexedDB:', error);
        }
    }

    document.getElementById('file-upload').addEventListener('change', handleFileUpload);

    // Load transformer data
    // transformerData = await loadTransformerData();
    // if (!transformerData) return;
    
    // loadTransformerJSONData();
    // document.addEventListener('DOMContentLoaded', function() {
        const handle = document.getElementById('resize-handle');
        const queryPanel = document.querySelector('.query-panel');
        let isResizing = false;
        let startY;
        let startHeight;
    
        handle.addEventListener('mousedown', function(e) {
            isResizing = true;
            startY = e.clientY;
            startHeight = queryPanel.offsetHeight;
            
            // Add temporary event listeners
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            
            // Prevent text selection while resizing
            document.body.style.userSelect = 'none';
        });
    
        function onMouseMove(e) {
            if (!isResizing) return;
    
            const deltaY = e.clientY - startY;
            const newHeight = Math.max(100, startHeight + deltaY); // Minimum 100px height
            
            queryPanel.style.flex = 'none';
            queryPanel.style.height = newHeight + 'px';
        }
    
        function onMouseUp() {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        }
    // });
}

// Start the application when loaded
window.onload = init;

