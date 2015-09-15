var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var publicIp = require('public-ip');
var request = require('request');
var watch = require('watch');
var Server = require('./Server.js');
var HashTable = require('./HashTable.js');
var config = require('../jsonFiles/config.json');


var server = new Server();
var hashtable = new HashTable();
server.connect();

var option = process.argv[2];

if (option === '--add') {
    hashtable.addWellKnownPeer(process.argv[3]);
}


// watch looks for 'cache/' changes. If a file is created/downloaded,
// 'sha256sum: ["externalIP"]' is added to the local hashTable.
// Otherwise, if a file is deleted, the touple is removed from the local HT.

watch.watchTree(config.cache, function (file, curr, prev) {
    if (prev === null) {
        // new file
        file = file.toString().split('/')[1];
        if (typeof(file) != 'undefined') {
            fs.readFile(config.htFilename, function(error, hashTable) {
                var ht = JSON.parse(hashTable);
                publicIp(function (err, ip) {
                    if (!ht[file]) {
                        ht[file] = ['http://' + ip];
                    } else if (ht[file].indexOf('http://' + ip) == -1) {
                        ht[file].push('http://' + ip);
                    }
                    fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
                        if(err) throw err;
                    });
                });
            });
        }
    } else if (curr.nlink === 0) {
        // file deleted
        hashtable.removeFile(file);
        server.updateIndex();
    }
});
