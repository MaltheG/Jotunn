const guildData = require("../guildData.js");
const {joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus} = require("@discordjs/voice");

module.exports = async function join(message){
    //Check if the user is in a voice channel
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel){
        message.channel.send("You need to be in a voice channel to play music you dumb dumb.");
        return false;
    }

    //Check if the bot has permissions to join/speak in channel
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if(!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        message.channel.send("I need permission to join and speak in your channel.")
        return false;
    }

    const serverQueue = guildData.getServerQueue(message.guild.id);

    //Check if we are already connected
    if(!serverQueue){

        const audioPlayer = createAudioPlayer();

        //If not, create new queueConstruct. This holds all information about current session
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            audioPlayer: audioPlayer,
            songs: [],
            volume: 100,
            playing: false,
            loop: false,
        };

        //Add construct to list of all serverQueues
        guildData.addServerQueue(message.guild.id, queueConstruct);

        //Try joining the voicechannel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        connection.subscribe(audioPlayer);
        //https://discordjs.guide/voice/voice-connections.html#access
        return true;
    } else {
        message.channel.send("Already in a voice channel");
        return true;
    }
}