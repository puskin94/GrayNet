var fs = require('fs');
var request = require('request');
var publicIp = require('public-ip');
var Server = require('./Server.js');
var config = require('../jsonFiles/config.json');
var utils = require('./Utils.js');

var server = new Server();

function HashTable() {
    this.sharedFiles = fs.readdirSync(config.cache);
}

// add a new Node to the WellKnownPeer. This node will share with you his local
// network.
HashTable.prototype.addWellKnownPeer = function(ip) {
    var self = this;

    utils.formatIp(ip, function(errIp, ipWithProtocol) {
        if(errIp) throw errIp;

        fs.readFile(config.mlFilename, function(error, data) {
            var readable = JSON.parse(data);

            if (readable['wellKnownPeers'].indexOf(ipWithProtocol) == -1) {
                readable['wellKnownPeers'].push(ipWithProtocol);

                fs.writeFile(config.mlFilename, JSON.stringify(readable), function(err) {
                    if(err) throw err;
                });

            } else {
                console.log('You already know this Ip!');
            }

            // get remote HashTable
            server.askForHashTable(ipWithProtocol, function(remoteHt) {
                console.log('Done.');
                // compare if there are new nodes
                fs.readFile(config.htFilename, function(error, localHt) {
                    var rHt = JSON.parse(remoteHt);
                    var lHt = JSON.parse(localHt);

                    // if so, update the local hashTable with new hosts
                    for (var rKey in rHt) {
                        for (var lKey in lHt) {
                            if (lKey == rKey) {
                                var remoteButNotLocal = rHt[rKey].filter(function(x) { return lHt[lKey].indexOf(x) < 0 });
                                if (remoteButNotLocal.length > 0) {
                                    lHt[lKey].push(remoteButNotLocal.toString());
                                }
                            }
                        }
                    }
                    // download new keys too
                    for (var rKey in rHt) {
                        if (!(rKey in lHt)) {
                            lHt[rKey] = rHt[rKey];
                        }
                    }

                    fs.writeFile(config.htFilename, JSON.stringify(lHt), function(err) {
                        if(err) throw err;
                    });
                });

            });
        });
    });
}

HashTable.prototype.removeFile = function(filename) {
    var self = this;
    var file = filename.split('/')[1];
    this.sharedFiles.splice(this.sharedFiles.indexOf(filename), 1);
    fs.readFile(config.htFilename, function(error, hashTable) {
        var ht = JSON.parse(hashTable);
        publicIp(function (err, ip) {
            if (ht[file].length == 1 && ht[file] == 'http://' + ip) {
                delete ht[file];
            } else {
                ht[file].splice(ht[file].indexOf('http://' + ip), 1);
            }
            fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
                if(err) throw err;
            });
        });
    });
}

module.exports = HashTable;
