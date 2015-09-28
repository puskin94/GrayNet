var fs = require('fs');
var request = require('request');
var publicIp = require('public-ip');
var config = require('../jsonFiles/config.json');
var utils = require('./Utils.js');

function HashTable() {
    this.sharedFiles = fs.readdirSync(config.cache);
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
