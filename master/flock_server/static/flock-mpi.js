/**
 * This module is to be imported by either a browser WebWorker or a nodejs worker-thread
 * 
 * If imported by a WebWorker, it will simply be executed. For this reason `mpi` is in the global scope so that it is available after being imported.
 * 
 * On the other hand, if imported by a worker-thread, it will be imported using nodejs' module system (using module.exports)
 * 
 * @namespace
 * 
 */
var mpi = {};

// store resolve function for outstanding requests
let outbox = {};

const INTERNAL_PREFIX = 'internal_';

let numBarriers = 0;

// get reference for function to send messages to the main thread
let postMessage;

// if 'self' is defined, this is running in the browser
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


// TODO make this internal since its only used by flock.js (should not be visible to the user)
/**
 * Get the easyrtc id of the node with 'rank' in 'comm'
 * 
 * @private
 * @async
 * @function mpi.getId
 *   
 * @param {string} comm - Name of the communication group the given rank belongs corresponds to (a node has a different rank for every communication group it is a part of)
 * @param {number} rank - Rank of this node within the given communication group
 *   
 * @returns {string} Value of easyrtc.id for this node
 */
mpi.getId = async function (comm, rank) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;
        
        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'getId', args: [comm, rank]});
    });
}


mpi.getRank = 
/**
 * Get the rank of this node in 'comm'
 * 
 * @async
 * @function mpi.getRank
 * 
 * @param {string} comm - Name of the communication group to get this node's rank from
 * 
 * @returns {number} Rank for this node under the given communication group
 */
async function (comm) {
    // generate a key for this function call
    let key = Math.random();
    
    // return a promise, the resolve function is stored in outbox under the key: 'id'
    return new Promise((resolve, reject) => {
        outbox[key] = resolve;

        // after the resolve function is registered to this key, request the result
        postMessage({key: key, op: 'getRank', args: [comm]});
    });
}


mpi.getSize = 
/**
 * Get the size of the given communicting group, 'comm'
 * 
 * @async
 * @function mpi.getSize
 * 
 * @param {string} comm - Name of the communication group to get the size of
 * 
 * @returns {number} - Size of the given communication group
 * 
 */
async function (comm) {
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


mpi.isend = 
/**
 * Send data to another node
 * 
 * @async
 * @function mpi.isend
 * 
 * @param {stringifiable} data - Data to be sent to the remote node. Must be able to be serialized using JSON.stringify()
 * @param {number} dest - Rank of the destination node
 * @param {string} comm - Name of the communication group that the current node and destination node are a part of
 * @param {string} tag - (optional) A string used to uniquely identify this message (avoids conflicts if other messages are sent between these nodes at the same time)
 * 
 * @returns {number} Status code of the acknowledgement for this message
 * 
 */
async function(data, dest, comm, tag=null) {
    
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

/**
 * Send a request to the main thread to receive an mpi message
 * 
 * @async
 * @function mpi.irecv
 * 
 * @param {number} source - Rank of the node we are expecting data from
 * @param {string} comm - Name of the communication group the data is being sent under
 * @param {string} tag - (optional) A string used to uniquely identify this message (avoids conflicts if other messages are sent between these nodes at the same time)
 * 
 * @returns {serializable} The received value
 * 
 */
mpi.irecv = async function(source, comm, tag=null) {
    
    return _irecv(source, comm, tag, false);
}

/**
 * Synchronize node executions in a given communication group
 * 
 * @async
 * @function mpi.ibarrier
 * 
 * @param {string} comm - Name of the communication group to synchronize
 * 
 */
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


/**
 * Broadcast a value from a root node to all nodes in a group
 * 
 * @async
 * @function mpi.ibcast
 * 
 * @param {serializable} data - Value to broadcast (only used if rank === 0)
 * @param {number} root - Rank of the node with the data
 * @param {string} comm : Name of the communication group to broadcast across
 * 
 * @returns {serializable} The value broadcasted from root
 */
mpi.ibcast = async function (data, root, comm) {
    const TAG = 'internal_ibcast';
    
    if (await mpi.getRank(comm) === root) {
        // get list of other nodes to send
        let nodes = [...Array(await mpi.getSize(comm)).keys()].filter((val) => val !== root);
        
        // TODO make this align with mpi.ibarrier (use map to vectorize sends)
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
 

// TODO this shouldn't have a tag param (can add it as an internal value. See ibarrier which also has an internal variant that includes a tag)
/**
 * Scatter an array from a root node to all nodes in a group
 * 
 * @async
 * @function mpi.iscatter
 * 
 * @param {array} sendArr - Array to send across the communication group (only used if rank === root)
 * @param {number} root - Rank of the node to send from
 * @param {string} comm - Name of the communication group to send array over
 * 
 * @returns {array} A slice of the given array to each node
 * 
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


/**
 * Reduce values using a given binary operation
 * 
 * @async
 * @function mpi.ireduce
 * 
 * @param {array} sendArr - Array to reduce using op
 * @param {function} op - A symmetric function that takes 2 arguments (associative and binary)
 * @param {string} comm - Name of the communication group to operate under
 * 
 * @returns {serializable} - Result of the reduction is given to the node with rank === 0, other nodes will receive `undefined`
 * 
 */
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
