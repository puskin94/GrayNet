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
        if (ht[filename]['ip'].length == 1 && ht[filename]['ip'] == ip) {
            delete ht[filename];
        } else {
            ht[filename]['ip'].splice(ht[filename]['ip'].indexOf(ip), 1);
        }
        fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
            if(err) throw err;
        });
    });
}

module.exports = HashTable;
