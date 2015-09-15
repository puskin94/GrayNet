var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var config = require('../jsonFiles/config.json');
var hashTable = require('../jsonFiles/hashTable.json');


function Server() {
    this.port = config.port;
}

Server.prototype.connect = function() {
    var self = this;
    var server = http.createServer(function(request, response) {
        var requestUrl = url.parse(request.url).pathname.split('/');

        switch (requestUrl[1]) {
            case '':
                self.updateIndex();
                self.writeResponse(response, 'index.html');
                break;
            case 'hashTable.json':
                self.writeResponse(response, requestUrl[1]);
                break;
            case 'lff':
                self.lookForFile(requestUrl[2], function(data) {
                    self.writeResponse(response, data);
                });
                break;
            case 'gtf':
                self.getFile(requestUrl[2], function(data) {
                    self.writeResponse(response, data);
                });
        }
    });

    server.listen(this.port);
    console.log('Server is running on port ' + this.port);
    console.log('Try it browsing on http://localhost:' + this.port);
}

Server.prototype.writeResponse = function(response, page) {
    if (page === 'index.html' || page === 'hashTable.json') {
        fs.readFile(page, function(err,data) {
            (!err) ? response.end(data) : response.end(err);
        });
    } else {
        response.end(page);
    }
}

Server.prototype.getFile = function(file, callback) {
    // ottengo i nomi di tutti i files che ho salvati in cache
    fs.readdir('cache', function(error, filename) {
        // calcolo l'hash di ogni singolo file finchè non trovo quello corretto
        for (var singleFile in filename) {
            fs.readFile('../cache/' + filename[singleFile], function (err, data) {
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


Server.prototype.lookForFile = function(page, callback) {
    var self = this;
    for (var hash in hashTable) {
        if (page == hash) {
            // richiedo dati aggiornati a tutti i nodi di GrayNet
            for (var address in hashTable[hash]) {
                request(hashTable[hash][address] + ':' + self.port + '/gtf/' + page, function (error, res, body) {
                    if (!error && res.statusCode == 200) {
                        // download the page in 'cache/' if it doesn't exists in the folder.
                        getFile(page, function(file) {
                            // not exists.
                            if (file == '') {
                                fs.writeFile('../cache/' + page, body, function(err) {
                                    if(err) throw err;
                                });
                            }
                            callback(body);
                        });
                    } else {
                        callback('<h1>File not Available</h1>');
                    }
                    // se l'indirizzo che sto controllando è l'ultimo tra quelli nella hashtable e ricevo un risultato negativo,
                    // controllo se è presente una copia del file in locale.
                    if (hashTable[hash][address] == hashTable[hash][hashTable[hash].length - 1]) {
                        self.getFile(page, function(data) {
                            callback(data);
                        });
                    }
                });
            }
        }
    }
}

// this function updates the index file with new discovered Datas through the net
Server.prototype.updateIndex = function() {
    var self = this;
    var link = '';

    fs.readFile(config.htFilename, function(error, dataHt) {
        if (error) throw error;
        var readable = JSON.parse(dataHt);

        for (var key in readable) {
            link += '<a href="http://localhost:' + self.port + '/lff/' + key +'">' + key + '</a><br>\n';
        }

        fs.readFile('../frontend/index.html', function(error, dataIx) {

            var regex = new RegExp('(<div id="URLS">)((.|\n)*)(<\/div>)', 'i');
            var res = dataIx.toString().replace(regex, '$1\n\n' + link + '\n\n$4');

            fs.writeFile('index.html', res, function(err) {
                if(err) throw err;
            });

        });
    });
}

// la hashTable è così composta:
// 238723ggwe8r7: [123.234.345.456, 123.345.567.234]
Server.prototype.askForHashTable = function(ip, callback) {
    console.log('Downloading Updated HashTable from ' + ip);
    request(ip + ':' + this.port + '/hashTable.json', function (error, response, body) {
        (!error && response.statusCode == 200) ? callback(body) : console.log(error);
    });
}


module.exports = Server;
