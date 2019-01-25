// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../../master/flock_server/static/flock-mpi.js');

async function iscatterTestExtra() {
    const LEN = 110;
    
    let arr = [...Array(LEN).keys()];
    
    let req = await mpi.iscatter(arr, 0, 'default');
    
    let rank = await mpi.getRank('default');
    let size = await mpi.getSize('default');
    
    // calculate expected values
    let remainder = (110 / size) % 1;
    let extra = (rank / size) < remainder ? 0 : 1;
    
    let expectedLen = Math.floor(LEN / size) + extra;
    
    if (req.length === expectedLen) {
        postMessage({op: 'pass'});
    } else {
        postMessage({op: 'fail', msg: `Expected length: ${expectedLen}, got: ${req.length}`});
    }
}

iscatterTestExtra()