// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../static/flock-mpi.js');

async function iscatterTestEven() {
    let arr = [...Array(100).keys()];
    
    let req = await mpi.iscatter(arr, 0, 'default');
    
    if (req.length === 5) {
        postMessage({op: 'pass'});
    } else {
        postMessage({op: 'fail', msg: `Expected subarray of length 5, got: ${req.length}`});
    }
}

iscatterTestEven();