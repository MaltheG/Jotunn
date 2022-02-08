const guildData = require("../guildData.js");

module.exports = async function unpause(message){
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to unpause tracks");
    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue){
        message.channel.send("No track to unpause");
        return;
    }

    const audioPlayer = serverQueue.audioPlayer;

    if(!audioPlayer){
        message.channel.send("No track to unpause");
        return
    }

    audioPlayer.unpause();
    message.channel.send("Track resumed");
}