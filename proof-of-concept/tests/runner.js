// runs flock tests in nodejs
const Worker = require('worker_threads').Worker;
const EventEmitter = require('events');

let emitter = new EventEmitter();

let workerIds = [0,1,2,3];
let tests = ['./tests/tests.js'];

const EV_RCV_MSG = 'EV_RCV_MSG';

class FlockMock {
    
    constructor() {
        // initialize an inbox for each worker
        this.workerInboxes = {};
        workerIds.forEach((id) => { this.workerInboxes[id] = {} });
    }
    
    // maintain communication between workers
    static simLatency() {

        let latency = Math.random() * 1000;
        
        return new Promise((resolve, reject) => {
           setTimeout(resolve, latency); 
        });
        
        return Promise.resolve();
    }

    getIsendMock(id) {
        let workerInboxes = this.workerInboxes;
        
        return async function (data, dest, comm, tag=null) {
        
            await FlockMock.simLatency();
            
            // create list for this worker under tag if none already
            if (!(workerInboxes[dest] && workerInboxes[dest][tag] && Array.isArray(workerInboxes[dest][tag]))) {
                workerInboxes[dest][tag] = [];
            }
            
            // put data in the inbox
            workerInboxes[dest][tag].push(data);
            
            emitter.emit(EV_RCV_MSG, {source: id, dest: dest});
            
            return 200;
            
        };
    }
    
    getIrecvMock(id) {
        
        let workerInboxes = this.workerInboxes;
        
        return async function(source, comm, tag=null) {
            
            // for debugging purposes
            let key = Math.random();
            
            // if the id is valid, and there is a message in the inbox under this tag
            // then go ahead and resolve with the message value
            if (workerInboxes[id] && workerInboxes[id][tag] && workerInboxes[id][tag].length > 0) {
                return Promise.resolve(workerInboxes[id][tag].shift());
            } else {
                
                let p = new Promise(function(resolve, reject) {
                    
                    resolve.key = key;
                    
                    // function to resolve to value on message event
                    let resolveOnMsg;
                    resolveOnMsg = function(data) {
                        
                        
                        // resolve if the message is meant for this communication
                        if (data.source === source && data.dest === id) {
                            resolve(workerInboxes[id][tag].shift());
                        } else {
                            // re-register the listener in the case that we did not handle the message
                            emitter.once(EV_RCV_MSG, resolveOnMsg);
                        }
                        
                    };
                    
                    // add a one-time event listener that resolves the promise to the received value
                    emitter.once(EV_RCV_MSG, resolveOnMsg);
                });
                
                return p;
                
            }
        };
    }
    
    initWorker(id, testFile) {
        let startTime = (new Date()).getTime();
        
        let worker = new Worker(testFile);
        
        worker.id = id;
        
        worker.on('message', async function(data) {
            
            switch (data.op) {
                case 'getId':
                    worker.postMessage({key: data.key, op: data.op, value: id});
                    break;
                case 'getRank':
                    worker.postMessage({key: data.key, op: data.op, value: id});
                    break;
                case 'getSize':
                    worker.postMessage({key: data.key, op: data.op, value: workerIds.length});
                    break;
                case 'isend':
                    let sendReq = (this.getIsendMock(id))(...data.args);
                    worker.postMessage({key: data.key, op: data.op, value: await sendReq});
                    break;
                case 'irecv':
                    let recvReq = (this.getIrecvMock(id))(...data.args);
                    worker.postMessage({key: data.key, op: data.op, value: await recvReq});
                    break;
                case 'pass':
                    console.log(`Test Passed: ${testFile} (${(new Date()).getTime() - startTime}ms)`);
                    worker.unref()
                    break;
                case 'failed':
                    console.log(`Test Failed: ${testFile} - ${data.msg} (${(new Date()).getTime() - startTime}ms)`);
                    worker.unref();
                    break;
                default:
                    console.error('worker requested invalid operation');
            }
            
        }.bind(this));
        
        return worker;
    }
    
}


// run the tests
for (let i = 0; i < tests.length; i++) {
    let flock = new FlockMock();
    let currTest = tests[i];
    
    // initialize workers for this test
    let workers = workerIds.map( (id) => flock.initWorker(id, currTest) );
}
