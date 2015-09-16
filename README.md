##GrayNet.js

GrayNet.js is  a simple implementation of a P2P net. Every host can join this service and share his own files.

###How does it works?

Main files for a correct browsing are `hashTable.json` and `mirrorlist.json` located under `jsonFiles` folder.
#####HashTable.json
`hashTable.json` is an HashTable that contains 2 kind of data:
1) a file checksum, computed with the sha256 algorithm
2) an array of IPs who owns that file
#####mirrorlist.json
`mirrorlist.json` contains all the IPs that you added to your `wellKnownPeers`; You can download their `hashTable` ang get their links.

###How browsing works?
Just clone this repo, enter the folder and type `npm start`.
Now you can visit `http://localhost:1337` and join the GrayNet.js community.
Once you visited a link, the server downloads that file in the `cache/` folder and adds your IP to your local copy of the hashTable. The next time you'll visit that link, you will not need to download again that file ;) Server will serve you the local copy :+1:
