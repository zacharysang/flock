/* global easyrtc */

const TIMEOUT_MS = 20000;

// let a room represent a communication group
// define MPI_COMM_WORLD as the default room
const MPI_COMM_WORLD = "default";

const MSG_TYPE_MSG = "message";
const MSG_TYPE_ACK = "ack";
const MSG_TYPE_SIZE_CHECK = "size_check";
const MSG_TYPE_GET_RANK = "get_rank";
const MSG_TYPE_GET_ID = "get_easyrtcid";
const MSG_TYPE_PUB_STORE = "publish_store";

const EV_RCV_MSG = "receivedMessage";
const EV_RCV_ACK = "receivedAck";

const ID_STATUS_EL = 'status';

const STORE_KEY_NAMES = 'store_names';

// this must be synced with the same value in app.js (populated by template?)
let APP_NAME = "flock-app";

// exported object
let flock = {};

// cache for the rank of this node
flock.rank = {};

// Stores the status data displayed to the user
flock.status = {};

flock.statusEl = document.getElementById(ID_STATUS_EL);

// cache for rank <-> easyrtc mappings of other nodes
flock.easyrtcIdByRank = {[MPI_COMM_WORLD]: {}};


// stores incoming messages by tag
let inbox = {};

/*
Uncomment this when allowing takeovers to occur

let storeDump = function() {
    let namesStr = window.sessionStorage.getItem(STORE_KEY_NAMES);
    let names = JSON.parse(namesStr);
    
    names.map((name) => { return {[name]: window.sessionStorage.getItem(name)} })
        .reduce((entry, acc) => {
            return Object.assign(acc, entry);
        }, {});
}

let publishStore = function() {
    let store = storeDump();
    
    easyrtc.sendServerMessage(MSG_TYPE_PUB_STORE, store,
        null, (errCode, errMsg) => {
            console.error('Failed to publish the local store');
        });
}
*/

// connection status
flock.isConnected = false;

/**
 * Used to start an application on a volunteer's browser
 * 
 * @function flock.initWorker
 * 
 * @param {string} appPath - Absolute path of the flock app to run
 * 
 */
flock.initWorker = function(appPath) {
    
    flock.updateStatus({state: 'starting application'});
    
    /* Code for talking to the WebWorker */
    let worker = new Worker(appPath);
    
    worker.onmessage = async function(ev) {
        
        // switch on the type of function and respond to worker
        switch (ev.data.op) {
            case 'getId':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: await flock.getId(...ev.data.args)});
                break;
            case 'getRank':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: await flock.getRank(...ev.data.args)});
                break;
            case 'getSize':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: await flock.getSize(...ev.data.args)});
                break;
            case 'isend':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: await flock.isend(...ev.data.args)});
                break;
            case 'irecv':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: await flock.irecv(...ev.data.args)});
                break;
            case 'storeSet':
                flock.storeSet(ev.data.name, ev.data.value);
                break;
            case 'storeGet':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: flock.storeGet(ev.data.name)});
                break;
            case 'updateStatus':
                flock.updateStatus(ev.data.status);
                break;
            default:
                console.error(`worker requested invalid operation, ${JSON.stringify(ev.data)}`);
        }
    };
    
    flock.updateStatus({state: 'application running'});
    
    return worker;

};

flock.storeSet = function(name, value) {
    
    let keys = JSON.parse(window.sessionStorage.getItem(STORE_KEY_NAMES)) || []
    
    // add to the list of keys if not already present
    if (keys.indexOf(name) >= 0) {
        keys.push(name);
        window.sessionStorage.setItem(STORE_KEY_NAMES, JSON.stringify(keys));
    }
    
    // store the key value pair
    window.sessionStorage.setItem(name, value);
}

flock.storeGet = function(name) {
    return window.sessionStorage.getItem(name);
}


flock.updateStatus = function(data) {
    Object.assign(flock.status, data);
    flock.statusEl.innerText = JSON.stringify(flock.status);
};

/*
    Messages should be in the format:
        {
            source,
            content: {
                tag,
                data
            }
        }
*/
// when receiving a message, put it in the inbox
flock.acceptMessage = function(sourceId, msgType, content) {
    
    // where an ack is expected, there should be a listener active and no need for an inbox
    if (msgType === MSG_TYPE_MSG) {
        if (!inbox[content.tag]) {
            inbox[content.tag] = [];
        }
        
        console.log(`Got message with ${Date.now() - content.sendTime}ms of latency`);
        
        inbox[content.tag].push(content.data);
    
        // event holds source and tag so listener can opt to ignore message and send ack
        let msgEv = new CustomEvent(EV_RCV_MSG, {detail: {sourceRank: content.sourceRank, tag: content.tag}});
        
        document.dispatchEvent(msgEv);
        
    } else if (msgType === MSG_TYPE_ACK) {
        
        let ackEv = new CustomEvent(EV_RCV_ACK, {detail: {sourceRank: content.sourceRank, tag: content.tag, data: content.data}});
        document.dispatchEvent(ackEv);
        
    }

};

flock.ackMsgFunc = function(comm, source, tag) {
    return async function(val) {
        
        let sourceId = await flock.getId(comm, source);
        
        let sourceRank = await flock.getRank(comm);
        
        easyrtc.sendData(sourceId, MSG_TYPE_ACK, {tag: tag, data: {status: 200, msg: "Received"}, sourceRank: sourceRank}, ()=>{});
        
        // return the value that we are acknowledging receipt of
        return val;
    };
};

flock.consumeFromInbox = function(tag=null) {
    return inbox[tag].shift();
};

/**
 * 
 * Initialize client connections with the rest of the cluster
 * 
 * @function
 * @async
 * 
 * @returns {promise} joinState - Resolves if joined cluster successfully (rejects otherwise)
 * 
 */
flock.join = async function() {
    
    flock.updateStatus({state: 'joining'});
    
    easyrtc.enableDataChannels(true);
    
    // disable media
    easyrtc.enableVideo(false);
    easyrtc.enableAudio(false);
    easyrtc.enableVideoReceive(false);
    easyrtc.enableAudioReceive(false);
    
    // register callback when message is received
    easyrtc.setPeerListener(flock.acceptMessage);
    
    // set up promise to return for join state
    let joinSuccess;
    let joinFailure;
    
    let joinStatus = new Promise((resolve, reject) => {
        joinSuccess = function(rtcId) {
            console.log(`Successfully joined application, ${APP_NAME} with rtcId: ${rtcId}`);
            
            flock.updateStatus({state: 'connecting'});
            
            window.rtcId = rtcId;
            
            // establish connection to other peers in the cluster
            let peerCalls = flock.connectToPeers();
            
            // once all peers are called, update the isConnected att
            peerCalls.then(() => {
                flock.isConnected = true; 
                resolve();
                flock.updateStatus({state: 'connected'});
                return;
            });
        };
        
        joinFailure = function(errorCode, message) {
            reject(message);
            flock.updateStatus({state: 'not connected'});
            easyrtc.showError(errorCode, message);
        };
        
    });
    
    // connect if not already connected
    if (!easyrtc.webSocket) {
        easyrtc.connect(APP_NAME, joinSuccess, joinFailure);
    }
    
    return joinStatus;
    
};

flock.connectToPeers = function() {
    let peers = easyrtc.getRoomOccupantsAsArray(MPI_COMM_WORLD) || [];
    
    let unconnectedPeers = peers.filter((peerId) => {
        return (peerId !== window.rtcId && easyrtc.getConnectStatus(peerId) === easyrtc.NOT_CONNECTED);
    });
    
    // convert all unconnected peers to call promises
    let calls = unconnectedPeers.map(flock.callPeer);
    
    return Promise.all(calls);
};

// initiate a webrtc call with a peer
flock.callPeer = function(peerId) {
    
    let callAck;
    let res = new Promise((resolve, reject) => {
        callAck = resolve;
    });
    
    try {
        easyrtc.call(peerId,
                (caller, media) => {callAck()},
                (errorCode, errorText) => {
                    let errMsg = `Error during p2p call (${errorCode}): ${errorText}`;
                    console.warn(errMsg);
                    callAck(errMsg);
                }
        );
    } catch(err) {
        console.error(`Saw error during call: ${JSON.stringify(err)}`);
    }
    
    return res;
};

/**
 * 
 * Wait until the cluster reaches a given size
 * 
 * @async
 * @function
 * 
 * @param {number} size - the required cluster size to wait for
 * 
 * @returns {Promise} A promise that resolves once the cluster has reached the desired size
 * 
 */
flock.awaitClusterSize = async function(size) {
    
    flock.updateStatus({state: 'awaiting peers'});
    
    let ret;
    
    // check the current size of the cluster
    let sizeReq = new Promise((resolve, reject) => {
        easyrtc.sendServerMessage(MSG_TYPE_SIZE_CHECK, null,
        (msgType, msgData) => {
            if (msgType === MSG_TYPE_SIZE_CHECK) {
               resolve(msgData);
            }
        }, (errCode, errMsg) => {
            reject(new Error(`Failed to retrieve cluster size from server : ${errCode} - ${errMsg}`));
        });
    });
    
    
    if (await sizeReq === true) {
        ret = Promise.resolve();
    } else {
        console.log(`Waiting for cluster to reach minimum size...`);
    
        ret =  new Promise((resolve, reject) => {
            
            easyrtc.setServerListener((msgType, msgData, targeting) => {
                
                // check if this message is an update on cluster size
                if (msgType == MSG_TYPE_SIZE_CHECK && msgData === true) {
                    resolve();
                }
            });
            
            
        })
        .then(() => {
            // remove the listener
            easyrtc.setServerListener(undefined);
        });
        
    }
    
    return ret.then(() => {
        console.log(`Reached minimum cluster size. Settling peer connections...`);

        // set up a settling period
        return new Promise((resolve, reject) => {
            setTimeout(resolve, 10000);
        });
    });
    
};

// get the current node's rank in the given communication group
flock.getRank = async function(comm) {
    
    // TODO add caching
    return new Promise((resolve, reject) => {
        easyrtc.sendServerMessage(MSG_TYPE_GET_RANK, {comm: comm, id: easyrtc.myEasyrtcid},
        (msgType, msgData) => {
            if (MSG_TYPE_GET_RANK === msgType) {
                
                // rank is received from server as a string to prevent cast of 0 to boolean 'false'
                let rank = parseInt(msgData);
                
                flock.rank[comm] = rank;
                
                // update the rank
                flock.updateStatus({world_rank: rank});
                
                resolve(rank);
            }
        }, (errCode, errMessage) => {
            reject(new Error(`Failed to get rank : ${errCode} - ${errMessage}`));
        });
    });
};

// get the size of the given communication group
flock.getSize = function(comm) {
    
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.length;
};

// get rtcId from rank
// TODO change name to idFromRank
flock.getId = async function(comm, rank) {
    
    // TODO add caching
    return new Promise((resolve, reject) => {
        easyrtc.sendServerMessage(MSG_TYPE_GET_ID, {comm, rank},
        (msgType, msgData) => {
            if (MSG_TYPE_GET_ID === msgType) {
                
                flock.easyrtcIdByRank[comm][rank] = msgData;
                
                resolve(msgData);
            } 
        }, (errCode, errMessage) => {
            reject(new Error(`Failed to get easyrtcid : ${errCode} - ${errMessage}`));
        });
    });
};

// non-blocking send from to another node
/**
    @param buff : buffer to send from
    @param count : number of elements to send
    @param dest : destination rank
    @param tag : tag of number type
    @param comm : the communication group to send array over
 */
 flock.isend = async function(data, dest, comm, tag=null) {
    
    let rank = await flock.getRank(comm);
    
    // TODO check that destination rank is valid
    let msg = {data: data, tag: tag, sourceRank: rank, sendTime: Date.now()};
    
    let resolveOnAck;
    
    return new Promise(async (resolve, reject) => {
        
        let destId = await flock.getId(comm, dest);
        
        if (destId.err) {
            console.error(destId.err);
            reject(destId.err);
            return;
        }
        
        easyrtc.sendData(destId, MSG_TYPE_MSG, msg, ()=>{});
        
        let interval = setInterval(async () => {
            console.warn(`isend timed out while waiting for acknowledgement. Resending data to rank: ${dest}`);
            
            // update destId
            destId = await flock.getId(comm, dest);
            
            easyrtc.sendData(destId, MSG_TYPE_MSG, msg, ()=>{});
        }, TIMEOUT_MS);
        
        resolveOnAck = function (ev) {
            if (ev.detail.sourceRank === dest && ev.detail.tag === tag) {
                clearInterval(interval);
                resolve(ev.detail.data.status);
            }
        };
        
        document.addEventListener(EV_RCV_ACK, resolveOnAck);
        
    }).then((status) => {
        
        document,removeEventListener(EV_RCV_ACK, resolveOnAck);
        return status;
        
    });
 };
 
// non-blocking receive from a node
/**
    @param count : the number of elements to receive
    @param source : the rank of the node to receive from
    @param tag : a tag of number type
    @param comm : the communication group to receive over
 */
flock.irecv = async function(source, comm, tag=null) {
    
    // TODO check that source rank is valid
    
    let res;
    
    // check if we have already received this message
    if (inbox[tag] && inbox[tag].length > 0) {
        res = Promise.resolve(flock.consumeFromInbox(tag));
    } else {
        // if not, wait for the next received message
     
        // define this function in this scope so it can be cleared later
        let resolveOnMsgEvent;
     
        // return a promise whose executor resolves to the corresponding rtc message
        res = new Promise((resolve, reject) => {
            resolveOnMsgEvent = function resolveOnMsgEvent(ev) {
                
                if (ev.detail.sourceRank === source && ev.detail.tag === tag) {
                    let val = flock.consumeFromInbox(tag);
                    resolve(val);
                }
            };
            
            document.addEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            
        }).then((val) => {
            document.removeEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            return val;            
        });
    }
    
    return res.then(flock.ackMsgFunc(comm, source, tag));
    
 };
 
 flock.join()
        .then(flock.awaitClusterSize)
        .then(() => flock.initWorker(window.APP_PATH));
