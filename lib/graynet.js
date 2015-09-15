var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var publicIp = require('public-ip');
var watch = require('watch');
var Server = require('./Server.js');
var HashTable = require('./HashTable.js');
var config = require('../jsonFiles/config.json');

var externalIp;

var server = new Server();
var hashtable = new HashTable();
server.connect();


var option = process.argv[2];

if (option === '--add') {
    hashtable.addWellKnownPeer(process.argv[3]);
}

publicIp(function (err, ip) {
    externalIp = 'http://' + ip;
});




// fs.watch looks for 'cache/' changes. If a file is created/downloaded,
// 'sha256sum: ["externalIP"]' is added to the local hashTable.
// Otherwise, if a file is deleted, the touple is removed from the local HT.

watch.watchTree('../cache/', function (file, curr, prev) {
    if (prev === null) {
        // new file
        file = file.toString().split('/')[1];
        if (typeof(file) != 'undefined') {
            fs.readFile(config.htFilename, function(error, hashTable) {
                var ht = JSON.parse(hashTable);
                ht[file] = [externalIp];

                if (externalIp != null) {
                    fs.writeFile('hashTable.json', JSON.stringify(ht), function(err) {
                        if(err) throw err;
                    });
                }

                server.updateIndex();
            });
        }
    } else if (curr.nlink === 0) {
        // file deleted
        removeFile(file);
        updateIndex();
    }
});
