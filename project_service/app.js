/*
Copyright (c) 2016, Priologic Software Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
*/

// Set process name
process.title = 'node-easyrtc';

// Load required modules
// const fs = require('fs');                  // used for https support to read certificates from disk  
// const https    = require('https');         // for future https support

const dotenv = require('dotenv');
const http    = require('http');              // http server core module
const express = require('express');           // web framework external module
const session = require('express-session');   // used for session management
const serveStatic = require('serve-static');  // serve static files
const socketIo = require('socket.io');        // web socket external module
const puppeteer = require('puppeteer');       // Note: This has other dependencies (namely the latest version of chrome). See here for instructions https://developers.google.com/web/updates/2017/04/headless-chrome
const easyrtc = require('easyrtc');           // EasyRTC internal module

const APP_NAME = 'flock-app';

const MPI_COMM_WORLD = 'default';

// these must match the message type constants in flock.js
const MSG_TYPE_MSG = 'message';
const MSG_TYPE_ACK = 'ack';
const MSG_TYPE_SIZE_CHECK = 'size_check';
const MSG_TYPE_GET_RANK = 'get_rank';
const MSG_TYPE_GET_ID = 'get_easyrtcid';
const MSG_TYPE_PUB_STORE = 'publish_store';

// initialize dotenv variables
dotenv.config();

const PORT = parseInt(process.env['FLOCK_PORT']);
const MIN_SIZE = parseInt(process.env['FLOCK_MIN_SIZE']);
const SESSION_SECRET = process.env['FLOCK_SESSION_SECRET'];

// maintain map of ids (easyrtcid and easyrtcsid) to ranks
let idsByRank = {[MPI_COMM_WORLD]: {}};

(async () => {
    
    let expressApp = express();
    
    // TODO for production, use a real session store (default is a naive in-memory store) (see the 'store' option)
    // Note: easyrtc requires 'httpOnly = false' so that cookies are visible to easyrtc via JS
    // this is a security risk, because it means the session id can be accessed during an XSS attack
    expressApp.use(session({
        name: 'easyrtcsid',
        resave: false,
        saveUninitialized: true,
        secret: SESSION_SECRET,
        cookie: {httpOnly: false}
    }));
    
    let url = process.env['FLOCK_URL'];
    
    if (process.env['FLOCK_DEV'] === 'true') {
        
        // Note: This must be installed with npm's '--unsafe-perm' argument to avoid issues when installing as 'nobody' user (See: https://github.com/bubenshchykov/ngrok/issues/115#issuecomment-380927124)
        let ngrok = require('ngrok');
        
        easyrtc.setOption('logLevel', 'debug');
        
        // In dev mode, start a static server for flock js files
        expressApp.use(express.static('test/flock-tests'));
        expressApp.use('/static', express.static('../master/flock_server/static'));
        
        // Override url to the ngrok public url
        try {
            url = await ngrok.connect(PORT);
        } catch (err) {
            console.log(`ngrok error: ${err}`);
        }
    }
    
    // Start Express http server on port 8080
    let webServer = http.createServer(expressApp);
    
    // Start Socket.io so it attaches itself to Express server
    let socketServer = socketIo.listen(webServer, {'log level':1});
    
    // easyrtc session options
    easyrtc.setOption('sessionEnable', true);
    easyrtc.setOption('sessionCookieEnable', true);
    easyrtc.setOption('easyrtcsidRegExp', /^[a-z0-9_.%-]{1,100}$/i); // support cookies signed by express-session
    
    // Start EasyRTC server and attach to express server
    let rtc = easyrtc.listen(expressApp, socketServer, null, function(err, pub) {
        console.log('Initiated easyrtc server');
        
        pub.createApp(APP_NAME, null, () => {console.log(`Created application: ${APP_NAME}`)});
        
        //// overriding code goes here ////
        
        easyrtc.events.on('easyrtcAuth', (socket, easyrtcid, msg, socketCallback, callback) => {
            easyrtc.events.defaultListeners['easyrtcAuth'](socket, easyrtcid, msg, socketCallback, (err, connectionObj) => {
                
                // assign an rank to this connection in the WORLD communication group
                let session = connectionObj.getSession();
                let sid = session.getEasyrtcsid();
                
                let commMap = idsByRank[MPI_COMM_WORLD];
                
                // check if the session id is already in the map
                let rank = Object.keys(commMap).find((rank) => commMap[rank].sid === sid);
                if (rank) {
                    // if sid corresponds to a rank in the map already, check that there is not already an active id
                    if (commMap[rank].id) {
                        console.log(`Got duplicate node session for easyrtcid: ${easyrtcid}`);
                        connectionObj.getRoomNames((err, names) => {
                            names.forEach((name) => {
                                pub.events.emit('roomLeave',
                                connectionObj,
                                'default',
                                (err) => {
                                    console.log(`Error while leaving room: ${JSON.stringify(err)}`);
                                });
                            });
                        });
                        
                        return;
                        
                    } else {
                        // if there isn't an active id for this sid, use this id
                        // (this means that this browser session has no active tabs, and we should assign this new connection to the session)
                        Object.assign(commMap[rank], {id: easyrtcid});
                    }
                } else {
                    
                    // assign new node to a rank with missing id if any (also send persisted data)
                    
                    
                    // if no ranks are missing an id, increase the cluster size by 1 and assign this sid to the new rank
                    let nextRank = Object.keys(commMap).length;
                    commMap[nextRank] = {id: easyrtcid, sid: sid};
                }
                
                console.log(`Updated cluster size counter to: ${getSize()}`);
                
                // publish go-ahead signal if we have reached the minSize
                if (getSize() === MIN_SIZE) {
                    
                    // when size is met, send go-ahead to all nodes
                    // send go-ahead to all connected nodes
                    pub.app(APP_NAME, (err, appObj) => {
                        
                        if (appObj) {
                            
                            let ids = getActiveIds();
                            ids.forEach((id) => {
                                appObj.connection(id, (err, connection) => {
                                        if (isInCluster(id)) {
                                    
                                            pub.events.emit('emitEasyrtcMsg', 
                                                        connection,
                                                        MSG_TYPE_SIZE_CHECK,
                                                        {msgData: true}, (msg) => {},
                                                        (err) => {
                                                            if (err) {
                                                                console.error(`Sending size check had errors: ${JSON.stringify(err)}`);
                                                            }
                                                        });
                                        }
                                });
                            });
                            
                        } else {
                            console.error(`Error getting easyrtc appObj: ${JSON.stringify(err)}`);
                        }
                    });
                    
                }
                
                callback(err, connectionObj);
            });
        });
        
        // handle requests from clients (querying cluster state)
        easyrtc.events.on('easyrtcMsg', (connectionObj, msg, socketCallback, next) => {
    
            if (msg.msgType === MSG_TYPE_SIZE_CHECK) {
                let id = connectionObj.getEasyrtcid();
                socketCallback({msgType: MSG_TYPE_SIZE_CHECK, msgData: isInCluster(id) && getSize() >= MIN_SIZE});
            }
            
            if (msg.msgType === MSG_TYPE_GET_RANK) {
                
                // get the rank -> ids mapping specific to the given communication group
                let commMap = idsByRank[msg.msgData.comm];
                
                let session = connectionObj.getSession();
                let sessionId = session.getEasyrtcsid();
                
                let rank = Object.keys(commMap).find((rank) => commMap[rank].sid === sessionId);
                
                socketCallback({msgType: MSG_TYPE_GET_RANK, msgData: rank})
            }
            
            if (msg.msgType === MSG_TYPE_GET_ID) {
                let result;
                if (idsByRank[msg.msgData.comm] && idsByRank[msg.msgData.comm][msg.msgData.rank]) {
                    result = idsByRank[msg.msgData.comm][msg.msgData.rank].id;
                } else {
                    result = {err: `Rank '${msg.msgData.rank}' does not exist`};
                }
                
                socketCallback({msgType: MSG_TYPE_GET_ID, msgData: result});
            }
            
            // continue the chain
            easyrtc.events.defaultListeners.easyrtcMsg(connectionObj, msg, socketCallback, next);
        });
    
        // Disconnect occurs when the socket connection is closed
        // On disconnect, update the size and resume default behavior
        easyrtc.events.on('disconnect', (connectionObj, next) => {
            let id = connectionObj.getEasyrtcid();
            
            // update idsByRank map
            let commMap = idsByRank[MPI_COMM_WORLD];
            
            // find if the disconnect id corresponds to a rank and if so, nullify
            let rank = Object.keys(commMap).find((rank) => commMap[rank].id === id);
            if (rank) {
                commMap[rank].id = null;  
            }
            
            // run the default behavior
            easyrtc.events.defaultListeners.disconnect(connectionObj, next);
        });
        
    });
    
    // Bind webServer to listening on PORT
    webServer.listen(PORT, function () { console.log(`listening on http://localhost:${PORT}`); });
    
    await initializeNode0(url)
    
    return url;
    
})().then((url) => console.log(`ngrok url: ${url}`));

async function initializeNode0(url) {
    // Launch headless chrome
    // TODO Create a dedicated user to run headless chrome so that sandbox args can be removed and security improved (see here: https://github.com/GoogleChromeLabs/lighthousebot/blob/master/builder/Dockerfile#L35-L40)
    let browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
    let page = await browser.newPage();
    await page.goto(url);
    console.log('browser node 0 launched');
}

// return the number of active nodes in the cluster
function getSize() {
    let activeIds = getActiveIds();
    
    return activeIds.length;
}

function getIds() {
    let ids = Object.values(idsByRank[MPI_COMM_WORLD]).map((el) => el.id);
    return ids;
}

function getActiveIds() {
    let ids = getIds();
    return ids.filter((id) => id !== undefined && id !== null);
}

// return true if the given easyrtcid refers to a valid cluster node
// (excludes duplicate nodes on the same session)
function isInCluster(id) {
    let worldMap = idsByRank[MPI_COMM_WORLD];
    let rank = Object.keys(worldMap).find((rank) => worldMap[rank].id === id);
    
    return rank !== undefined;
}