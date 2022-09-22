const {getVoiceConnection, createAudioResource, AudioPlayerStatus} = require("@discordjs/voice");
const pl = require("play-dl");

const guildData = require("../guildData.js");
const join = require("./join.js");
const mu = require("../messageUtility.js");
const {addSongRequest, addSongPlay} = require("./songHistory.js");

function getSong(query){
    return new Promise((resolve, reject) => {

        const result = {
            type: "unknown",
            songs: []
        }

        //First check if query is url
        if(query.startsWith("https")){
            //Check if youtube link:
            if(pl.yt_validate(query) === "video"){
                pl.video_basic_info(query).then(res => {
                    const videoResult = res.video_details;

                    const song = {
                        title: videoResult.title,
                        url: videoResult.url,
                        id: videoResult.id,
                        duration: videoResult.durationRaw,
                        thumbnail: videoResult.thumbnails.pop().url,
                    }
                    
                    result.type = "video";
                    result.songs.push(song);

                    resolve(result);
                }).catch(err => {
                    console.log(err);
                    reject(err);
                });
            }

            if(pl.yt_validate(query) === "playlist"){
                pl.playlist_info(query).then(playlist => {
                    playlist.all_videos().then(videos => {
                        for(videoResult of videos){

                            const song = {
                                title: videoResult.title,
                                url: videoResult.url,
                                id: videoResult.id,
                                duration: videoResult.durationRaw,
                                thumbnail: videoResult.thumbnails.pop().url,
                            }

                            result.songs.push(song);
                        }

                        result.type = "playlist";

                        resolve(result);
                    })
                }).catch(err => {
                    console.log(err);
                    reject(err);
                });
            }

            //Check if spotify link
            if(pl.sp_validate(query) === "track"){
                reject("Jeg skal nok tilføje det, okay :(");
            }

            //Check if soundcloud link
            pl.so_validate(query).then(res => {
                if(res.type === "track"){
                    reject("Jeg skal nok tilføje det, okay :(");
                }
            }).catch(err => {
                reject("Jeg skal nok tilføje det, okay :(");
            })


        } else {
            pl.search(query, {limit: 1})
                .then(res => {

                    if(res.length < 1) {
                        console.log("No results from query");
                        reject("No results from query");
                    }

                    const videoResult = res[0];

                    const song = {
                        title: videoResult.title,
                        url: videoResult.url,
                        id: videoResult.id,
                        duration: videoResult.durationRaw,
                        thumbnail: videoResult.thumbnails.pop().url,
                    }

                    result.type = "video"
                    result.songs.push(song);

                    resolve(result);
                }).catch(err => {
                console.log(err);
                reject(err);
            });
        }
    })
}

async function playSong(guildID){
    const serverQueue = guildData.getServerQueue(guildID);
    const song = serverQueue.songs[0]

    if(!song){
        serverQueue.playing = false;
        return
    }

    console.log(song);

    const source = await pl.stream(song.url);

    const resource = createAudioResource(source.stream, {inputType: source.type});

    const audioPlayer = serverQueue.audioPlayer;

    audioPlayer.play(resource);
    serverQueue.playing = true;
    addSongPlay(song);
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

        const audioPlayer = serverQueue.audioPlayer;
        audioPlayer.on(AudioPlayerStatus.Idle, () => {
            console.log("Audioplayer is idle");
            if(!serverQueue.loop) {
                serverQueue.songs.shift();
            }
            playSong(guildID);
        }).on('error', error => {
            console.log(error);

            serverQueue.songs.shift();
            playSong(guildID);
        })
    }

    //message.channel.send("Searching...");

    const searchTerm = message.content.substr(message.content.indexOf(' ') + 1).trim();

    getSong(searchTerm).then(result => {

        for (song of result.songs){
            song.position = serverQueue.songs.length;
            song.guild = guildID;
            song.author = message.member.id;

            console.log(song)

            //Add request to database
            addSongRequest(song);

            //Push song to queue
            serverQueue.songs.push(song);
        }

        //We have added a playlist
        if(result.songs.length > 1){
            mu.sendPlaylistEmbed(message, result.songs.length);
        } else {
            if(serverQueue.playing){
                mu.sendSongEmbed(message, result.songs[0], "Song added:");
                return;
            }
        }

        if(!serverQueue.playing){
            //We are not currently playing a song
            playSong(guildID)
            mu.sendSongEmbed(message, result.songs[0], "Now playing:");
        }

    }).catch(err => {
        message.channel.send("Something went wrong when trying to play this song: " + err);
    });
}

module.exports = {
    play: play,
    playSong: playSong,
}