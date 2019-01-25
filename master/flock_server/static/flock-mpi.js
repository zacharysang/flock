let mpi = {};

// store resolve function for outstanding requests
let outbox = {};

const INTERNAL_PREFIX = 'internal_';

let numBarriers = 0;

// get reference for function to send messages to the main thread
let postMessage;

if (typeof(self) !== 'undefined') {
    
    postMessage = (data) => {self.postMessage(data)};
    
    self.onmessage = function(ev) {
                        let key = ev.data.key;
                    
                        // resolve the promise with this key value
                        outbox[key](ev.data.value);
                    
                        // clear the entry
                        delete outbox[key];
                    };
                    
} else if (typeof window === 'undefined') {
    const WorkerThread = require('worker_threads');
    
    // make sure this is inside a worker
    if (WorkerThread.isMainThread) {
        throw "Invalid Context: Node main thread";
    }
    
    let parentPort = WorkerThread.parentPort;
    
    postMessage = (data) => {parentPort.postMessage(data)};
    
    // TODO this function is duplicated above
    parentPort.on('message', (data) => {
                    let key = data.key;
                
                    // resolve the promise with this key value
                    outbox[key](data.value);
                
                    // clear the entry
                    delete outbox[key];
                });
                
    
    // if in node, export this object as a package (in browser it will be a classic script)
    // TODO see if webpack can transform this into an es6 export and move to this global scope
    module.exports = mpi;
                
} else {
    // if not in node, and self is undefined, then this is an invalid state
    console.error('self undefined in flock-mpi.js. This should be running in a WebWorker context');
    throw "Invalid Context: Not node, nor configured browser";
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


// send a request to the main thread to send a message
// internal variant exists so that other api functions can use internal tags
let _isend = async function (data, dest, comm, tag=null, isInternal=true) {
    
    if (!isInternal && tag && tag.indexOf('internal_') === 0) {
        throw 'Cannot use "_internal" tag prefix for non-internal invocation of isend';
    }
    
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'isend', args: [data, dest, comm, tag]});
    });
}

mpi.isend = async function(data, dest, comm, tag=null) {
    
    return _isend(data, dest, comm, tag, false);
    
}


let _irecv = async function (source, comm, tag=null, isInternal=true) {
    
    if (!isInternal && tag && tag.indexOf(INTERNAL_PREFIX) === 0) {
        throw 'Cannot use "internal_" tag prefix for non-internal invocation of irecv';
    }
    
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'irecv', args: [source, comm, tag]});
    });
}

// send a request to the main thread to receive an mpi message
mpi.irecv = async function(source, comm, tag=null) {
    
    return _irecv(source, comm, tag, false);
}


// synchronize node executions in a given communication group
mpi.ibarrier = async function (comm) {
    
    let rank = await mpi.getRank(comm);
    let size = await mpi.getSize(comm);
    
    const TAG = `internal_ibarrier`;
    let data = TAG;
    
    let nodes = [...Array(size).keys()];
    
    let res;
    if (rank === 0) {
        let others = nodes.filter((node) => node !== 0);
        let reqs = others.map((node) => _isend(TAG, node, comm, TAG));
        
        res = Promise.all(reqs);
        
    } else {
        res = _irecv(0, comm, TAG);
    }
    
    return res.then( () => {} );

}

 
// broadcast a value from a root node to all nodes in a group
/**
    @param data : the value to broadcast (only used if rank === 0)
    @param root : the node with the data
    @param comm : the communication group to broadcast across
*/
mpi.ibcast = async function (data, root, comm) {
    const TAG = 'internal_ibcast';
    
    if (await mpi.getRank(comm) === root) {
        // get list of other nodes to send
        let nodes = [...Array(await mpi.getSize(comm)).keys()].filter((val) => val !== root);
        
        // send to other nodes
        let reqs = [];
        nodes.forEach((rank) => {
            
            let req = _isend(data, rank, comm, TAG);
            
            reqs.push(req);
        });
        
        return Promise.all(reqs).then(() => {return data});
        
    } else {
        // receive from root
        let res = await _irecv(root, comm, TAG);
        
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

            let req = mpi.isend(sendArr.slice(currIdx, currIdx + numEls), nodes[0], comm, tag);
            reqs.push(req);
            
            // after sending to a new node, update the index and remove this node from the nodes list
            currIdx += numEls;
            nodes.shift();
        }
        
        // return this node's local result when all sends have been acked (irgnore statuses)
        return Promise.all(reqs).then(() => res); 
        
    } else {
        // receive from root
        let res = await mpi.irecv(root, comm, tag);
        
        return res;
    }
    
}

// reduce values using a given binary operation
mpi.ireduce = async function (sendArr, op, comm) {
    
    const TAG = 'internal_ireduce';
    
    let size = await mpi.getSize(comm);
    let rank = await mpi.getRank(comm);
    
    // do local reduction
    let local = sendArr.reduce(op);
    
    // for trivial case that only 1 node is in the communicating group, return local sum
    if (await mpi.getSize(comm) === 1) {
        return local;
    }
    
    // get the reduction down to a power of 2
    let twoSize = Math.pow(2, Math.floor(Math.log(size) / Math.log(2)));
    let extraSize = size - twoSize;
    let extraNodes = [...Array(extraSize).keys()].map((val) => size - 1 - val);
    
    // send the extra vals to the previous nodes with extraSize as the offset
    if (rank >= twoSize) {
        
        let status = _isend(sendArr, rank - extraSize, comm, TAG);
        
    } else if (rank > size - extraSize) {
        
        let arr = await _irecv(rank + extraSize, comm, TAG);
        
        let agg = arr.reduce(op);
        
        local = op(local, agg);
    }
    
    await mpi.ibarrier(comm);
    
    // update size to be twoSize since we have trimmed extras
    // TODO consider making a new communication group with just the power of 2 so that other nodes are freed
    size = twoSize;
    
    // recursive halving as we apply the given binary operation, 'op'
    for (let offset = size / 2; offset >= 1; offset /= 2) {
        
        if (rank >= offset && rank < size) {
            let remoteRank = rank - offset;
            let status = _isend(local, rank - offset, comm, TAG);
        } else if (rank < offset){
            let remoteRank = rank + offset;
            let remote = await _irecv(remoteRank, comm, TAG);
            
            local = op(local, remote);
        }
        
        await mpi.ibarrier(comm);
    }
    
    if (rank === 0) {
        return local;
    }
}
