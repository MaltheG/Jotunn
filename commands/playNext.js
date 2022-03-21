const {play} = require("./play.js");
const guildData = require("../guildData.js");

module.exports = async function playNext(message){
    await play(message);

    const guildID = message.guild.id;
    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 3){
        return
    }

    const lastSong = serverQueue.songs.pop();
    serverQueue.songs.splice(1, 0, lastSong);

    message.channel.send(lastSong.title + " moved to front of the queue");
}