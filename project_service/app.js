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

// Load required modules
let dotenv = require('dotenv');
let fs = require('fs');

var http    = require("http");              // http server core module
let https    = require("https");
var express = require("express");           // web framework external module
var serveStatic = require('serve-static');  // serve static files
var socketIo = require("socket.io");        // web socket external module

var easyrtc = require("easyrtc"); // EasyRTC internal module


const APP_NAME = "flock-app";

const MPI_COMM_WORLD = "default";

// these must match the message type constants in flock.js
const MSG_TYPE_GET_RANK = "get_rank";
const MSG_TYPE_SIZE_CHECK = "size_check";
const MSG_TYPE_GET_ID = "get_easyrtcid";


// initialize dotenv variables
dotenv.config();

// Set process name
process.title = "node-easyrtc";

// TODO allow this to be specified by the developer
let minSize = 3;

// Counter for size of cluster
let size = 0;

// map id to ranks
let easyrtcIdByRank = {[MPI_COMM_WORLD]: {}};

var app = express();

// this static server is for dev purposes only. In production, static assets will be served from the master
app.use(express.static("test/flock-tests"));
app.use("/static", express.static("../master/flock_server/static"));


/*
// configure https options
//let options = {
//    key: fs.readFileSync(process.env["KEY_PATH"]),
//    cert: fs.readFileSync(process.env["CERT_PATH"])
//};
*/


// Start Express http server on port 8080
var webServer = http.createServer(app);

// Start Socket.io so it attaches itself to Express server
var socketServer = socketIo.listen(webServer, {"log level":1});

easyrtc.setOption("logLevel", "debug");

// Start EasyRTC server
var rtc = easyrtc.listen(app, socketServer, null, function(err, pub) {
    console.log("Initiated easyrtc server");
    
    pub.createApp(APP_NAME, null, () => {console.log(`Created application: ${APP_NAME}`)});
    
    //// overriding code goes here ////
  
    // getIceConfig occurs when a node is connected and requests access to the p2p network
    easyrtc.events.on('getIceConfig', (connectionObj, next) => {
    
        // update size, signal when size reached, then run the default behavior
        easyrtc.events.defaultListeners["getIceConfig"](connectionObj, () => {      
            // assign an rank to this connection in the WORLD communication group
            let id = connectionObj.getEasyrtcid();
            easyrtcIdByRank[MPI_COMM_WORLD][size] = id;
            
            // after connected, update cluster size
            size++;
            
            console.log(`Updated cluster size counter to: ${size}`);
            
            if (size >= minSize) {
                
                // send go-ahead to all connected nodes
                pub.app(APP_NAME, (err, appObj) => {
                    
                    if (appObj) {
                        
                        appObj.getConnectionEasyrtcids((err, ids) => {
                            
                            ids.forEach((id) => {
                                appObj.connection(id, (err, connection) => {
                                   pub.events.emit('emitEasyrtcMsg', 
                                                    connection,
                                                    MSG_TYPE_SIZE_CHECK,
                                                    {msgData: true}, (msg) => {},
                                                    (err) => {
                                                        if (err) {
                                                            console.error(`Sending size check had errors: ${JSON.stringify(err)}`);
                                                        }
                                                    }) 
                                });
                            });
                        });
                    } else {
                        console.error(`Error getting easyrtc appObj: ${JSON.stringify(err)}`);
                    }
                });
            }
            
            // continue the lifecycle
            next(null, connectionObj.getApp().getOption("appIceServers"));
            
        });
        
    });
    
    // Disconnect occurs when the socket connection is closed
    // On disconnect, update the size and resume default behavior
    easyrtc.events.on('disconnect', (connectionObj, next) => {
        size--;
        
        console.log(`Updated cluster size counter to: ${size}`);
        
        // run the default behavior
        easyrtc.events.defaultListeners.disconnect(connectionObj, next);
    });
    
    // handle requests from clients (querying cluster state)
    easyrtc.events.on('easyrtcMsg', (connectionObj, msg, socketCallback, next) => {
        
        if (msg.msgType === MSG_TYPE_SIZE_CHECK) {
            socketCallback({msgType: MSG_TYPE_SIZE_CHECK, msgData: size >= minSize});
        }
        
        if (msg.msgType === MSG_TYPE_GET_RANK) {
            let commMap = easyrtcIdByRank[msg.msgData.comm];
            
            // Object.keys converts key to string, parse it back to a number
            let rank = Object.keys(commMap).find((key) => commMap[key] === msg.msgData.id);
            
            socketCallback({msgType: MSG_TYPE_GET_RANK, msgData: rank})
        }
        
        if (msg.msgType === MSG_TYPE_GET_ID) {
            let id = easyrtcIdByRank[msg.msgData.comm][msg.msgData.rank];
            
            socketCallback({msgType: MSG_TYPE_GET_ID, msgData: id});
        }
        
        // continue the chain
        easyrtc.events.defaultListeners.easyrtcMsg(connectionObj, msg, socketCallback, next);
    });
});

// Listen on port 8080
webServer.listen(4002, function () { console.log('listening on http://localhost:4002'); });
