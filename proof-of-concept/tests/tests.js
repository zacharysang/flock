console.log('testing...');

const WorkerThreads = require('worker_threads');

let parentPort = WorkerThreads.parentPort;

let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
mpi = require('../static/flock-mpi.js');

// send a random number
function sendStuff() {
    console.log('doing it');
    let sendVal = Math.random();
    console.log('getRank(default): ' + mpi.getRank('default'));
    
    let rank = mpi.getRank('default');
    
    if (rank === 0) {
        mpi.isend(sendVal, 1 - rank, 'default').then((status) => {console.log("sent val with status: " + status)});
    } else if (rank === 1){
        mpi.irecv(1 - rank, 'default').then((val) => {console.log("received value: " + val);});
    }
}

function sendStuffWithTag() {
    console.log('sending tagged message');
    let sendValA = Math.random();
    let sendValB = Math.random();
    
    let rank = mpi.getRank('default');
    
    if (rank === 0) {
        mpi.isend(sendValA, 1 - rank, 'default', 'a').then((status) => {console.log(`send val A with status: ${status}`)});
        mpi.isend(sendValB, 1 - rank, 'default', 'b').then((status) => {console.log(`send val B with status: ${status}`)});
    } else if (rank === 1) {
        mpi.irecv(1 - rank, 'default', 'a').then((val) => {console.log(`received value: ${val} for tag 'a'`)});
        mpi.irecv(1 - rank, 'default', 'b').then((val) => {console.log(`received value: ${val} for tag 'b'`)});
    }
    
}

function scatterStuff() {
    console.log('scattering!');
    let arr = [1,2,3,4,5,6];
    
    let req = mpi.iscatter(arr, 0, 'default');
    req.then((val) => {console.log(`val: ${JSON.stringify(val)}`)});
}

function bcastStuff() {
    console.log('broadcasting something');
    let data = 42;
    
    let req = mpi.ibcast(data, 0, 'default');
    req.then((res) => {console.log(`got broadcasted value: ${res}`)})
}

function lowGrainSum(a,b) {
    let bigArr = [...Array(1000000).keys()];
    bigArr.map((val) => val * val);
    return a + b;
}

let sumSize = 150;

async function sumStuff() {
    console.log('summing stuff...');
    let startTime = (new Date()).getTime();
    let arr = [];
    
    let rank = await mpi.getRank('default');
    
    console.log('got rank: ' + rank);
    
    if (rank === 0) {
        arr = [...Array(sumSize).keys()].map((val) => val + 1);
    }
    
    console.log(`iscattering array of length: ${arr.length}`);
    let req = mpi.iscatter(arr, 0, 'default');
    
    req = req.then((val) => {
        console.log(`from scatter got: ${JSON.stringify(val)}.. reducing...`);
        return mpi.ireduce(val, lowGrainSum, 'default');
    });
    
    return req.then((val) => {console.log(`got result: ${val}, took: ${(new Date()).getTime() - startTime} ms`); return val;});
}

function sumStuffNormally() {
    console.log('summing normally');
    let arr = [...Array(sumSize).keys()].map((val) => val + 1);
    
    let res = arr.reduce(lowGrainSum);
    
    return res;
}

// time sequential time
sumStuff().then(() => {
    postMessage({op: 'pass'});
})