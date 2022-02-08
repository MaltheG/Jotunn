const guildData = require("../guildData.js");
const {getVoiceConnection} = require("@discordjs/voice");

module.exports = async function disconnect(message){
    if(!message.member.voice.channel) {
        message.channel.send("You have to be in a voice channel to disconnect the bot");
        return
    }

    const guildID = message.guild.id;

    const connection = getVoiceConnection(guildID);
    if(connection){
        connection.destroy()
    }

    const audioPlayer = guildData.getServerQueue(guildID).audioPlayer;
    if(audioPlayer){
        audioPlayer.stop();
    }

    guildData.removeServerQueue(guildID);
}