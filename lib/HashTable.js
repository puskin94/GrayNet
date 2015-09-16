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
