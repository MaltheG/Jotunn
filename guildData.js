const serverMap = new Map();

function addServerQueue(guildID, serverQueue){
    serverMap.set(guildID, serverQueue);
}

function getServerQueue(guildID){
    return serverMap.get(guildID);
}

function removeServerQueue(guildID){
    serverMap.delete(guildID);
}

module.exports = {
    addServerQueue: addServerQueue,
    getServerQueue: getServerQueue,
    removeServerQueue: removeServerQueue
}