var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var externalip = require('external-ip');
var request = require('request');
var watch = require('watch');
var Server = require('./Server.js');
var HashTable = require('./HashTable.js');
var config = require('../jsonFiles/config.json');

if (!fs.existsSync(config.cache)){
    fs.mkdirSync(config.cache);
}

var server = new Server();
var hashtable = new HashTable();
server.connect();


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
                console.log('hei?')
                externalIp(function (ip) {
                    console.log(ip)
                    if (!ht[file]) {
                        ht[file] = [ip];
                    } else if (ht[file].indexOf(ip) == -1) {
                        ht[file].push(ip);
                    }
                    console.log(ht)
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


function externalIp(callback) {
    request('http://icanhazip.com/', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            callback('http://' + body.trim())
        }
    });
}
