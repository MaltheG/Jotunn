const mu = require("../messageUtility.js");
const guildData = require("../guildData.js");

module.exports = async function nowPlaying(message){
    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 1){
        message.channel.send("Not currently playing any song");
        return
    }

    const currentSong = serverQueue.songs[0];
    currentSong.position = 0;

    mu.sendSongEmbed(message, currentSong, "Currently playing: ");
}