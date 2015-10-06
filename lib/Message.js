var net = require('net');
var HashTable = require('./HashTable.js');
var config = require('../jsonFiles/config.json');

var hashtable = new HashTable();

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
            }
        });

        conn.on('end', function() {
            console.log('Done.');
        });

    }).listen(this.port);
}

Message.prototype.send = function(ipArray, message) {
    for (var ip in ipArray) {

        var client = net.connect(this.port, ipArray[ip], function() {

            client.write(message);
            client.end();

            client.on('error', function(error) {
                console.log(error);
            });
        });
    }
}

module.exports = Message;
