var fs = require('fs');
var request = require('request');
var config = require('../jsonFiles/config.json');
var utils = require('./Utils.js');


function HashTable() {
    this.sharedFiles = fs.readdirSync(config.cache);
}

HashTable.prototype.init = function() {
    var self = this;

    fs.readFile(config.htFilename, function(error, hashTable) {
        var ht = JSON.parse(hashTable);
        for (var shared in self.sharedFiles) {
            // check if in the 'cache/' dir there are new files, added during
            // the GrayNet not execution
            if (!ht[shared]) {
                fs.readFile(config.cache + self.sharedFiles[shared], function (err, data) {
                    var title = utils.getTitle(data);
                    utils.externalIp(function(errIp, ip) {
                        var fileSum = utils.getSum(data);
                        ht[fileSum] = {
                            "ip":[ip],
                            "title": title
                        };
                        fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
                            if(err) throw err;
                        });
                    });
                });
            }
        }
    });
}


HashTable.prototype.removeFile = function(filename, ip) {
    var self = this;
    this.sharedFiles.splice(this.sharedFiles.indexOf(filename), 1);
    fs.readFile(config.htFilename, function(error, hashTable) {
        var ht = JSON.parse(hashTable);

        ((ht[filename]['ip'].length == 1) ?
            delete ht[filename] :
            ht[filename]['ip'].splice(ht[filename]['ip'].indexOf(ip), 1));

        fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
            if(err) throw err;
        });
    });
}

HashTable.prototype.getWellKnownPeers = function(callback) {
    var wellKnownPeers = [];

    fs.readFile(config.mlFilename, function(error, mirrorList) {
        var ml = JSON.parse(mirrorList.toString());

        for (var peer in ml) {
            wellKnownPeers.push(peer);
        }

        (wellKnownPeers.length > 0) ?
            callback(null, wellKnownPeers) :
            callback('wellKnownPeers is Empty!', null);
    });
}

// this function returns an object composed by she sha1sum and the article title
HashTable.prototype.getFilesFromIp = function(ip, callback) {
    fs.readFile(config.htFilename, function(error, hashTable) {
        var ht = JSON.parse(hashTable);
        var files = {};

        for (var file in ht) {
            if (ht[file]['ip'].indexOf(ip) != -1) {
                files[file] = ht[file]['title'];
            }
        }
        callback(files);
    });
}

HashTable.prototype.changeIp = function(oldIp, newIpEnc, callback) {
    var self = this;

    utils.formatIp(oldIp, function(errIp, formattedIp) {
        if (errIp) {
            callback(errIp);
        } else {
            self.getWellKnownPeers(function(err, peers) {
                if (err) {
                    callback(err);
                } else {
                    if (peers.indexOf(formattedIp) != -1) {
                        utils.getPublicKeyFromIp(formattedIp, function(pubKey) {
                            var newIp = utils.decRSA(pubKey, newIpEnc);
                            // change the ip inside the mirrorList
                            fs.readFile(config.mlFilename, function(error, mirrorList) {
                                var ml = JSON.parse(mirrorList);
                                var pubKey = ml[old]['pubKey'];

                                ml[newIp] = {
                                    "pubKey": pubKey
                                };
                                delete ml[old];

                                // change the ip inside the hashTable
                                fs.writeFile(config.mlFilename, JSON.stringify(ml), function(err) {
                                    if(err) throw err;

                                    fs.readFile(config.htFilename, function(error, hashTable) {
                                        var ht = JSON.parse(hashTable);

                                        for (var key in ht) {
                                            if (ht[key]['ip'].indexOf(old) != -1) {
                                                ht[key]['ip'].splice(ht[key]['ip'].indexOf(old), 1);
                                                ht[key]['ip'].push(newIp);
                                            }
                                        }

                                        fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
                                            if(err) throw err;
                                            callback(null, 'ok');
                                        });
                                    });
                                });
                            });
                        });
                    } else {
                        callback('This ip is not in your mirrorList');
                    }
                }
            });
        }
    });
}
module.exports = HashTable;
