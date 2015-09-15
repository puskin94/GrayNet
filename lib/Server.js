var http = require('http');
var url = require('url');
var fs = require('fs');
var crypto = require('crypto');
var request = require('request');
var config = require('../jsonFiles/config.json');
var hashTable = require('../jsonFiles/hashTable.json');
var utils = require('./Utils.js');


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
                self.writeResponse(null, response, 'index');
                break;
            case 'hashTable':
                self.writeResponse(null, response, requestUrl[1]);
                break;
            case 'css':
                self.writeResponse(null, response, 'style');
                break;
            case 'lff':
                self.lookForFile(requestUrl[2], function(error, from, data) {
                    self.writeResponse(error, response, data);
                });
                break;
            case 'gtf':
                self.getFile(requestUrl[2], function(error, data) {
                    self.writeResponse(error, response, data);
                });
        }
    });

    server.listen(this.port);
    console.log('Server is running on port ' + this.port);
    console.log('Try it browsing on http://localhost:' + this.port);
}

Server.prototype.writeResponse = function(error, response, page) {
    if (error == 404) { page = 404 };
    var type = ((page === 'style') ? 'text/css' : 'text/html');

    var fileToReturn = {'404' : config.page404,
                        'index' : config.index,
                        'hashTable' : config.htFilename,
                        'style' : 'frontend/css/style.css'};

    var file = fileToReturn[page] || '';
    response.writeHead(200, type);

    if (file != '') {
        fs.readFile(file, function(err,data) {
            (!err) ? response.end(data) : response.end(err);
        });
    } else {
        response.end(page);
    }
}

Server.prototype.getFile = function(file, callback) {
    // ottengo i nomi di tutti i files che ho salvati in cache
    fs.readdir(config.cache, function(error, filename) {
        // calcolo l'hash di ogni singolo file finchè non trovo quello corretto
        if (filename.length > 0) {
            for (var singleFile in filename) {
                fs.readFile(config.cache + filename[singleFile], function (err, data) {
                    if (err) console.log(err);
                    // questo host ha il file che stiamo cercando
                    if (crypto.createHash('sha256').update(data, 'utf8').digest('hex') == file) {
                        callback(null, data);
                    }
                });
            }
        }
        // se il file che stiamo controllando è l'utlimo e non è ancora stata
        // effettuata la callback o la cartella config.cache è vuota, mandiamo in
        // callback un errore
        callback(404, null);
    });
}


Server.prototype.lookForFile = function(page, callback) {
    var self = this;

    self.getFile(page, function(errorGf, data) {
        if (errorGf != 404) {
            callback(null, 'local', data.toString());
        } else {
            for (var hash in hashTable) {
                if (page == hash) {
                    // richiedo dati aggiornati a tutti i nodi di GrayNet
                    for (var address in hashTable[hash]) {
                        request(hashTable[hash][address] + ':' + self.port + '/gtf/' + page, function (error, res, body) {
                            if (!error && res.statusCode == 200) {
                                // download the page in config.cache if it doesn't exists in the folder.
                                self.getFile(page, function(errorGf, file) {
                                    // not exists locally.
                                    if (errorGf == 404) {
                                        utils.savePage(page, body);
                                    }
                                    callback(null, 'remote', body);
                                });
                            } else if (hashTable[hash][address] == hashTable[hash][hashTable[hash].length - 1]) {
                                callback(404, null, null);
                            }

                        });
                    }
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
            link += '<a href="http://localhost:' + self.port + '/lff/' + key +'">' + key + '</a><br>\n';
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

// la hashTable è così composta:
// 238723ggwe8r7: [123.234.345.456, 123.345.567.234]
Server.prototype.askForHashTable = function(ip, callback) {
    console.log('Downloading Updated HashTable from ' + ip);
    request(ip + ':' + this.port + '/hashTable.json', function (error, response, body) {
        (!error && response.statusCode == 200) ? callback(body) : console.log(error);
    });
}

module.exports = Server;
