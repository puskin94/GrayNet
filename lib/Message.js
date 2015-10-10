var net = require('net');
var HashTable = require('./HashTable.js');
var utils = require('./Utils.js');
var Server = require('./Server.js');
var config = require('../jsonFiles/config.json');

var hashtable = new HashTable();
var server = new Server();

function Message() {
    this.port = config.portNet;
}

Message.prototype.server = function() {
    var server = net.createServer(function(conn) {

        conn.on('data', function(data) {
            var req = data.toString().split(':');

            switch(req[0]) {
                // remote host alert me for an IP change
                // oldIp/newIp crypted with RSA
                case 'ci':
                    hashtable.changeIp(req[1], req[2], function(error) {
                        if (error) console.log(error);
                    });
                    break;

                // friend request
                // ip:pubKey
                case 'fr':
                    utils.friendRequest(req[1], req[2], function(error) {
                        if (error) console.log(error);
                    });
                    break;
                // friend request accept
                // ip:pubKey
                case 'fra':
                    //server.

            }
        });

        conn.on('end', function() {
            console.log('Done.');
        });

    }).listen(this.port);
}

Message.prototype.send = function(ipArray, message, callback) {
    for (var ip in ipArray) {
        var cleanIp = ipArray[ip].substr(7,ipArray[ip].length);
        var client = net.connect(this.port, cleanIp, function() {

            client.write(message);
            client.end();
            callback(null, 'Request successfully sent');

            client.on('error', function(error) {
                console.log(error);
                callback('Remote host is unreachable', null);
            });
        });

        process.on('uncaughtException', function (err) {
            callback('Remote host is unreachable: ' + ip, null);
        });
    }
}

module.exports = Message;
