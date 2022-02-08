const guildData = require("../guildData.js");
const {playSong} = require("./play.js");
const mu = require("../messageUtility.js");

module.exports = async function skip(message){
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip songs");
    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 1){
        message.channel.send("No song to skip");
    }

    const audioPlayer = serverQueue.audioPlayer;

    if(!audioPlayer){
        return;
    }

    audioPlayer.stop();

    serverQueue.songs.shift();
    message.channel.send("Song skipped");

    const song = serverQueue.songs[0];
    if(!song){
        return;
    }
    song.position = 0;

    playSong(guildID);

    mu.sendSongEmbed(message, song, "Now playing:")
}