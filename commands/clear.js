const guildData = require("../guildData.js");

module.exports = async function clear(message){
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to clear the queue");

    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 2){
        message.channel.send("No queue to clear");
        return;
    }

    serverQueue.songs.splice(1);

    message.channel.send("Queue cleared");
}