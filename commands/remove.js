const guildData = require("../guildData.js");

module.exports = async function remove(message){
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to edit the queue");

    const guildID = message.guild.id;

    //Remove ".remove " from message
    const songName = message.content.substr(8).trim()

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 2){
        message.channel.send("No song to remove");
        return
    }

    const prevLength = serverQueue.songs.length;

    //Filter songs that match the song name
    serverQueue.songs = serverQueue.songs.filter(function(song) {
        return song.title !== songName;
    });

    //If length is not changed song(s) were not removed
    if(serverQueue.songs.length === prevLength) {
        message.channel.send(`Failed to remove ${songName} from the queue`);
        return
    }

    //Song(s) were removed
    message.channel.send(`Successfully removed ${songName} from the queue`);
}