var fs = require('fs');
var request = require('request');
var watch = require('watch');
var Server = require('./Server.js');
var HashTable = require('./HashTable.js');
var utils = require('./Utils.js');
var config = require('../jsonFiles/config.json');

if (!fs.existsSync(config.cache)){
    fs.mkdirSync(config.cache);
}

var server = new Server();
var hashtable = new HashTable();
server.connect();
hashtable.init();


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
                fs.readFile(config.cache + '/' + file, function (err, data) {
                    var title = utils.getTitle(data);
                    var fileSum = utils.getSum(data);

                    utils.externalIp(function (err, ip) {
                        if (err) {
                            console.log(err);
                        } else {
                            if (!ht[fileSum]) {
                                ht[fileSum] = {
                                    "ip":[ip],
                                    "title": title
                                };
                            } else if (ht[fileSum]['ip'].indexOf(ip) == -1) {
                                ht[fileSum]['ip'].push(ip);
                            }
                            fs.writeFile(config.htFilename, JSON.stringify(ht), function(err) {
                                if(err) throw err;
                            });
                        }
                    });
                });
            });
        }
    } else if (curr.nlink === 0) {
        // file deleted
        utils.externalIp(function (err, ip) {
            ((err) ? console.log(err) : hashtable.removeFile(file.split('/')[1], ip));
        });
    }
});

