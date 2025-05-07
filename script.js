const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let nodes = [];
let edges = [];
let selectedNode = null;
let tempEdgeStart = null;
let mode = 'none'; // 'add-node', 'add-edge', 'remove'

let visited = new Set();
let bfsVisited = new Set();
let inTime = {};
let outTime = {};
let time = 0;
let dfsStack = [];
let dfsQueue = [];
let activeNodes = []; // for Stack visualization
let bfsQueue = [];
let bfsSteps = [];
let processing = false;
let stepMode = false;
let animationSpeed = 1000;



class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.color = '#4CAF50';
        this.status = 'unvisited'; // 'unvisited', 'visiting', 'visited'
        this.inTime = null;
        this.outTime = null;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id, this.x, this.y);

        if (this.inTime !== null || this.outTime !== null) {
            ctx.font = '12px Arial';
            
            if (this.inTime !== null) {
                ctx.fillStyle = '#fff';
                ctx.fillText(`In: ${this.inTime}`, this.x, this.y - 8);
            }
            
            if (this.outTime !== null) {
                ctx.fillStyle = '#fff';
                ctx.fillText(`Out: ${this.outTime}`, this.x, this.y + 8);
            }
        }
    }

    contains(x, y) {
        const dx = this.x - x;
        const dy = this.y - y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    setStatus(status) {
        this.status = status;
        switch (status) {
            case 'unvisited':
                this.color = '#4CAF50';
                break;
            case 'visiting':
                this.color = '#FF9800';
                break;
            case 'visited':
                this.color = '#2196F3';
                break;
        }
    }
}

class Edge {
    constructor(source, target) {
        this.source = source;
        this.target = target;
        this.color = '#FFFFFF';
        this.width = 2;
        this.visited = false;
    }

    draw() {
        const sourceNode = nodes.find(n => n.id === this.source);
        const targetNode = nodes.find(n => n.id === this.target);

        if (!sourceNode || !targetNode) return;

        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = this.visited ? '#FF5722' : this.color;
        ctx.lineWidth = this.width;
        ctx.stroke();

        const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
        const arrowSize = 12;
        
        const arrowX = targetNode.x - targetNode.radius * Math.cos(angle);
        const arrowY = targetNode.y - targetNode.radius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = this.visited ? '#FF5722' : this.color;
        ctx.fill();
    }

    isNear(x, y, threshold = 10) {
        const sourceNode = nodes.find(n => n.id === this.source);
        const targetNode = nodes.find(n => n.id === this.target);

        if (!sourceNode || !targetNode) return false;

        const A = x - sourceNode.x;
        const B = y - sourceNode.y;
        const C = targetNode.x - sourceNode.x;
        const D = targetNode.y - sourceNode.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        
        if (len_sq !== 0) param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = sourceNode.x;
            yy = sourceNode.y;
        } else if (param > 1) {
            xx = targetNode.x;
            yy = targetNode.y;
        } else {
            xx = sourceNode.x + param * C;
            yy = sourceNode.y + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= threshold;
    }

    setVisited(value) {
        this.visited = value;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (tempEdgeStart !== null && mode === 'add-edge') {
        const startNode = nodes.find(n => n.id === tempEdgeStart);
        if (startNode) {
            ctx.beginPath();
            ctx.moveTo(startNode.x, startNode.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    edges.forEach(edge => edge.draw());

    nodes.forEach(node => node.draw());
}

// function createRandomGraph() {
//     resetGraph();
    
//     const numNodes = 5 + Math.floor(Math.random() * 4); // 5~8 nodes
//     const padding = 100;
    
//     for (let i = 0; i < numNodes; i++) {
//         const x = padding + Math.random() * (canvas.width - 2 * padding);
//         const y = padding + Math.random() * (canvas.height - 2 * padding);
//         nodes.push(new Node(i + 1, x, y));
//     }
    
//     const edgeProb = 0.3; // 降低邊的機率，增加產生多個連通分量的可能性 (By Claude)
//     for (let i = 0; i < numNodes; i++) {
//         for (let j = 0; j < numNodes; j++) {
//             if (i !== j && Math.random() < edgeProb) {
//                 if (!edges.some(e => e.source === i + 1 && e.target === j + 1)) {
//                     edges.push(new Edge(i + 1, j + 1));
//                 }
//             }
//         }
//     }
    
//     draw();
//     // log('Random graph created');
// }

// 重置圖
function resetGraph() {
    nodes = [];
    edges = [];
    resetDFS();
    draw();
    // log('Clean');
}

function resetDFS() {
    visited = new Set();
    inTime = {};
    outTime = {};
    time = 0;
    dfsStack = [];
    dfsQueue = [];
    activeNodes = [];
    processing = false;
    
    nodes.forEach(node => {
        node.setStatus('unvisited');
        node.inTime = null;
        node.outTime = null;
    });
    
    edges.forEach(edge => edge.setVisited(false));
    
    document.getElementById('step-dfs').disabled = true;
    updateQueueVisualization();
    draw();
    // log('Reset');
    updateButtonStates();
}

function runDFS() {
    if (nodes.length === 0) {
        // log('Empty graph');
        return;
    }
    
    resetDFS();
    processing = true;
    stepMode = false;
    document.getElementById('step-dfs').disabled = false;
    
    // log('Start DFS');
    
    generateAllDFSSteps();
    
    animateDFS();
    updateButtonStates();
}
function updateQueueVisualization() {
    const queueContainer = document.getElementById('queue-container');
    const title = document.getElementById('queue-title');

    queueContainer.innerHTML = '';

    if (activeNodes.length === 0) {
        queueContainer.innerHTML = '<div class="empty-queue">EMPTY</div>';
    } else {
        const queueElement = document.createElement('div');
        queueElement.className = 'queue';

        activeNodes.forEach(nodeId => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'queue-node';
            nodeElement.textContent = nodeId;
            queueElement.appendChild(nodeElement);
        });

        queueContainer.appendChild(queueElement);
    }

    // ✅ 標題決定邏輯
    if (processing) {
        if (dfsQueue.length > 0 || stepMode && bfsQueue.length === 0) {
            title.textContent = 'Stack for DFS';
        } else if (bfsQueue.length > 0) {
            title.textContent = 'Queue for BFS';
        } else {
            title.textContent = 'Stack / Queue';
        }
    } else {
        title.textContent = 'Stack / Queue';
    }
}



function generateAllDFSSteps() {
    dfsQueue = [];
    
    const nodeIds = nodes.map(node => node.id);
    
    const visitedNodes = new Set();
    
    function dfs(nodeId) {
        time++;
        visitedNodes.add(nodeId);
        dfsQueue.push({
            type: 'visit',
            nodeId: nodeId,
            time: time
        });
        
        const neighbors = getNeighbors(nodeId);
        
        for (const neighbor of neighbors) {
            if (!visitedNodes.has(neighbor)) {
                dfsQueue.push({
                    type: 'explore-edge',
                    source: nodeId,
                    target: neighbor
                });
                dfs(neighbor);
            }
        }
        
        time++;
        dfsQueue.push({
            type: 'leave',
            nodeId: nodeId,
            time: time
        });
    }
    
    for (const nodeId of nodeIds) {
        if (!visitedNodes.has(nodeId)) {
            if (visitedNodes.size > 0) {
                // log(`Start ${nodeId}`);
                dfsQueue.push({
                    type: 'new-component',
                    nodeId: nodeId
                });
            } else {
                // log(`Start ${nodeId}`);
            }
            dfs(nodeId);
        }
    }
    
    visited = new Set();
    time = 0;
}

function generateAllBFSSteps() {
    bfsSteps = [];
    bfsVisited = new Set();

    const nodeIds = nodes.map(node => node.id);
    for (const startId of nodeIds) {
        if (!bfsVisited.has(startId)) {
            const q = [startId];
            bfsVisited.add(startId);
            bfsSteps.push({ type: 'visit', nodeId: startId });

            while (q.length > 0) {
                const curr = q.shift();

                const neighbors = getNeighbors(curr);
                for (const neighbor of neighbors) {
                    if (!bfsVisited.has(neighbor)) {
                        bfsVisited.add(neighbor);
                        bfsSteps.push({ type: 'explore-edge', source: curr, target: neighbor });
                        bfsSteps.push({ type: 'visit', nodeId: neighbor });
                        q.push(neighbor);
                    }
                }

                bfsSteps.push({ type: 'leave', nodeId: curr });
            }
        }
    }

    bfsQueue = [...bfsSteps];
    activeNodes = [];
}


function getNeighbors(nodeId) {
    const neighbors = [];
    edges.forEach(edge => {
        if (edge.source === nodeId) {
            neighbors.push(edge.target);
        }
    });
    return neighbors;
}

function animateDFS() {
    if (!processing || dfsQueue.length === 0) {
        if (processing) {
            processing = false;
            // log('Finish');
        }
        return;
    }
    
    const step = dfsQueue.shift();
    
    if (step.type === 'visit') {
        const node = nodes.find(n => n.id === step.nodeId);
        if (node) {
            visited.add(step.nodeId);
            inTime[step.nodeId] = step.time;
            node.inTime = step.time;
            node.setStatus('visiting');
            // log(`In ${step.nodeId}`);
            
            activeNodes.push(step.nodeId);
            updateQueueVisualization();
        }
    } else if (step.type === 'leave') {
        const node = nodes.find(n => n.id === step.nodeId);
        if (node) {
            outTime[step.nodeId] = step.time;
            node.outTime = step.time;
            node.setStatus('visited');
            // log(`Out ${step.nodeId}`);

            const index = activeNodes.indexOf(step.nodeId);
            if (index !== -1) {
                activeNodes.splice(index, 1);
                updateQueueVisualization();
            }
        }
    } else if (step.type === 'explore-edge') {
        const edge = edges.find(e => e.source === step.source && e.target === step.target);
        if (edge) {
            edge.setVisited(true);
            // log(`Visited ${step.source} -> ${step.target}`);
        }
    } else if (step.type === 'new-component') {
        // log(`Start ${step.nodeId}`);
    }
    
    draw();
    
    if (!stepMode) {
        setTimeout(() => animateDFS(), animationSpeed);
    }
    updateButtonStates();
}

function animateBFS() {
    if (!processing || bfsQueue.length === 0) {
        if (processing) processing = false;
        return;
    }

    const step = bfsQueue.shift();

    if (step.type === 'visit') {
        const node = nodes.find(n => n.id === step.nodeId);
        if (node) {
            node.setStatus('visiting');
            activeNodes.push(step.nodeId);
            updateQueueVisualization();
        }
    } else if (step.type === 'leave') {
        const node = nodes.find(n => n.id === step.nodeId);
        if (node) {
            node.setStatus('visited');
            const index = activeNodes.indexOf(step.nodeId);
            if (index !== -1) activeNodes.splice(index, 1);
            updateQueueVisualization();
        }
    } else if (step.type === 'explore-edge') {
        const edge = edges.find(e => e.source === step.source && e.target === step.target);
        if (edge) edge.setVisited(true);
    }

    draw();
    if (!stepMode) setTimeout(() => animateBFS(), animationSpeed);
    updateButtonStates();
}



function stepDFS() {
    if (!processing) {
        processing = true;
        stepMode = true;
        
        if (dfsQueue.length === 0) {
            // log('Go to next step');
            generateAllDFSSteps();
        }
    }
    
    animateDFS();
}

function stepBFS() {
    if (!processing) {
        processing = true;
        stepMode = true;

        if (bfsQueue.length === 0) {
            generateAllBFSSteps();
        }
    }

    animateBFS();
}


// DEBUGING
// function log(message) {
//     const logElement = document.getElementById('log');
//     const timestamp = new Date().toLocaleTimeString();
//     logElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;
//     logElement.scrollTop = logElement.scrollHeight;
// }

let mouseX = 0;
let mouseY = 0;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    if (mode === 'add-edge' && tempEdgeStart !== null) {
        draw();
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (mode === 'add-node') {
        addNode(x, y);
    } else if (mode === 'add-edge') {
        handleEdgeCreation(x, y);
    } else if (mode === 'remove') {
        removeElement(x, y);
    }
});

function addNode(x, y) {
    for (const node of nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < node.radius * 2) {
            // log('Too Close to existing node');
            return;
        }
    }
    
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    nodes.push(new Node(newId, x, y));
    // log(`Add ${newId}`);
    draw();
}

function handleEdgeCreation(x, y) {
    const clickedNode = nodes.find(node => node.contains(x, y));
    
    if (clickedNode) {
        if (tempEdgeStart === null) {
            tempEdgeStart = clickedNode.id;
            // log(`Start ${clickedNode.id}`);
        } else {
            if (tempEdgeStart === clickedNode.id) {
                // log('Not allow self-loop');
                tempEdgeStart = null;
                return;
            }
            
            if (edges.some(e => e.source === tempEdgeStart && e.target === clickedNode.id)) {
                // log('Exist edge');
                tempEdgeStart = null;
                return;
            }
            
            edges.push(new Edge(tempEdgeStart, clickedNode.id));
            // log(`Add ${tempEdgeStart} -> ${clickedNode.id}`);
            tempEdgeStart = null;
        }
        draw();
    }
}

function removeElement(x, y) {
    const nodeIndex = nodes.findIndex(node => node.contains(x, y));
    
    if (nodeIndex !== -1) {
        const nodeId = nodes[nodeIndex].id;
        
        edges = edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
        
        nodes.splice(nodeIndex, 1);
        // log(`Remove node ${nodeId}`);
    } else {
        const edgeIndex = edges.findIndex(edge => edge.isNear(x, y));
        
        if (edgeIndex !== -1) {
            const edge = edges[edgeIndex];
            edges.splice(edgeIndex, 1);
            // log(`Remove ${edge.source} -> ${edge.target}`);
        }
    }
    
    draw();
}



// document.getElementById('create-graph').addEventListener('click', createRandomGraph);
document.getElementById('reset').addEventListener('click', resetGraph);
document.getElementById('run-dfs').addEventListener('click', runDFS);
document.getElementById('step-dfs').addEventListener('click', stepDFS);
document.getElementById('run-bfs').addEventListener('click', () => {
    resetDFS();
    processing = true;
    stepMode = false;
    document.getElementById('step-bfs').disabled = false;
    generateAllBFSSteps();
    animateBFS();
    updateButtonStates();
});
document.getElementById('step-bfs').addEventListener('click', stepBFS);

document.getElementById('add-node').addEventListener('click', () => {
    mode = mode === 'add-node' ? 'none' : 'add-node';
    updateModeUI();
    tempEdgeStart = null;
    // log(mode === 'add-node' ? 'Yes' : 'No');
});

document.getElementById('add-edge').addEventListener('click', () => {
    mode = mode === 'add-edge' ? 'none' : 'add-edge';
    updateModeUI();
    tempEdgeStart = null;
    // log(mode === 'add-edge' ? 'Yes' : 'No');
});

document.getElementById('remove').addEventListener('click', () => {
    mode = mode === 'remove' ? 'none' : 'remove';
    updateModeUI();
    tempEdgeStart = null;
    // log(mode === 'remove' ? 'Yes' : 'No');
});

function updateModeUI() {
    const addNodeBtn = document.getElementById('add-node');
    const addEdgeBtn = document.getElementById('add-edge');
    const removeBtn = document.getElementById('remove');

    addNodeBtn.classList.toggle('active-btn', mode === 'add-node');
    addEdgeBtn.classList.toggle('active-btn', mode === 'add-edge');
    removeBtn.classList.toggle('active-btn', mode === 'remove');
}

function updateButtonStates() {
    const runDFSBtn = document.getElementById('run-dfs');
    const stepDFSBtn = document.getElementById('step-dfs');
    const runBFSBtn = document.getElementById('run-bfs');
    const stepBFSBtn = document.getElementById('step-bfs');

    if (processing) {
        const runningDFS = dfsQueue.length > 0;
        const runningBFS = bfsQueue.length > 0;

        runDFSBtn.disabled = runningBFS;
        stepDFSBtn.disabled = runningBFS;

        runBFSBtn.disabled = runningDFS;
        stepBFSBtn.disabled = runningDFS;
    } else {
        runDFSBtn.disabled = false;
        stepDFSBtn.disabled = dfsQueue.length === 0;

        runBFSBtn.disabled = false;
        stepBFSBtn.disabled = bfsQueue.length === 0;
    }
}


resetDFS();
updateButtonStates();