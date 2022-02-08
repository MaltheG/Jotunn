const {getVoiceConnection, createAudioResource, AudioPlayerStatus} = require("@discordjs/voice");
const ytsr = require("ytsr");
const ytdl = require("ytdl-core");

const guildData = require("../guildData.js");
const join = require("./join.js");
const mu = require("../messageUtility.js");
const {addSongRequest, addSongPlay} = require("./songHistory.js");

function getSong(query){
    return new Promise((resolve, reject) => {
        ytsr(query, {limit: 1})
            .then(result => {

                if(result.items.length < 1) {
                    console.log("No results from query");
                    reject("No results from query");
                }

                const videoResult = result.items[0];

                const song = {
                    title: videoResult.title,
                    url: videoResult.url,
                    id: videoResult.id,
                    duration: videoResult.duration,
                    thumbnail: videoResult.bestThumbnail.url,
                }

                resolve(song);
            }).catch(err => {
                console.log(err);
                reject(err);
        });
    })
}

async function playSong(guildID, retry){
    const serverQueue = guildData.getServerQueue(guildID);
    const song = serverQueue.songs[0]

    if(!song){
        serverQueue.playing = false;
        return
    }

    const resource = createAudioResource(ytdl(song.url, {
        filter: "audioonly",
        highWaterMark: 1<<20, //We need a higher than usual buffer or else songs will end prematurely
    }));

    const audioPlayer = serverQueue.audioPlayer;

    audioPlayer.play(resource);
    serverQueue.playing = true;
    addSongPlay(song);

    audioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log("Audioplayer is idle");
        if(!serverQueue.loop) {
            serverQueue.songs.shift();
        }
        playSong(guildID, false);
    }).on('error', error => {
        console.log(error);

        if(!retry){
            playSong(guildID, true);
            return
        }

        serverQueue.songs.shift();
        playSong(guildID, false);
    })
}

async function play(message){

    const guildID = message.guild.id;
    let serverQueue = guildData.getServerQueue(guildID);
    //Check if we are in a voice channel
    if(!serverQueue || !getVoiceConnection(guildID)){
        if(!await join(message)){
            //Something went wrong when trying to join a voice channel
            return false
        }
        //Update serverQueue after join
        serverQueue = guildData.getServerQueue(guildID);
    }

    //message.channel.send("Searching...");

    const searchTerm = message.content.substr(message.content.indexOf(' ') + 1).trim();

    getSong(searchTerm).then(song => {
        song.position = serverQueue.songs.length;
        song.guild = guildID;
        song.author = message.member.id;

        //Add request to database
        addSongRequest(song);

        //Push song to queue
        serverQueue.songs.push(song);

        if(!serverQueue.playing) {
            //We are not currently playing a song
            playSong(guildID, false);
            mu.sendSongEmbed(message, song, "Now playing:");
        } else {
            mu.sendSongEmbed(message, song, "Song added:");
        }
    }).catch(err => {
        message.channel.send("Something went wrong when trying to play this song: " + err);
    });
}

module.exports = {
    play: play,
    playSong: playSong,
}