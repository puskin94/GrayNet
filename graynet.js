// TODO: non scarica i files

var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var publicIp = require('public-ip');
var watch = require('watch');

var mirrorList = require('./mirrorlist.json');
var hashTable = require('./hashTable.json');
var sharedFiles = fs.readdirSync('cache/');
var externalIp;

publicIp(function (err, ip) {
    externalIp = 'http://' + ip;
});



var option = process.argv[2];

if (option === '--add') {
    addWellKnownPeer(process.argv[3]);
}

var server = http.createServer(function(request, response) {
    var requestUrl = url.parse(request.url).pathname.split('/');

    switch (requestUrl[1]) {
        case '':
            updateIndex();
            writeResponse(response, 'index.html');
            break;
        case 'hashTable.json':
            writeResponse(response, requestUrl[1]);
            break;
        case 'lff':
            lookForFile(requestUrl[2], function(data) {
                writeResponse(response, data);
            });
            break;
        case 'gtf':
            getFile(requestUrl[2], function(data) {
                writeResponse(response, data);
            });
    }
});

server.listen(1337);

console.log('Server is running on port 1337');
console.log('Try it browsing on http://localhost:1337');

// fs.watch looks for 'cache/' changes. If a file is created/downloaded,
// 'sha256sum: ["externalIP"]' is added to the local hashTable.
// Otherwise, if a file is deleted, the touple is removed from the local HT.

watch.watchTree('cache/', function (file, curr, prev) {
    if (prev === null) {
        // new file
        fs.readFile('hashTable.json', function(error, hashTable) {
            var ht = JSON.parse(hashTable);
            ht[file] = [externalIp];

            if (typeof(ht[file]) != 'object') {
                fs.writeFile('hashTable.json', JSON.stringify(ht), function(err) {
                    if(err) throw err;
                });
            }
        });
        updateIndex();
    } else if (curr.nlink === 0) {
        // file deleted
        removeFile(file);
        updateIndex();
    }
});


function removeFile(filename) {
    sharedFiles.splice(sharedFiles.indexOf(filename), 1);
    fs.readFile('hashTable.json', function(error, hashTable) {
        var ht = JSON.parse(hashTable);
        delete ht[filename];
        fs.writeFile('hashTable.json', JSON.stringify(ht), function(err) {
            if(err) throw err;
        });
    });
}

function writeResponse(response, page) {
    if (page === 'index.html' || page === 'hashTable.json') {
        fs.readFile(page, function(err,data) {
            (!err) ? response.end(data) : response.end(err);
        });
    } else {
        response.end(page);
    }
}

// la hashTable è così composta:
// 238723ggwe8r7: [123.234.345.456, 123.345.567.234]
function askForHashTable(ip, callback) {
    console.log('Downloading Updated HashTable from ' + ip);
    request(ip + ':1337/hashTable.json', function (error, response, body) {
        (!error && response.statusCode == 200) ? callback(body) : console.log(error);
    });
}

// asks to the Net for a specific file
function lookForFile(page, callback) {
    for (var hash in hashTable) {
        if (page == hash) {
            // richiedo dati aggiornati a tutti i nodi di GrayNet
            for (var address in hashTable[hash]) {
                request(hashTable[hash][address] + ':1337/gtf/' + page, function (error, res, body) {
                    if (!error && res.statusCode == 200 && body.toString() != '') {
                        // download the page in 'cache/' if it doesn't exists in the folder.
                        getFile(page, function(file) {
                            // not exists.
                            if (file == '') {
                                fs.writeFile('cache/' + page, body, function(err) {
                                    if(err) throw err;
                                });
                            }
                            callback(body);
                        });
                    } else {
                        console.log(error);
                    }
                    // se l'indirizzo che sto controllando è l'ultimo tra quelli nella hashtable e ricevo un risultato negativo,
                    // controllo se è presente una copia del file in locale.
                    if (hashTable[hash][address] == hashTable[hash][hashTable[hash].length - 1]) {
                        getFile(page, function(data) {
                            callback(data);
                        });
                    }
                });
            }
        }
    }
}

// looks for local files in 'cache/'
function getFile(file, callback) {
    // ottengo i nomi di tutti i files che ho salvati in cache
    fs.readdir('cache', function(error, filename) {
        // calcolo l'hash di ogni singolo file finchè non trovo quello corretto
        for (var singleFile in filename) {
            fs.readFile('cache/' + filename[singleFile], function (err, data) {
                if (err) console.log(err);
                // questo host ha il file che stiamo cercando
                if (crypto.createHash('sha256').update(data, 'utf8').digest('hex') == file) {
                    callback(data);
                }
                // se il file che stiamo controllando è l'utlimo e non è ancora stata effettuata la callback,
                // restituisco una pagina vuota.
                if (filename[singleFile] == filename[filename.length - 1]) {
                    callback('');
                }
            });
        }
    });
}

// add a new Node to the WellKnownPeer. This node will share with you his local
// network.
function addWellKnownPeer(ip) {
    fs.readFile('mirrorlist.json', function(error, data) {
        var readable = JSON.parse(data);
        // ip check and protocol
        var validIpAddr = /(http(s)?\:\/\/)?(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}\/?/i;
        var ipWithProtocol = (!(/http(s)?\:\/\//i.test(ip)) ? 'http://' + ip : ip);

        if (readable['wellKnownPeers'].indexOf(ipWithProtocol) == -1) {
            readable['wellKnownPeers'].push(ipWithProtocol);

            fs.writeFile('mirrorlist.json', JSON.stringify(readable), function(err) {
                if(err) throw err;
            });

        } else {
            console.log('You already know this Ip!');
        }

        // get remote HashTable
        askForHashTable(ipWithProtocol, function(remoteHt) {
            console.log('Done.');
            // compare if there are new nodes
            fs.readFile('hashTable.json', function(error, localHt) {
                var rHt = JSON.parse(remoteHt);
                var lHt = JSON.parse(localHt);

                // if so, update the local hashTable with new hosts
                for (var rKey in rHt) {
                    for (var lKey in lHt) {
                        if (lKey == rKey) {
                            var remoteButNotLocal = rHt[rKey].filter(function(x) { return lHt[lKey].indexOf(x) < 0 });
                            if (remoteButNotLocal.length > 0) {
                                lHt[lKey].push(remoteButNotLocal.toString());
                            }
                        }
                    }
                }
                // download new keys too
                for (var rKey in rHt) {
                    if (!(rKey in lHt)) {
                        lHt[rKey] = rHt[rKey];
                    }
                }

                fs.writeFile('hashTable.json', JSON.stringify(lHt), function(err) {
                    if(err) throw err;
                });
            });

        });
    });
}

// this function updates the index file with new discovered Datas through the net
function updateIndex() {
    var link = '';

    fs.readFile('hashTable.json', function(error, dataHt) {
        if (error) throw error;
        var readable = JSON.parse(dataHt);

        for (var key in readable) {
            link += '<a href="http://localhost:1337/lff/' + key +'">' + key + '</a><br>\n';
        }

        fs.readFile('index.html', function(error, dataIx) {

            var regex = new RegExp('(<div id="URLS">)((.|\n)*)(<\/div>)', 'i');
            var res = dataIx.toString().replace(regex, '$1\n\n' + link + '\n\n$4');

            fs.writeFile('index.html', res, function(err) {
                if(err) throw err;
            });

        });
    });
}
