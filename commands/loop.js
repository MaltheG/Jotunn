const db = require("../guildData.js");

module.exports = async function loop(message){
    const guildID = message.guild.id;

    const serverQueue = db.getServerQueue(guildID)

    if(!serverQueue || serverQueue.songs.length < 1){
        message.channel.send("No track to loop");
        return
    }

    if(serverQueue.loop){
        serverQueue.loop = false;
        message.channel.send("Track no longer looping");
    } else {
        serverQueue.loop = true;
        message.channel.send("Looping track");
    }
}