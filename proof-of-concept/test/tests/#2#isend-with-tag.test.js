// setup communication with parent thread
const WorkerThreads = require('worker_threads');
let parentPort = WorkerThreads.parentPort;
let postMessage = (data) => {parentPort.postMessage(data)};

// import the worker lib
let mpi = require('../../static/flock-mpi.js');


let sendValA = 12345;
let sendValB = 6780;

async function isendWithTag() {
    
    let rank = await mpi.getRank('default');
    
    if (rank === 0) {
        let reqs = [
            mpi.isend(sendValA, 1 - rank, 'default', 'a'),
            mpi.isend(sendValB, 1 - rank, 'default', 'b')
        ]
        
        Promise.all(reqs).then((results) => {
            
            let failed = results.filter((result) => result !== 200);
            
            // if any returned a non-200 status, report as failure
            if (failed.length > 0) {
                postMessage({op: 'fail', msg: `Bad status(es): ${JSON.stringify(failed)}`});
            } else {
                postMessage({op: 'pass'});
            }
            
        }, (err) => {
            postMessage({op: 'fail', msg: err});
        });
        
    } else if (rank === 1) {
        let reqs = [
            mpi.irecv(1 - rank, 'default', 'a'),
            mpi.irecv(1 - rank, 'default', 'b')
        ];
        
        Promise.all(reqs).then((results) => {
            
            if (results[0] !== sendValA) {
                postMessage({op: 'fail', msg: `Expected: ${sendValA}, got: ${results[0]}`});
            } else if (results[1] !== sendValB) {
                postMessage({op: 'fail', msg: `Expected: ${sendValB}, got: ${results[0]}`});
            } else {
                postMessage({op: 'pass'});
            }
            
        }, (err) => {
            postMessage({op: 'fail', msg: err});
        });
    }
}

isendWithTag();