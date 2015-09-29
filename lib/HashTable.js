var fs = require('fs');
var request = require('request');
var crypto = require('crypto');
var config = require('../jsonFiles/config.json');
var utils = require('./Utils.js');


function HashTable() {
    var self = this;
    this.sharedFiles = fs.readdirSync(config.cache);

    fs.readFile(config.htFilename, function(error, hashTable) {
        var ht = JSON.parse(hashTable);
        for (var shared in self.sharedFiles) {
            // check if in the 'cache/' dir there are new files, added during
            // the GrayNet not execution
            if (!ht[shared]) {
                fs.readFile(config.cache + self.sharedFiles[shared], function (err, data) {
                    utils.externalIp(function(errIp, ip) {

                        ht[crypto.createHash('sha256').update(data, 'utf8').digest('hex')] = [ip];
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
        if (ht[filename].length == 1 && ht[filename] == ip) {
            delete ht[filename];
        } else {
            ht[filename].splice(ht[filename].indexOf(ip), 1);
        }
        fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
            if(err) throw err;
        });
    });
}

module.exports = HashTable;
