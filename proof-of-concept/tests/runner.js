// runs flock tests in nodejs
const {Worker, MessageChannel, MessagePort, isMainThread, parentPort} = require('worker_threads');
const EventEmitter = require('events');

let emitter = new EventEmitter();

let workerIds = [0,1,2,3];
let tests = ['tests/tests.js'];

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
        
        return function (data, dest, comm, tag=null) {
        
            //await FlockMock.simLatency();
            
            // create list for this worker under tag if none already
            if (!(workerInboxes[dest] && workerInboxes[dest][tag] && Array.isArray(workerInboxes[dest][tag]))) {
                workerInboxes[dest][tag] = [];
            }
            
            // put data in the inbox
            workerInboxes[dest][tag].push(data);
            
            emitter.emit('message', {source: id, dest: dest});
            console.log(`resolving isend, id: ${id}`);
            
            return 200;//Promise.resolve(200);
            
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
                console.log(`immediately returning for id: ${id}`);
                return Promise.resolve(workerInboxes[id][tag].shift());
            } else {
                
                let p = new Promise(function(resolve, reject) {
                    
                    resolve.key = key;
                    
                    // function to resolve to value on message event
                    let resolveOnMsg;
                    resolveOnMsg = function(data) {
                        
                        
                        // resolve if the message is meant for this communication
                        if (data.source === source && data.dest === id) {
                            console.log(`about to resolve listener promise for id: ${id}`);
                            resolve(workerInboxes[id][tag].shift());
                            console.log(`resolved in resolveOnMsg: ${id}`);
                        } else {
                            // re-register the listener in the case that we did not handle the message
                            emitter.once('message', resolveOnMsg);
                        }
                        
                    };
                    
                    // add a one-time event listener that resolves the promise to the received value
                    emitter.once('message', resolveOnMsg);
                });
                
                return p;
                
            }
        };
    }
    
    initWorker(id, testFile) {
        let worker = new Worker(testFile);
        
        worker.id = id;
        
        worker.onmessage = async function(ev) {
            
            switch (ev.data.op) {
                case 'getId':
                    worker.postMessage({id: ev.data.id, op: ev.data.op, value: id});
                    break;
                case 'getRank':
                    worker.postMessage({id: ev.data.id, op: ev.data.op, value: id});
                    break;
                case 'getSize':
                    worker.postMessage({id: ev.data.id, op: ev.data.op, value: workerIds.length});
                    break;
                case 'isend':
                    let req = (this.getIsendMock(id))(...ev.data.args);
                    console.log(req);
                    console.log('^req. about to await in isend');
                    worker.postMessage({id: ev.data.id, op: ev.data.op, value: req});
                    console.log('breaking in isend');
                    break;
                case 'irecv':
                    let val = (this.getIrecvMock(id))(...ev.data.args);
                    console.log(val);
                    console.log('^val');
                    worker.postMessage({id: ev.data.id, op: ev.data.op, value: await val});
                    console.log('breaking from irecv op');
                    break;
                case 'pass':
                    console.log(`Test Passed: ${testFile} (${ev.data.time}ms)`);
                    worker.terminate();
                    break;
                case 'failed':
                    console.log(`Test Failed: ${testFile} - ${ev.data.msg} (${ev.data.time}ms)`);
                    worker.terminate();
                    break;
                default:
                    console.error('worker requested invalid operation');
            }
            
        }.bind(this);
        
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
