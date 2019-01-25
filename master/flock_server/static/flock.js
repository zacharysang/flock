let APP_PATH = '/tests.js';

// let a room represent a communication group
// define MPI_COMM_WORLD as the default room
let MPI_COMM_WORLD = "default";

let MSG_TYPE_MSG = "message";
let MSG_TYPE_ACK = "ack";

let EV_RCV_MSG = "receivedMessage";
let EV_RCV_ACK = "receivedAck";

let flock = {};

// stores incoming messages by tag
let inbox = {};

// connection status
flock.isConnected = false;

flock.initWorker = function() {
    /* Code for talking to the WebWorker */
    let worker = new Worker(APP_PATH);
    
    worker.onmessage = async function(ev) {
        
        let start = (new Date()).getTime();
        
        // switch on the type of function and respond to worker
        switch (ev.data.op) {
            case 'getId':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: flock.getId(...ev.data.args)});
                break;
            case 'getRank':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: flock.getRank(...ev.data.args)});
                break;
            case 'getSize':
                worker.postMessage({key: ev.data.key, op: ev.data.op, value: flock.getSize(...ev.data.args)});
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
        
        console.log(`got message with ${(new Date()).getTime() - content.sendTime} ms of latency`);
        
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
    let sourceId = flock.getId(comm, source);
    return function(val) {
        
        easyrtc.sendData(sourceId, MSG_TYPE_ACK, {tag: tag, data: {status: 200, msg: "Received"}}, ()=>{});
        
        // return the value that we are acknowledging receipt of
        return val;
    }
}

flock.consumeFromInbox = function(tag=null) {
    return inbox[tag].shift();
}

flock.joinSuccess = function(rtcId) {
    console.log("successfully joined application with rtcId: " + rtcId);
    window.rtcId = rtcId;
    
    // establish connection to other peers in the cluster
    let peerCalls = flock.connectToPeers();
    
    // once all peers are called, update the isConnected att
    peerCalls.then(() => {flock.isConnected = true; return;});
}

flock.joinFailure = function(errorCode, message) {
    easyrtc.showError(errorCode, message);
}

// initialize client connections with the cluster
flock.join = function() {
    
    easyrtc.enableDataChannels(true);
    
    // disable media
    easyrtc.enableVideo(false);
    easyrtc.enableAudio(false);
    easyrtc.enableVideoReceive(false);
    easyrtc.enableAudioReceive(false);
    
    // register callback when message is received
    easyrtc.setPeerListener(flock.acceptMessage);
    
    if (!easyrtc.webSocket) {
        easyrtc.connect("testapp", flock.joinSuccess, flock.joinFailure);
    }
    
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
    } catch(callerror) {
        console.log("saw call error ", callerror);
    }
    
    return res;
}

// get the current node's rank in the given communication group
flock.getRank = function(comm) {
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.sort().indexOf(window.rtcId);;
}

// get the size of the given communication group
flock.getSize = function(comm) {
    
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.length;
}

// get rtcId from rank
flock.getId = function(comm, rank) {
    
    // temporary while only using global communication group
    // will need to change id setup so that terminated nodes are replaced
    // and continued nodes done change rank
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return (occupants.sort())[rank];
}

// non-blocking send from to another node
/**
    @param buff : buffer to send from
    @param count : number of elements to send
    @param dest : destination rank
    @param tag : tag of number type
    @param comm : the communication group to send array over
 */
 flock.isend = function(data, dest, comm, tag=null) {
    
    // TODO check that destination rank is valid
    let now = (new Date()).getTime();
    let msg = {tag: tag, data: data, sendTime: now};
    
    let destId = flock.getId(comm, dest);
    
    // TODO utilize the callback on this function
    easyrtc.sendData(flock.getId(comm, dest), MSG_TYPE_MSG, msg, ()=>{});
    
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
 flock.irecv = function(source, comm, tag=null) {
     
    // TODO check that source rank is valid
    
    // convert source rank to id
    let sourceId = flock.getId(comm, source);
    
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