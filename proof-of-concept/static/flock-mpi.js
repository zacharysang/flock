mpi = {};

// store resolve function for outstanding requests
let outbox = {};

// get reference for function to send messages to the main thread
let postMessage;

// if running in node, postMessage = WorkerThread.parentPort.postMessage
if (typeof window === 'undefined') {
    
    const WorkerThread = require('worker_threads');
    
    // make sure this is inside a worker
    if (WorkerThread.isMainThread) {
        throw "Invalid Context: Node main thread";
    }
    
    let parentPort = WorkerThread.parentPort;
    
    postMessage = (data) => {parentPort.postMessage(data)};
    
    parentPort.on('message', (data) => {
                    let key = data.key;
                
                    // resolve the promise with this key value
                    outbox[key](data.value);
                
                    // clear the entry
                    delete outbox[key];
                });
                
} else if (self) {
    // otherwise, if in a browser, ensure that 'self' is present (provided by the WebWorker api)
    
    postMessage = (data) => {self.postMessage(data)};
    
    self.onmessage = function(ev) {
                        let key = ev.data.key;
                    
                        // resolve the promise with this key value
                        outbox[key](ev.data.value);
                    
                        // clear the entry
                        delete outbox[key];
                    };
                    
} else {
    // if not in node, and self is undefined, then this is an invalid state
    console.error('self undefined in flock-mpi.js. This should be running in a WebWorker context');
    throw "Invalid Context: Not node, not configured browser";
}



// get the easyrtc id of the node with 'rank' in 'comm'
mpi.getId = function (comm, rank) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'getId', args: [comm, rank]});
    });
}

// get the rank of this node in 'comm'
mpi.getRank = function (comm) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'getRank', args: [comm]});
    });
}

// get the size of the given communicting group, 'comm'
mpi.getSize = function (comm) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'getSize', args: [comm]});
    });
}

// send a request to the main thread to send an mpi message
mpi.isend = async function (data, dest, comm, tag=null) {
    
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'isend', args: [data, dest, comm, tag]});
    });
}

// send a request to the main thread to receive an mpi message
mpi.irecv = async function (source, comm, tag=null) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'irecv', args: [source, comm, tag]});
    });
}


// synchronize node executions in a given communication group
mpi.barrier = async function (comm) {
    await mpi.ibcast('barrier', 0, comm);
    
    return;
}

 
// broadcast a value from a root node to all nodes in a group
/**
    @param data : the value to broadcast (only used if rank === 0)
    @param root : the node with the data
    @param comm : the communication group to broadcast across
*/
mpi.ibcast = async function (data, root, comm) {
    if (await mpi.getRank(comm) === root) {
        // get list of other nodes to send
        let nodes = [...Array(await mpi.getSize(comm)).keys()].filter((val) => val !== root);
        
        // send to other nodes
        let reqs = [];
        nodes.forEach((rank) => {
            let req = mpi.isend(data, rank, comm);
            reqs.push(req);
        });
        
        return Promise.all(reqs).then((val) => {return data});
        
    } else {
        // receive from root
        // TODO consider making a bcast tag?
        let res = mpi.irecv(root, comm);
        
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
mpi.iscatter = async function (sendArr, root, comm, tag=null) {
    let rank = await mpi.getRank(comm);
    let commSize = await mpi.getSize(comm);
    
    if (rank === root) {
        
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

            let req = mpi.isend(sendArr.slice(currIdx, currIdx + numEls), nodes[0], comm);
            reqs.push(req);
            
            // after sending to a new node, update the index and remove this node from the nodes list
            currIdx += numEls;
            nodes.shift();
        }
        
        // return this node's result when all sends have been acked
        return Promise.all(reqs).then((val) => {return res}); 
        
    } else {
        // receive from root
        let res = await mpi.irecv(root, comm);
        
        return res;
    }
    
    
    
}

// reduce values using a given binary operation
mpi.ireduce = async function (sendArr, op, comm) {
    
    // do local reduction
    let local = sendArr.reduce(op);
    
    // for trivial case that only 1 node is in the communicating group, return local sum
    if (await mpi.getSize(comm) === 1) {
        return local;
    }
    
    // get the reduction down to a power of 2
    let size = await mpi.getSize(comm);
    let rank = await mpi.getRank(comm);
    let twoSize = Math.pow(2, Math.floor(Math.log(size) / Math.log(2)));
    let extraSize = size - twoSize;
    
    let extraNodes = [...Array(extraSize).keys()].map((val) => size - 1 - val);
    
    // send the extra vals to the previous nodes with extraSize as the offset
    if (rank >= twoSize) {
        
        let status = mpi.isend(sendArr, rank - extraSize, comm);
        
    } else if (rank > size - extraSize) {
        let arr = await mpi.irecv(rank + extraSize, comm);
        
        let agg = arr.reduce(op);
        
        local = op(local, agg);
    }
    
    await mpi.barrier(comm);
    
    // update size to be twoSize since we have trimmed extras
    // TODO consider making a new communication group with just the power of 2 so that other nodes are freed
    size = twoSize;
    
    // recursive halving as we apply the given binary operation, 'op'
    for (let offset = size / 2; offset >= 1; offset /= 2) {
        
        if (rank >= offset && rank < size) {
            let status = mpi.isend(local, rank - offset, comm);
        } else if (rank < offset){
            let remote = await mpi.irecv(rank + offset, comm);
            local = op(local, remote);
        }
        
        await mpi.barrier(comm);
    }
    
    if (rank === 0) {
        return local;
    }
}

module.exports = mpi;