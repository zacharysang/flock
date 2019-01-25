// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../../master/flock_server/static/flock-mpi.js');


let sendVal = 10;
    
async function isendTest() {

    let rank = await mpi.getRank('default');

    if (rank === 0) {
        mpi.isend(sendVal, 1 - rank, 'default')
            .then((status) => {
                if (status === 200) {
                    postMessage({op: 'pass'});
                } else {
                    postMessage({op: 'fail', msg: `Bad status: ${status}`});
                }
                
            }, (err) => {
                postMessage({op: 'fail', msg: err});
            });
            
    } else if (rank === 1){
        mpi.irecv(1 - rank, 'default')
            .then((res) => {
                if (res === sendVal) {
                    postMessage({op: 'pass'});
                } else {
                    postMessage({op: 'fail', msg: `Expected: ${sendVal}, was: ${res}`});
                }
                
            }, (err) => {
                postMessage({op: 'fail', msg: err})
            });
    }
};

isendTest();