// runs flock tests in nodejs
const Worker = require('worker_threads').Worker;
const EventEmitter = require('events');

let emitter = new EventEmitter();

let workerIds = [0,1];
let tests = ['./tests/isend.test.js', './tests/isend-with-tag.test.js'];

const EV_RCV_MSG = 'EV_RCV_MSG';

class FlockMock {
    
    constructor(isPerf=false) {
        // initialize an inbox for each worker
        this.workerInboxes = {};
        this.isPerf = isPerf;
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
        let isPerf = this.isPerf;
        
        return async function (data, dest, comm, tag=null) {
        
            if (isPerf) {
                await FlockMock.simLatency();
            }
        
            // create list for this worker under tag if none already
            if (!(workerInboxes[dest] && workerInboxes[dest][tag] && Array.isArray(workerInboxes[dest][tag]))) {
                workerInboxes[dest][tag] = [];
            }
            
            // put data in the inbox
            workerInboxes[dest][tag].push(data);
            
            emitter.emit(EV_RCV_MSG, {source: id, dest: dest, tag: tag});
            
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
                    resolveOnMsg = function(msg) {
                        
                        // resolve if the message is meant for this communication
                        if (msg.source === source && msg.dest === id && msg.tag === tag) {
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
        
        let onMessage;
        worker.running = new Promise((resolve, reject) => {
            onMessage = async (msg) => {
            
                switch (msg.op) {
                    case 'getId':
                        worker.postMessage({key: msg.key, op: msg.op, value: id});
                        break;
                    case 'getRank':
                        worker.postMessage({key: msg.key, op: msg.op, value: id});
                        break;
                    case 'getSize':
                        worker.postMessage({key: msg.key, op: msg.op, value: workerIds.length});
                        break;
                    case 'isend':
                        let sendReq = (this.getIsendMock(id))(...msg.args);
                        worker.postMessage({key: msg.key, op: msg.op, value: await sendReq});
                        break;
                    case 'irecv':
                        let recvReq = (this.getIrecvMock(id))(...msg.args);
                        worker.postMessage({key: msg.key, op: msg.op, value: await recvReq});
                        break;
                    case 'pass':
                        worker.unref();
                        resolve({id: id, name: testFile, passed: true, msg: msg.msg, time: (new Date()).getTime() - startTime});
                        break;
                    case 'fail':
                        worker.unref();
                        resolve({name: testFile, passed: false, msg: msg.msg || ''});
                        break;
                    default:
                        console.error('worker requested invalid operation');
                }
            
            }
        });
        
        worker.on('message', onMessage);
        
        return worker;
    }
    
}

function runTest(testFile) {
    let flock = new FlockMock();
    
    // initialize workers for this test
    let workers = workerIds.map( (id) => flock.initWorker(id, testFile) );
    
    let completions = workers.map((worker) => worker.running);
    
    Promise.all(completions).then((results) => {
        // check if any failed
        let failed = results.map((res, idx) => {res.id = idx; return res;}).filter((el) => !el.passed);
        
        if (failed.length > 0) {
            let failIds = failed.map((el) => el.id);
            let failReasons = failed.map((el) => el.msg);
            
            console.error(`${testFile}: Failed on workers ${JSON.stringify(failIds)} with messages: ${JSON.stringify(failReasons)}`);
        } else {
            let times = results.map((el) => `${el.time}ms`);
            console.log(`${testFile}: Passed (${JSON.stringify(times)})`);
        }
        
    });
}

// run the tests
tests.map(runTest);