// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../static/flock-mpi.js');

async function ibcastTest() {
    let data = 42;
    
    let req = await mpi.ibcast(data, 0, 'default');
    
    if (req === data) {
        postMessage({op: 'pass'});
    } else {
        postMessage({op: 'fail', msg: `Expected: ${data}, got: ${req}`});
    }
}

ibcastTest();