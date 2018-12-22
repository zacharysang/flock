// let a room represent a communication group

// define MPI_COMM_WORLD as the default room
let MPI_COMM_WORLD = "default";
let NULL_FUNC = () => {};

let MSG_TYPE_MSG = "message";
let MSG_TYPE_ACK = "ack";

let EV_RCV_MSG = "receivedMessage";
let EV_RCV_ACK = "receivedAck";

// stores incoming messages by the tag
let inbox = {};

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
function acceptMessage(source, msgType, content) {
    
    // where an ack is expected, there should be a listener active and no need for an inbox
    if (msgType === MSG_TYPE_MSG) {
        if (!inbox[content.tag]) {
            inbox[content.tag] = [];
        }
        
        inbox[content.tag].push(content.data);
    
        // event holds source and tag so listener can opt to ignore message and send ack
        let msgEv = new CustomEvent(EV_RCV_MSG, {detail: {source: source, tag: content.tag}});
        
        document.dispatchEvent(msgEv);
        
    } else if (msgType === MSG_TYPE_ACK) {
        
        let ackEv = new CustomEvent(EV_RCV_ACK, {detail: {source: source, tag: content.tag, data: content.data}});
        document.dispatchEvent(ackEv);
        
    }

}

function ackMsg(comm, source, tag) {
    let sourceId = getId(comm, source);
    return function(val) {
        
        easyrtc.sendData(sourceId, MSG_TYPE_ACK, {tag: tag, data: {status: 200, msg: "Received"}}, ()=>{});
        
        // return the value that we are acknowledging receipt of
        return val;
    }
}

function consumeFromInbox(tag=null) {
    return inbox[tag].shift();
}

function joinSuccess(rtcId) {
    console.log("successfully joined application with rtcId: " + rtcId);
    window.rtcId = rtcId;
}

function joinFailure(errCode, message) {
    easyrtc.showError(errorCode, message);
}

// initialize client connections with the cluster
function join() {
    
    easyrtc.enableDataChannels(true);
    
    // disable media
    easyrtc.enableVideo(false);
    easyrtc.enableAudio(false);
    easyrtc.enableVideoReceive(false);
    easyrtc.enableAudioReceive(false);
    
    // register callback when message is received
    easyrtc.setPeerListener(acceptMessage);
    
    if (!easyrtc.webSocket) {
        easyrtc.connect("testapp", joinSuccess, joinFailure);
    }
    
    // establish connection to other peers in the cluster
    connectToPeers();
    
}

function connectToPeers() {
    let peers = easyrtc.getRoomOccupantsAsArray(MPI_COMM_WORLD) || [];
    
    let unconnectedPeers = peers.filter((peerId) => {
        return (peerId !== window.rtcId && easyrtc.getConnectStatus(peerId) === easyrtc.NOT_CONNECTED)
    });
    
    unconnectedPeers.forEach(callPeer);
}

// initiate a webrtc call with a peer
function callPeer(peerId) {
    
    try {
        easyrtc.call(peerId,
                (caller, media) => {},
                (errorCode, errorText) => {
                    easyrtc.showError(errorCode, errorText);
                },
                (wasAccepted) => {}
        );
    } catch(callerror) {
        console.log("saw call error ", callerror);
    }
}

// get the current node's rank in the given communication group
function getRank(comm) {
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.sort().indexOf(window.rtcId);;
}

// get the size of the given communication group
function getSize(comm) {
    
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return occupants.length;
}

// get rtcId from rank
function getId(comm, rank) {
    
    // temporary while only using global communication group
    // will need to change id setup so that terminated nodes are replaced
    // and continued nodes done change rank
    let occupants = easyrtc.getRoomOccupantsAsArray(comm) || [];
    
    return (occupants.sort())[rank];
}



// blocking send from to another node
/**
    @param buff : buffer to send from
    @param count : number of elements to send
    @param dest : destination rank
    @param tag : tag of number type
    @param comm : the communication group to send array over
 */
 function isend(data, dest, comm, tag=null) {
     
    let msg = {tag: tag, data: data};
    
    let destId = getId(comm, dest);
    
    easyrtc.sendData(getId(comm, dest), MSG_TYPE_MSG, msg, ()=>{});
    
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
 
// blocking receive from a node
/**
    @param count : the number of elements to receive
    @param source : the rank of the node to receive from
    @param tag : a tag of number type
    @param comm : the communication group to receive over
 */
 function irecv(source, comm, tag=null) {
    
    // convert source rank to id
    let sourceId = getId(comm, source);
    
    let res;
    
    // check if we have already received this message
    if (inbox[tag] && inbox[tag].length > 0) {
        res = Promise.resolve(consumeFromInbox(tag));
    } else {
        // if not, wait for the next received message
     
        // define this function in this scope so it can be cleared later
        let resolveOnMsgEvent;
     
        // return a promise whose executor resolves to the corresponding rtc message
        res = new Promise((resolve, reject) => {
            resolveOnMsgEvent = function resolveOnMsgEvent(ev) {
                
                if (ev.detail.source === sourceId && ev.detail.tag === tag) {
                    let val = consumeFromInbox(tag);
                    resolve(val);
                }
            }
            
            document.addEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            
        }).then((val) => {
            document.removeEventListener(EV_RCV_MSG, resolveOnMsgEvent);
            return val;            
        });
    }
    
    return res.then(ackMsg(comm, source, tag));
    
 }
 
 
// scatter an array to many nodes in a group
/**
    @param sendArr : the array to send across the communication group
    @param numEls : the number of elements to send to each node
    @param root : the node to send from
    @param comm : the communication group to send array over
*/
function iscatter(sendArr, root, comm, tag=null) {
    if (!Array.isArray(sendArr)) {
        console.error("Argument sendArr in scatter must be an array");
        return;
    }

    let numEls = Math.max(1, sendArr.length / getSize(comm));
    
    if (getRank(comm) == 0) {
        
        // send to others
        let idx = 0;
        let rank = 1;
        while (idx < getSize(comm)) {
            
            isend(sendArr.slice(idx, idx + numEls), rank, comm, tag);
            
            rank++;
            idx += numEls;
        }
        
    } else {
        // receive from root
        recv(0, comm);
    }
    
}

// reduce values using a given binary operation
function ireduce(){}