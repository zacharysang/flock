// let a room represent a communication group
// define MPI_COMM_WORLD as the default room
const MPI_COMM_WORLD = "default";

const MSG_TYPE_MSG = "message";
const MSG_TYPE_ACK = "ack";
const MSG_TYPE_SIZE_CHECK = "size_check";
const MSG_TYPE_GET_RANK = "get_rank";
const MSG_TYPE_GET_ID = "get_easyrtcid";

const EV_RCV_MSG = "receivedMessage";
const EV_RCV_ACK = "receivedAck";

// this must be synced with the same value in app.js (populated by template?)
let APP_NAME = "flock-app";

// exported object
let flock = {};

// cache for the rank of this node
flock.rank = {};

// cache for rank <-> easyrtc mappings of other nodes
flock.easyrtcIdByRank = {[MPI_COMM_WORLD]: {}};


// stores incoming messages by tag
let inbox = {};

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
    /* Code for talking to the WebWorker */
    let worker = new Worker(appPath);
    
    worker.onmessage = async function(ev) {
        
        let start = (new Date()).getTime();
        
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
            default:
                console.error(`worker requested invalid operation, ${JSON.stringify(ev.data)}`);
        }
    }
    
    return worker;

}


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
flock.acceptMessage = function(source, msgType, content) {
    
    // where an ack is expected, there should be a listener active and no need for an inbox
    if (msgType === MSG_TYPE_MSG) {
        if (!inbox[content.tag]) {
            inbox[content.tag] = [];
        }
        
        console.log(`Got message with ${Date.now() - content.sendTime}ms of latency`);
        
        inbox[content.tag].push(content.data);
    
        // event holds source and tag so listener can opt to ignore message and send ack
        let msgEv = new CustomEvent(EV_RCV_MSG, {detail: {source: source, tag: content.tag}});
        
        document.dispatchEvent(msgEv);
        
    } else if (msgType === MSG_TYPE_ACK) {
        
        let ackEv = new CustomEvent(EV_RCV_ACK, {detail: {source: source, tag: content.tag, data: content.data}});
        document.dispatchEvent(ackEv);
        
    }

}

flock.ackMsgFunc = function(comm, source, tag) {
    return async function(val) {
        
        let sourceId = await flock.getId(comm, source);
        
        easyrtc.sendData(sourceId, MSG_TYPE_ACK, {tag: tag, data: {status: 200, msg: "Received"}}, ()=>{});
        
        // return the value that we are acknowledging receipt of
        return val;
    }
}

flock.consumeFromInbox = function(tag=null) {
    return inbox[tag].shift();
}

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
            window.rtcId = rtcId;
            
            // establish connection to other peers in the cluster
            let peerCalls = flock.connectToPeers();
            
            // once all peers are called, update the isConnected att
            peerCalls.then(() => {flock.isConnected = true; resolve(); return;});
        }
        
        joinFailure = function(errorCode, message) {
            reject(message);
            easyrtc.showError(errorCode, message);
        }
        
    });
    
    // connect if not already connected
    if (!easyrtc.webSocket) {
        easyrtc.connect(APP_NAME, joinSuccess, joinFailure);
    }
    
    return joinStatus;
    
}

flock.connectToPeers = function() {
    let peers = easyrtc.getRoomOccupantsAsArray(MPI_COMM_WORLD) || [];
    
    let unconnectedPeers = peers.filter((peerId) => {
        return (peerId !== window.rtcId && easyrtc.getConnectStatus(peerId) === easyrtc.NOT_CONNECTED)
    });
    
    // convert all unconnected peers to call promises
    let calls = unconnectedPeers.map(flock.callPeer);
    
    return Promise.all(calls);
}

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
                    easyrtc.showError(errorCode, errorText);
                }
        );
    } catch(err) {
        console.error(`Saw error during call: ${JSON.stringify(err)}`);
    }
    
    return res;
}

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
        console.log(`Waiting for cluster to reach minimum size`);
    
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
    
}

// get the current node's rank in the given communication group
flock.getRank = async function(comm) {
    
    // check for cached rank value
    if (flock.rank[comm]) {
        return Promise.resolve(flock.rank[comm]);
    } else {
        
        return new Promise((resolve, reject) => {
            easyrtc.sendServerMessage(MSG_TYPE_GET_RANK, {comm: comm, id: easyrtc.myEasyrtcid},
            (msgType, msgData) => {
                if (MSG_TYPE_GET_RANK === msgType) {
                    
                    // rank is received from server as a string to prevent cast of 0 to boolean 'false'
                    let rank = parseInt(msgData);
                    
                    flock.rank[comm] = rank;
                    
                    resolve(rank);
                }
            }, (errCode, errMessage) => {
                reject(new Error(`Failed to get rank : ${errCode} - ${errMessage}`));
            });
        });
    }
}

// get the size of the given communication group
flock.getSize = function(comm) {
    
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.length;
}

// get rtcId from rank
// TODO change name to idFromRank
flock.getId = async function(comm, rank) {
    
    if (flock.easyrtcIdByRank[comm][rank]) {
        return Promise.resolve(flock.easyrtcIdByRank[comm][rank]);
    } else {
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
    }
    
}

// non-blocking send from to another node
/**
    @param buff : buffer to send from
    @param count : number of elements to send
    @param dest : destination rank
    @param tag : tag of number type
    @param comm : the communication group to send array over
 */
 flock.isend = async function(data, dest, comm, tag=null) {
    
    // TODO check that destination rank is valid
    let now = (new Date()).getTime();
    let msg = {tag: tag, data: data, sendTime: now};
    
    let destId = await flock.getId(comm, dest);
    
    // TODO utilize the callback on this function for acknowledgement (instead of event listener)
    easyrtc.sendData(destId, MSG_TYPE_MSG, msg, ()=>{});
    
    let resolveOnAck;
    
    return new Promise((resolve, reject) => {
        
        resolveOnAck = function (ev) {
            if (ev.detail.source === destId && ev.detail.tag === tag) {
                resolve(ev.detail.data.status);
            }
        }
        
        document.addEventListener(EV_RCV_ACK, resolveOnAck)
        
    }).then((status) => {
        
        document,removeEventListener(EV_RCV_ACK, resolveOnAck);
        return status;
        
    });
 }
 
// non-blocking receive from a node
/**
    @param count : the number of elements to receive
    @param source : the rank of the node to receive from
    @param tag : a tag of number type
    @param comm : the communication group to receive over
 */
flock.irecv = async function(source, comm, tag=null) {
     
    // TODO check that source rank is valid
    
    // convert source rank to id
    let sourceId = await flock.getId(comm, source);
    
    let res;
    
    // TODO make sure that we check the source before matching a recv
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
                
                if (ev.detail.source === sourceId && ev.detail.tag === tag) {
                    let val = flock.consumeFromInbox(tag);
                    resolve(val);
                }
            }
            
            document.addEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            
        }).then((val) => {
            document.removeEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            return val;            
        });
    }
    
    return res.then(flock.ackMsgFunc(comm, source, tag));
    
 }
 
 
 flock.join()
        .then(flock.awaitClusterSize)
        .then(() => flock.initWorker(window.APP_PATH))
