const HTTPS_PORT = 4000;
const MAIN_SERVER_ADDR = "http://localhost:8080";
const STREAM_SERVER_ADDR = "https://localhost:4000";
// const HTTPS_PORT = 8443;
// const MAIN_SERVER_ADDR = "http://chat.blinkcdn.com:8080";
// const STREAM_SERVER_ADDR = "https://stream.blinkcdn.com";

const express = require('express');
const https = require('https');
const socketIO = require('socket.io');
const fs = require('fs');

/******** OBJECTS ***********/

// Rooms
let streamRooms = {};
let sockets = {};

/************  SERVER SETUP *************/

const certOptions = {
    key: fs.readFileSync('certs/key.pem'),
    cert: fs.readFileSync('certs/cert.pem')
};

let app = express();
let httpsServer = https.Server(certOptions, app);
httpsServer.listen(HTTPS_PORT);
let io = socketIO.listen(httpsServer);

console.log("Connected.");

io.sockets.on('connection', function(socket) {

    console.log("Client connected to socket.");

    socket.on('signal', function(message, destUuid, roomName) {
        onSignal(message, destUuid, roomName, socket);
    });
    socket.on('disconnect client', function(userID, roomName) {
        onDisconnect(userID, roomName);
    });
    socket.on('publish', function(userID, roomName) {
        onJoin(userID, socket, roomName, true);
    });
    socket.on('subscribe', function(userID, roomName) {
        onJoin(userID, socket, roomName, false);
    });

});

/******* SETUP MAIN SERVER CONNECTION *********/

let io_client = require('socket.io-client');
let mySocket = io_client.connect(MAIN_SERVER_ADDR);
mySocket.emit('connect service', STREAM_SERVER_ADDR, "stream");

mySocket.on('sync', function(rcvdUsers, rcvdRooms) {
    users = rcvdUsers;
    rooms = rcvdRooms;
});

mySocket.on('disconnect', function() {
    var tryToConnect = setInterval(function() {
        if (mySocket.connected) {
            clearInterval(tryToConnect);
            console.log("Connected.");
            mySocket.emit('connect service', STREAM_SERVER_ADDR, "stream");
        }
        mySocket = io_client.connect(MAIN_SERVER_ADDR);
    }, 300);
});

/******* FUNCTIONALITY **********/

function onSignal(message, destUserID, roomName, socket) {
    if (streamRooms[roomName].clients[destUserID]) {
        // streamRooms[roomName].clients[destUserID].socket.emit('signal', message);
        sockets[destUserID].emit('signal', message);
    }
}

function onDisconnect(userID, roomName) {
    console.log(userID, "Disconnecting");

    if(streamRooms[roomName]) {
        let clientsInRoom = streamRooms[roomName].clients;

        if (clientsInRoom.length === 1) {
            streamRooms[roomName] = null;
            delete streamRooms[roomName];
            return;
        }

        else {
            // Remove Client from room
            delete streamRooms[roomName].clients[userID];

            // Let everyone know the client left
            for (clientID in clientsInRoom) {
                // clientsInRoom[clientID].socket.emit('disconnect user', userID, roomName);
                sockets[clientID].emit('disconnect user', userID, roomName);
            }
        }
    }

    masterLog({
      type: "unsubscribe",
      userID: userID,
      roomName: roomName
    });
    saveStreamRoomData(streamRooms);
}

function onJoin(userID, socket, roomName, isPublishing) {

    // IF it is a publisher, setup as the broadcaster;
    if (isPublishing === true) {
        // If Room Doesn't Exist
        if (!streamRooms[roomName]) {
            streamRooms[roomName] = {
                clients: {},
                numPublishers: 0
            };
        }

        // If the publisher is new
        if (!streamRooms[roomName].clients[userID]) {
            streamRooms[roomName].numPublishers++;

            streamRooms[roomName].clients[userID] = {
                isPublished: true,
                isSubscribed: false,
                // socket: socket,
                userID: userID,
                publisherNumber: streamRooms.numPublishers-1
            };

            sockets[userID] = socket;
        }

        if(!sockets[userID]) {
            sockets[userID] = socket;
        }


        // If publisher already published inform the publisher of all subscribers
        if (streamRooms[roomName].clients[userID].isPublished === true) {
            for (otherClientID in streamRooms[roomName].clients) {
                if (otherClientID !== userID) {
                    socket.emit('subscriber ready', otherClientID, streamRooms[roomName].clients[userID].publisherNumber)
                }
            }
            return;
        }

        // If publisher hasn't published yet
        else if (streamRooms[roomName].clients[userID].isPublished === false) {
            streamRooms[roomName].numPublishers++;

            streamRooms[roomName].clients[userID].isPublished = true;
            streamRooms[roomName].clients[userID].publisherNumber = streamRooms[roomName].numPublishers-1;
        }

        for (otherClientID in streamRooms[roomName].clients) {
            if (otherClientID !== userID && sockets[otherClientID]) {
                sockets[otherClientID].emit('publisher ready', userID, streamRooms[roomName].clients[userID].publisherNumber);
                // streamRooms[roomName].clients[otherClientID].socket.emit('publisher ready', userID, streamRooms[roomName].clients[userID].publisherNumber);
                socket.emit('subscriber ready', otherClientID, streamRooms[roomName].clients[userID].publisherNumber)
            }
        }

        console.log("Streamer joined the session:", roomName);
        masterLog({
          type: "publish",
          userID: userID,
          roomName: roomName
        });
        saveStreamRoomData(streamRooms);
        return;
    }

    // If Subscribing
    else {

        // if the room doesn't exist, create the room
        if (!streamRooms[roomName]) {
            console.log("Client created room:", roomName);
            streamRooms[roomName] = {
                clients: {},
                numPublishers: 0
            };
        }

        // If client is in the room, turn their subscribe on
        // If not add them in and update their socket.
        if (streamRooms[roomName].clients[userID]) {
            streamRooms[roomName].clients[userID].isSubscribed = true;
            // streamRooms[roomName].clients[userID].socket = socket;
        } else {
            streamRooms[roomName].clients[userID] = {
                isPublished: false,
                isSubscribed: true,
                // socket: socket,
                userID: userID,
                publisherNumber: -1
            };

            sockets[userID] = socket;
        }

        // Loop through all publishers and let them know a new;
        // subscriber has joined
        for (clientID in streamRooms[roomName].clients) {
            let client = streamRooms[roomName].clients[clientID];
            if (client.isPublished) {
                sockets[clientID].emit('subscriber ready', userID, client.publisherNumber);
                // client.socket.emit('subscriber ready', userID, client.publisherNumber);
                socket.emit('publisher ready', clientID, client.publisherNumber);
            }
        }

        saveStreamRoomData(streamRooms);
        masterLog({
          type: "subscribe",
          userID: userID,
          roomName: roomName
        });
    }
}

function saveStreamRoomData(room_data) {
    // // Connect to database and saves streamrooms object
    // var MongoClient = require('mongodb').MongoClient;
    // var url = "mongodb://localhost:27017/";
    //
    // MongoClient.connect(url, function (err, db) {
    //     if (err) {
    //         console.log("Connect Err:", err);
    //     }
    //     var dbo = db.db("mydb");
    //     var myobj = {stream_room: JSON.stringify(streamRooms)};
    //
    //     dbo.collection("stream_rooms").insertOne(myobj, function (err, res) {
    //         if (err) {
    //             console.log("Insert Err:", err);
    //         } else {
    //             console.log("Stream rooms saved.");
    //         }
    //         db.close();
    //     });
    // });
}
function retreiveStreamRoomData() {
    // Queries database for streamRoom
    var MongoClient = require('mongodb').MongoClient;
    var url = "mongodb://localhost:27017/";

    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("mydb");
        var query = { stream_room: { $exists: true } };
        // dbo.collection("stream").find(query).toArray()
        var cursor = dbo.collection("stream").find();
        cursor.forEach(function(err, item) {
            if(!err) {
                console.log(items);
            } else {
                console.log(err);
            }
        });
        console.log("-------");
        console.log(cursor);
        console.log("-------");
        console.log("Got em");
    });
}
function setupMongoCollection() {
    // Setup Mongo
    var MongoClient = require('mongodb').MongoClient;
    var url = "mongodb://localhost:27017/";
    MongoClient.connect(url, function (err, db) {
        if (err) {
            console.log("Connect Err:", err);
        }
        var dbo = db.db("mydb");
        dbo.createCollection("stream_rooms", function (err, res) {
            if (err) {
                console.log("Create Collection Error:", err);
            } else {
                console.log("Created collection");
            }
        });
    });
}

// function stringifyStreamRoom(room_data) {
//     var newStreamRoom = Object.assign({}, room_data);
//     for (roomName in newStreamRoom) {
//         for (clientID in newStreamRoom[roomName].clients) {
//             newStreamRoom[roomName].clients[clientID].socket = undefined;
//         }
//     }
//
//     return JSON.stringify(newStreamRoom);
// }

/*********** Google Firebase ************/

var admin = require("firebase-admin");

var serviceAccount = require("./files/blink-chat-3d18ca48caf7.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://blink-chat-6f619.firebaseio.com/"
});

var db = admin.database();

function masterLog(event) {
  event.datetime = getCurrentDateTime();

  var ref = db.ref("master_log/");
  var newLogKey = ref.child("pods").push().key;

  db.ref('master_log/' + newLogKey).set(event);
}

// HELPER
function getCurrentDateTime() {
  var today = new Date();
  return today.toGMTString();
}
