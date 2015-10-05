var http = require('http');
var url = require('url');
var fs = require('fs');
var request = require('request');
var config = require('../jsonFiles/config.json');
var hashTable = require('../jsonFiles/hashTable.json');
var utils = require('./Utils.js');
var HashTable = require('./HashTable.js');

var ht = new HashTable();


function Server() {
    this.port = config.port;
}

Server.prototype.connect = function() {
    var self = this;
    var server = http.createServer(function(request, response) {
        var requestUrl = url.parse(request.url).pathname.split('/');

        switch (requestUrl[1]) {
            // GrayNet Index
            case '':
                self.updateIndex();
                self.send(null, response, 'index');
                break;
            // serve the local HastTable to the Net
            case 'hashTable':
                self.send(null, response, 'hashTable');
                break;
            // get the CSS
            case 'css':
                self.send(null, response, 'style');
                break;
            // look for a local file
            case 'lff':
                self.lookForFile(requestUrl[2], function(error, data) {
                    self.send(error, response, data);
                });
                break;
            // send the public key
            case 'pk':
                fs.readFile(config.rsaKeysFolders + 'public.key', function(error, data) {
                    self.send(error, response, config.username + ':' + data);
                });
                break;
            // look for a remote file
            case 'gtf':
                self.getFile(requestUrl[2], function(error, data) {
                    self.send(error, response, data);
                });
                break;
            // add a host (wellKnownPeer)
            case 'ah':
                if (requestUrl[2] == '') {
                    self.send(null, response, 'addHost');
                } else {
                    self.addWellKnownPeer(requestUrl[2], function(error, data) {
                        self.send(error, response, data);
                    });
                }
                break;
            // show the wellKnownPeers
            case 'sh':
                self.showWellKnownPeers(requestUrl[2], function(error, peers) {
                    self.send(error, response, peers);
                });
                break;
            // update the HashTable
            case 'uht':
                ht.getWellKnownPeers(function(err, peers) {
                    if (err) {
                        self.send(err, response, null);
                    } else {
                        self.updateHashTable(peers, function(error, res) {
                            self.send(error, response, res);
                        });
                    }
                });
                break;
        }
    });

    server.listen(this.port);
    console.log('Server is running on port ' + this.port);
    console.log('Try it browsing on http://127.0.0.1:' + this.port);
}

Server.prototype.send = function(error, response, page) {
    var type = ((page === 'style') ? 'text/css' : 'text/html');

    var fileToReturn = {'index' : config.index,
                        'hashTable' : config.htFilename,
                        'style' : config.style,
                        'addHost': config.addHost};

    var file = fileToReturn[page] || '';

    var header = ((page != 'style' && page != 'hashTable') ? fs.readFileSync(config.header) : '');
    var data = ((file != '') ? fs.readFileSync(file) : ((error && error != 'custom' && error != 'local') ? error : page));
    var footer = ((page != 'style' && page != 'hashTable') ? fs.readFileSync(config.footer) : '');

    var toSend = ((error == 'local') ? data : header + data + footer);

    response.writeHead(200, type);
    response.end(toSend);

}

Server.prototype.getFile = function(file, callback) {
    // ottengo i nomi di tutti i files che ho salvati in cache
    fs.readdir(config.cache, function(error, filename) {
        // calcolo l'hash di ogni singolo file finchè non trovo quello corretto
        if (filename.length > 0) {
            var lastElem = filename[filename.length - 1];
            for (var singleFile in filename) {
                fs.readFile(config.cache + filename[singleFile], function (err, data) {
                    if (err) console.log(err);
                    // if this host has the requested file
                    if (utils.getSum(data) == file) {
                        callback('local', data);
                    } else if(filename[singleFile] == lastElem) {
                        // callback a '404' error if the requested file is not present locally
                        callback(404, null);
                    }
                });
            }
        } else {
            callback(404, null);
        }
    });
}


Server.prototype.lookForFile = function(page, callback) {
    var self = this;

    self.getFile(page, function(errorGf, data) {
        if (errorGf != 404) {
            callback(null, data);
        } else {
            self.getRemoteContent(page, function(errorR, remoteData) {
                callback(errorR, remoteData);
            });
        }
    });
}

Server.prototype.getRemoteContent = function(page, callback) {
    var self = this;

    fs.readFile(config.htFilename, function(error, dataHt) {
        var readable = JSON.parse(dataHt);
        for (var hash in readable) {
            if (page == hash) {
                var lastElem = readable[hash]['ip'][readable[hash]['ip'].length - 1];
                for (var address in readable[hash]['ip']) {
                    request(readable[hash]['ip'][address] + ':' + self.port + '/gtf/' + page, function (error, res, body) {
                        if (error) {
                            // if the ip is not Up, just remove it from the local hashTable
                            ht.removeFile(page, readable[hash]['ip'][address]);
                        } else if (res.statusCode == 200) {
                            // download the page in config.cache if it doesn't exists in the folder.
                            self.getFile(page, function(errorGf, file) {
                                // not exists locally.
                                if (errorGf == 404) {
                                    utils.savePage(page, body);
                                }
                                callback(null, body);
                            });
                        } else if (readable[hash]['ip'][address] == lastElem) {
                            callback('This resource is not available', null);
                        }
                    });
                }
            }
        }
    });
}

// this function updates the index file with new discovered Datas through the net
Server.prototype.updateIndex = function() {
    var self = this;
    var link = '';

    fs.readFile(config.htFilename, function(error, dataHt) {
        if (error) throw error;
        var readable = JSON.parse(dataHt);

        for (var key in readable) {
            link += ((readable[key]['title'] != '') ? '<b><i>' + readable[key]['title'] + ': </i></b> ' : '') +
                    '<a href="http://localhost:' + self.port + '/lff/' + key +'">' +
                    key.substr(0,7) +
                    '</a><br>\n';
        }

        fs.readFile(config.index, function(error, dataIx) {

            var regex = new RegExp('(<div id="URLS">)((.|\n)*)(<\/div>)', 'i');
            var res = dataIx.toString().replace(regex, '$1\n\n' + link + '\n\n$4');

            fs.writeFile(config.index, res, function(err) {
                if(err) throw err;
            });

        });
    });
}

// add a new Node to the WellKnownPeer. This node will share with you his local
// network.
Server.prototype.addWellKnownPeer = function(ip, callback) {
    var self = this;

    utils.formatIp(ip, function(errIp, ipWithProtocol) {
        if (errIp) callback('Wrong Ip Format', null);

        fs.readFile(config.mlFilename, function(error, data) {
            var readable = JSON.parse(data);

            if (!readable[ipWithProtocol]) {

                request(ipWithProtocol + ':' + this.port + '/pk', function (error, response, body) {
                    if ((!error && response.statusCode == 200)) {

                        var infos = body.split(':');

                        var user = infos[0];
                        var pubKey = infos[1];

                        readable[ipWithProtocol] = {
                            "username": user,
                            "pubKey": pubKey
                        };

                        fs.writeFile(config.mlFilename, JSON.stringify(readable), function(err) {
                            if(err) throw err;

                            self.updateHashTable([ipWithProtocol], function(error, res) {
                                callback(error, res);
                            });
                        });
                    }
                });
            }
        });
    });
}

Server.prototype.askForHashTable = function(ip, callback) {
    console.log('Downloading HashTable from ' + ip);
    request(ip + ':' + this.port + '/hashTable', function (error, response, body) {
        (!error && response.statusCode == 200) ?
            callback(null, body) :
            callback('No internet connection to ' + ip, null);
    });
}

Server.prototype.updateHashTable = function(ip, callback) {
    var self = this;
    var newHosts = 0,
    newFiles = 0;

    var lastElem = ip[ip.length - 1];

    // ip is an array. This is for a better updateHashTable when it is not
    // called by addWellKnownPeer
    for (var peer in ip) {
        // get remote hashTable
        self.askForHashTable(ip[peer], function(errAFH, remoteHt) {
            // compare if there are new nodes
            if (errAFH) {
                callback(errAFH, null);
            } else {
                fs.readFile(config.htFilename, function(error, localHt) {
                    var rHt = JSON.parse(remoteHt),
                    lHt = JSON.parse(localHt);

                    // if so, update the local hashTable with new hosts
                    for (var rKey in rHt) {
                        for (var lKey in lHt) {
                            if (lKey == rKey) {
                                var remoteButNotLocal = rHt[rKey]['ip'].filter(function(x) { return lHt[lKey]['ip'].indexOf(x) < 0 });
                                if (remoteButNotLocal.length > 0) {
                                    lHt[lKey]['ip'].push(remoteButNotLocal.toString());
                                    newHosts++;
                                }
                            }
                        }
                    }
                    // download new keys too
                    for (var rKey in rHt) {
                        if (!(rKey in lHt)) {
                            lHt[rKey] = rHt[rKey];
                            newFiles++;
                        }
                    }

                    if (ip[peer] == lastElem) {
                        fs.writeFile(config.htFilename, JSON.stringify(lHt), function(errWF) {
                            if (errWF) throw err;
                            callback(null, 'Done<br>New keys: ' + newFiles + '<br>New Hosts: ' + newHosts);
                        });
                    }
                });
            }
        });
    }
}

Server.prototype.showWellKnownPeers = function(url, callback) {
    ht.getWellKnownPeers(function(err, wellKnownPeers) {
        if (err) {
            callback(err, null);
        } else {
            if (url == '') {
                var toPrint = '<h3>Well Known Peers</h3><br><br>';
                for (var peer in wellKnownPeers) {
                    toPrint += '<a href="/sh/' +
                    wellKnownPeers[peer].substr(7, wellKnownPeers[peer].length) +
                    '">' + wellKnownPeers[peer] + '</a><br>';
                }
                callback(null, toPrint);
            } else {
                if (wellKnownPeers.indexOf('http://' + url) != -1) {
                    utils.formatIp(url, function(errIp, ip) {
                        if (errIp) {
                            callback(errIp, null);
                        } else {
                            ht.getFilesFromIp(ip, function(files) {
                                var toPrint = '<div id="subTitle"><h4>' + url + ' is sharing these files with you:</h4></div><br><br>';
                                for (var file in files) {
                                    toPrint += ((files[file] != '') ? '<b><i>' + files[file] + ': </i></b>' : '') +
                                    '<a href="/lff/' + file + '">' +
                                    file.substr(0,7) + '</a><br>';
                                }
                                callback(null, toPrint);
                            });
                        }
                    });
                } else {
                    callback(url + ' doesn\'t exists in your HashTable', null);
                }
            }
        }
    });
}

module.exports = Server;
