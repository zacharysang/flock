// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../../master/flock_server/static/flock-mpi.js');

async function igatherTest() {

    let rank = await mpi.getRank('default');

    let arr = [...Array(100).keys()];

    if (rank === 0) {
        let res = await mpi.igather(arr, 0, 'default');
        if (res.length === 2000) {
            postMessage({op: 'pass'});
        } else {
            postMessage({op: 'fail', msg: `Expected subarray of length 2000, got: ${res.length}`});
        }
    }
    else {
        let res = await mpi.igather(arr, 0, 'default');
        postMessage({op: 'pass'});
    }        
}

igatherTest();
