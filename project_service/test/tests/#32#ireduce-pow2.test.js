// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../../master/flock_server/static/flock-mpi.js');

const sumSize = 1024;

function lowGrainSum(a,b) {
    let bigArr = [...Array(1000000).keys()];
    bigArr.map((val) => val * val);
    return a + b;
}

function sumStuffNormally() {
    console.log('summing normally');
    let arr = [...Array(sumSize).keys()].map((val) => val + 1);
    
    let res = arr.reduce(lowGrainSum);
    
    return res;
}


async function sumStuff() {
    
    let expectedSum = 524800;
    
    let arr = [];
    
    let rank = await mpi.getRank('default');
    
    if (rank === 0) {
        arr = [...Array(sumSize).keys()].map((val) => val + 1);
    }
    
    let req = mpi.iscatter(arr, 0, 'default');
    
    
    req = req
        .then((val) => {
            return mpi.ireduce(val, (a,b) => a+b, 'default');
        });
    
    
    let res = await req;
    
    // assert on results of res
    if (rank !== 0) {
        if (!res) {
            postMessage({op: 'pass'});
        } else {
            postMessage({op: 'fail', msg: `Expected: undefined, got: ${res}`});
        }
    } else {
        if (res === expectedSum) {
            postMessage({op: 'pass'});
        } else {
            postMessage({op: 'fail', msg: `Expected: ${expectedSum}, got: ${res}`});
        }
    }
    
    return req;
}


// time sequential time
sumStuff();