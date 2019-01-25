// runs flock tests in nodejs
const Worker = require('worker_threads').Worker;
const EventEmitter = require('events');
const fs = require('fs');

const TESTS_DIR = __dirname + '/tests';

// get list of test files
let tests = fs.readdirSync(TESTS_DIR).map((filename) => TESTS_DIR + '/' + filename);

const EV_RCV_MSG = 'EV_RCV_MSG';
const EV_ACK_MSG = 'EV_ACK_MSG';

class FlockMock {
    
    constructor(workerIds, isPerf=false) {
        // initialize an inbox for each worker
        this.workerInboxes = {};
        
        // initialize event emitter without a maximum number of listeners
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(0);
        
        this.isPerf = isPerf;
        this.workerIds = workerIds;
        
        this.workerIds.forEach((id) => { this.workerInboxes[id] = {} });
    }
    
    // maintain communication between workers
    static simLatency() {

        let latency = Math.random() * 1000;
        
        return new Promise((resolve, reject) => {
           setTimeout(resolve, latency); 
        });
    }

    getIsendMock(id) {
        let workerInboxes = this.workerInboxes;
        let isPerf = this.isPerf;
        
        let emitter = this.emitter;
        
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
            
            // notify that the nessage is ready to be consumed
            emitter.emit(EV_RCV_MSG, {source: id, dest: dest, tag: tag});
            
            // return when the value has been consumed by the destination worker
            return new Promise((resolve, reject) => {
                
                let resolveOnMsg;
                resolveOnMsg = function(ackMsg) {
                    
                    if (ackMsg.dest === id && ackMsg.source === dest) {
                        resolve(ackMsg.status);
                    } else {
                        emitter.once(EV_ACK_MSG, resolveOnMsg);
                    }
                    
                }
                
                emitter.once(EV_ACK_MSG, resolveOnMsg);
                
            });
            
        };
    }
    
    getIrecvMock(id) {
        
        let workerInboxes = this.workerInboxes;
        let emitter = this.emitter;
        
        return async function(source, comm, tag=null) {
            
            // if the id is valid, and there is a message in the inbox under this tag
            // then go ahead and resolve with the message value
            let p;
            if (workerInboxes[id] && workerInboxes[id][tag] && workerInboxes[id][tag].length > 0) {
                p = Promise.resolve(workerInboxes[id][tag].shift());
            } else {
                
                p = new Promise(function(resolve, reject) {
                    
                    // function to resolve to value on message event
                    let resolveOnMsg;
                    resolveOnMsg = function(msg) {
                    
                        // resolve if the message is meant for this communication
                        if (msg.dest === id && msg.source === source && msg.tag === tag && workerInboxes[id][tag]) {
                            resolve(workerInboxes[id][tag].shift());
                            
                        } else {
                            // re-register the listener in the case that we did not handle the message
                            emitter.once(EV_RCV_MSG, resolveOnMsg);
                        }
                        
                    };
                    
                    // add a one-time event listener that resolves the promise to the received value
                    emitter.once(EV_RCV_MSG, resolveOnMsg);
                });
            }
            
            return p.then((res) => {
                        let ackMsg = {dest: source, source: id, status: 200};
                        emitter.emit(EV_ACK_MSG, ackMsg);
                            
                        return res;    
                    });
            
        };
    }
    
    initWorker(id, testFile) {
        
        let startTime = (new Date()).getTime();
        
        let worker = new Worker(testFile);
        
        worker.id = id;
        
        let onMessage;
        worker.running = new Promise((resolve, reject) => {
            onMessage = async (msg) => {
                try {
                    switch (msg.op) {
                        case 'getId':
                            worker.postMessage({key: msg.key, op: msg.op, value: id});
                            break;
                        case 'getRank':
                            worker.postMessage({key: msg.key, op: msg.op, value: id});
                            break;
                        case 'getSize':
                            worker.postMessage({key: msg.key, op: msg.op, value: this.workerIds.length});
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
                            resolve({name: testFile, source: `worker (${id})`,passed: false, msg: msg.msg || ''});
                            break;
                        default:
                            console.error('worker requested invalid operation');
                    }
                } catch(err) {
                    resolve({name: testFile, source: 'runner', passed: false, msg: err.message});
                    worker.unref();
                    worker.terminate();
                }
            
            }
        });
        
        worker.on('message', onMessage);
        
        return worker;
    }
    
}

async function runTest(testFile) {
    
    try {
    
        // extract the number of workers for this test from the file name
        let numWorkers = parseInt(testFile.split('#')[1]);
        
        // TODO add some naming convention for performance tests?
        let isPerf = false;
        
        let workerIds = [...Array(numWorkers).keys()];
        
        let flock = new FlockMock(workerIds);
        
        // initialize workers for this test
        let workers = workerIds.map( (id) => flock.initWorker(id, testFile) );
        
        let completions = workers.map((worker) => worker.running);
        
        Promise.all(completions).then((results) => {
            // check if any failed
            let failed = results.map((res, idx) => {res.id = idx; return res;}).filter((el) => !el.passed);
            
            if (failed.length > 0) {
                let failIds = failed.map((el) => el.id);
                let failReasons = failed.map((el) => el.msg);
                
                console.error(`Failed in ${JSON.stringify(failIds)}: ${testFile} - ${JSON.stringify(failReasons)}`);
            } else {
                let times = results.map((el) => `${el.time}ms`);
                console.log(`Passed: ${testFile} ${isPerf ? `(${JSON.stringify(times)})`: ''}`);
            }
            
        });
    
    } catch (err) {
        console.error(`${testFile}: Failed in runner: ${JSON.stringify(err.message)}`);
    }
}

// run the tests
tests.forEach(runTest);