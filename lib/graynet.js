var fs = require('fs');
var request = require('request');
var watch = require('watch');
var NodeRSA = require('node-rsa');
var Server = require('./Server.js');
var HashTable = require('./HashTable.js');
var utils = require('./Utils.js');
var Message = require('./Message.js');
var config = require('../jsonFiles/config.json');

if (!fs.existsSync(config.cache)) {
    fs.mkdirSync(config.cache);
}

if (!fs.existsSync(config.rsaKeysFolders)) {
    fs.mkdirSync(config.rsaKeysFolders);

    console.log('Generating RSA 2048 key pair...');
    var key = new NodeRSA({b: 2048});

    var publicKey = key.exportKey('pkcs1-public-pem');
    var privateKey = key.exportKey('pkcs1-pem');

    fs.writeFileSync(config.rsaKeysFolders + 'private.key', privateKey);
    fs.writeFileSync(config.rsaKeysFolders + 'public.key', publicKey);
    console.log('Done!');
}

var server = new Server();
var hashtable = new HashTable();
var message = new Message();
server.connect();
hashtable.init();
message.server();

// chech if the previous ip is the same as the actual.
// if not, alert all your friends to change their hashTables with the new ip.
utils.externalIp(function (err, ip) {
    if (err) console.log(err);

    if (config.oldIp != ip) {
        // update the config file
        fs.readFile('jsonFiles/config.json', function(err, confFile) {
            var conf = JSON.parse(confFile);
            var oldIp = conf.oldIp;
            conf.oldIp = ip;
            fs.writeFileSync('jsonFiles/config.json', JSON.stringify(conf));

            // and then, alert friends
            if (oldIp) {
                hashtable.getWellKnownPeers(function(err, peers) {
                    if (err) {
                        console.log('Sending your new Ip: ' + err);
                    } else {

                        var encNewIp = utils.encRSA(ip);
                        var msg = 'ci:'+ oldIp.substr(7, oldIp.length) + ':' + encNewIp;

                        message.send(peers, msg);
                    }
                });
            }
        });
    }
});


// watch looks for 'cache/' changes. If a file is created/downloaded,
// 'sha1sum: ["externalIP"]' is added to the local hashTable.
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

