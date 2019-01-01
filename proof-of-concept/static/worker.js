// store resolve function for outstanding requests
let outbox = {};

let MPI_JS = {};

// assumes id will not have conflicting ids
self.onmessage = function(ev) {
    let id = ev.data.id;
    
    // resolve the promise with this id
    outbox[id](ev.data.value);
}

function getId(comm, rank) {
    // generate a key for this function call
    let id = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[id] = resolve;
        
        // after the resolve function is registered to the id, request the result
        self.postMessage({id: id, op: 'getId', args: {comm: comm, rank: rank}});
    });
}

function getRank(comm) {
    // generate a key for this function call
    let id = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[id] = resolve;
        
        // after the resolve function is registered to the id, request the result
        self.postMessage({id: id, op: 'getRank', args: {comm: comm}});
    });
}

function getSize(comm) {
    // generate a key for this function call
    let id = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[id] = resolve;
        
        // after the resolve function is registered to the id, request the result
        self.postMessage({id: id, op: 'getSize', args: {comm: comm}});
    });
}

async function isend(data, dest, comm, tag=null) {
    // generate a key for this function call
    let id = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[id] = resolve;
        
        // after the resolve function is registered to the id, request the result
        self.postMessage({id: id, op: 'isend', args: {data: data, dest: dest, comm: comm, tag: tag}});
    });
}

async function irecv(source, comm, tag=null) {
    // generate a key for this function call
    let id = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[id] = resolve;
        
        // after the resolve function is registered to the id, request the result
        self.postMessage({id: id, op: 'irecv', args: {source: source, comm: comm, tag: tag}});
    });
}


// barrier between node executions in a given communication group
async function barrier(comm) {
    await ibcast('barrier', 0, comm);
    
    return;
}

 
// broadcast a value from a root node to all nodes in a group
/**
    @param data : the value to broadcast (only used if rank === 0)
    @param root : the node with the data
    @param comm : the communication group to broadcast across
*/
async function ibcast(data, root, comm) {
    if (getRank(comm) === root) {
        // get list of other nodes to send
        let nodes = [...Array(getSize(comm)).keys()].filter((val) => val !== root);
        
        // send to other nodes
        let reqs = [];
        nodes.forEach((rank) => {
            let req = isend(data, rank, comm);
            reqs.push(req);
        });
        
        return Promise.all(reqs).then((val) => {return data});
        
    } else {
        // receive from root
        // TODO consider making a bcast tag?
        let res = irecv(root, comm);
        
        return res;
        
    }
}
 
 
// scatter an array from a root node to all nodes in a group
/**
    @param sendArr : the array to send across the communication group (only used if rank === root)
    @param numEls : the number of elements to send to each node
    @param root : the node to send from
    @param comm : the communication group to send array over
    
    returns a slice of the given array to each node
*/
function iscatter(sendArr, root, comm, tag=null) {
    
    let rank = getRank(comm);
    let commSize = getSize(comm);
    
    if (getRank(comm) === root) {
        
        if (!Array.isArray(sendArr)) {
            console.error("Argument sendArr in scatter must be an array");
            return;
        }
        
        // get list of nodes to send to
        let nodes = [...Array(commSize).keys()];
        
        // currIdx is the next idx in sendArr to be sent
        let currIdx = 0; // remaining = sendArr.length - currIdx
        let numEls = Math.max(1, Math.floor(sendArr.length / nodes.length));
        
        // get own result
        let res = sendArr.slice(0,numEls);
        
        // remove root from nodes list and increment currIdx by the number of els sent
        currIdx += numEls;
        nodes = nodes.filter((el) => el !== root);
        
        // send to others
        let reqs = [];
        while (nodes.length > 0) {
            // update numEls
            numEls = Math.max(1, Math.floor((sendArr.length - currIdx) / nodes.length));
            
            let req = isend(sendArr.slice(currIdx, currIdx + numEls), nodes[0], comm);
            reqs.push(req);
            
            // after sending to a new node, update the index and remove this node from the nodes list
            currIdx += numEls;
            nodes.shift();
        }
        
        // return this node's result when all sends have been acked
        return Promise.all(reqs).then((val) => {return res}); 
        
    } else {
        // receive from root
        return irecv(root, comm);
    }
    
}



// reduce values using a given binary operation
async function ireduce(sendArr, op, comm) {
    
    // do local reduction
    let local = sendArr.reduce(op);
    
    // for trivial case that only 1 node is in the communicating group, return local sum
    if (getSize(comm) === 1) {
        return local;
    }
    
    // get the reduction down to a power of 2
    let size = getSize(comm);
    let rank = getRank(comm);
    let twoSize = Math.pow(2, Math.floor(Math.log(size) / Math.log(2)));
    let extraSize = size - twoSize;
    
    let extraNodes = [...Array(extraSize).keys()].map((val) => size - 1 - val);
    
    // send the extra vals to the previous nodes with extraSize as the offset
    if (rank >= twoSize) {
        
        let status = isend(sendArr, rank - extraSize, comm);
        
    } else if (rank > size - extraSize) {
        let arr = await irecv(rank + extraSize, comm);
        
        let agg = arr.reduce(op);
        
        local = op(local, agg);
    }
    
    await barrier(comm);
    
    // update size to be twoSize since we have trimmed extras
    // TODO consider making a new communication group with just the power of 2 so that other nodes are freed
    size = twoSize;
    
    // recursive halving as we apply the given binary operation, 'op'
    for (let offset = size / 2; offset >= 1; offset /= 2) {
        
        if (rank >= offset && rank < size) {
            let status = isend(local, rank - offset, comm);
        } else if (rank < offset){
            let remote = await irecv(rank + offset, comm);
            local = op(local, remote);
        }
        
        await barrier(comm);
    }
    
    if (rank === 0) {
        return local;
    }
}