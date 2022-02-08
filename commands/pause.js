const guildData = require("../guildData.js");

module.exports = async function pause(message){
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to pause tracks");
    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue){
        message.channel.send("No track to pause");
        return;
    }

    const audioPlayer = serverQueue.audioPlayer;

    if(!audioPlayer){
        message.channel.send("No track to pause");
        return
    }

    audioPlayer.pause();
    message.channel.send("Track paused");
}