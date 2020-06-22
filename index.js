const Discord = require('discord.js');
const {
    prefix,
} = require('./config.json');
const ytdl = require('ytdl-core');
const { getInfo } = require('ytdl-getinfo');
const { Client } = require('pg');

//Database client
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

const bot = new Discord.Client();
const defaultVolume = 100;

bot.once("ready", () => {
    console.log("Ready!");
});

//Login to Discord with token
const token = process.env.JOTUNN_TOKEN;
bot.login(token);

//Song queues for servers (ServerID, Construct)
const serverMap = new Map();

bot.on("message", async message => {
    //Owner of message is bot
    if(message.author.bot) return;

    //Message is not intended for bot
    if(message.content.substring(0, 1) !== prefix) return;

    const args = message.content.substring(1).split(' ');
    const cmd = args[0].toLowerCase();

    const serverQueue = serverMap.get(message.guild.id);

    switch (cmd) {
        case "setname":
            setName(message);
            break;
        case "history":
            history(message);
            break;
        case "join":
            join(message, serverQueue);
            break;
        case "play":
            execute(message, serverQueue);
            break;
        case "skip":
            skip(message, serverQueue);
            break;
        case "dc":
            disconnect(message, serverQueue);
            break;
        case "volume":
            volume(message, serverQueue);
            break;
        case "ben":
        case "earrape":
            earRape(message, serverQueue);
            break;
        case "loop":
            loop(message, serverQueue);
            break;
        case "queue":
            queue(message, serverQueue);
            break;
        case "clear":
            clear(message, serverQueue);
            break;
        case "remove":
            remove(message, serverQueue);
            break;
        case "drawmelikeoneofyourfrenchgirls":
            drawMe(message);
            break;
        case "setafkchannel":
            setAFKChannel(message);
            break;
        case "test":
            test(message);
            break;
        case "toggleafkmusic":
            toggleAFKMusic(message);
            break;
        case "setafksong":
            setAFKSong(message);
            break;
        case "forcedc":
            disconnect(message, serverQueue);
            break;
        case "bananton":
            test(message);
            break;
        case "tofront":
        case "playnext":
            playNext(message, serverQueue);
            break;
        case "np":
        case "nowplaying":
            nowPlaying(message, serverQueue);
            break;
    }
});

function test(message){

}

async function playNext(message, serverQueue) {
    const args = message.content.split(' ');

    //Song specified - add this to queue
    if (args.length > 1) {
        //Only mess with queue if successfully found song
        execute(message, serverQueue).then((res) => {
            if(res) moveToFront(message, serverQueue);
        })
    } else {
        moveToFront(message, serverQueue);
    }
}

function moveToFront(message, serverQueue) {
    if(serverQueue.songs.length < 3) {
        return message.channel.send("Song already next in queue");
    }

    //Pop song from bottom of queue
    lastSong = serverQueue.songs.pop();

    //Move last song next in queue
    serverQueue.songs.splice(1, 0, lastSong);

    return message.channel.send(lastSong.title + " moved to front of queue");
}

//Set nickname of user in channel
function setName(message) {
    const args = message.content.split(' ');

    if(args.length < 3) {
        return message.channel.send(`Bad format. Usage: ${prefix}setname [@User] [nickname]`);
    }

    //Get userID from message
    const userID = args[1].replace('<@!', '').replace('>', '');
    //Get nickname from message
    const nickname = args.slice(2).join(' ');

    //Users are not allowed to change their own name
    if(message.author.id === userID) {
        return message.channel.send("<@!" + userID + "> er en pølse");
    }

    //Change nickname
    message.guild.member(userID).setNickname(nickname).then((member) => {
        //Check if success
        if(member.nickname !== nickname) {
            return message.channel.send("Failed to change name");
        }
    });

    //Connect to database
    client.connect();

    //Add name to database and then disconnect
    client.query(`INSERT INTO History (UserID, Nickname, Namer) VALUES('${userID}', '${nickname}', '${message.author.id}');`)
        .catch((error) => console.log(error));

    return message.channel.send("Successfully changed name")
}

function modifySettings(message, query) {
    const serverID = message.guild.id.toString();

    //Check if server already exists in settings table
    client.connect();
    client.query(`SELECT 1 FROM Settings WHERE ID='${serverID}'`)
        .then((res) => {
            //Insert if not present already
            if(res.rows.length < 1) {
                client.query(`INSERT INTO Settings (ID) VALUES('${serverID}')`)
                    .catch((err) => {
                        console.log("Failed db setup on serverID");
                        console.log(err);
                    })
            }
        }).catch((err) => {
            console.log("Failed to read if serverID exists on db");
            console.log(err);
            return false;
        });

    //Send requested query to database
    client.query(query)
        .then(() => {
            return true;
        }).catch((err) => {
            console.log("Failed to execute " + query);
            console.log(err);
            return false;
        });
}

function setAFKChannel(message) {
    const serverID = message.guild.id.toString();
    const voiceChannel = message.member.voice.channel.id;
    if(!voiceChannel) return message.channel.send("You need to be in channel to set this as the AFK channel");

    if(modifySettings(message, `UPDATE Settings SET AFKChannel='${voiceChannel.toString()}' WHERE ID='${serverID}';`)) {
        return message.channel.send("Successfully set AFK channel");
    } else {
        return message.channel.send("Failed to set AFK channel");
    }
}

function getChannel(channelID) {
    return bot.channels.fetch(channelID);
}

function toggleAFKMusic(message) {
    const serverID = message.guild.id.toString();

    let toggle = 0;

    client.connect();
    client.query(`SELECT AFKMusic FROM Settings WHERE ID='${serverID}'`)
        .then((res) => {
            console.log(res);
            if(res.rows[0].afkmusic == 0) {
                toggle = 1;
            }

            client.query(`UPDATE Settings SET AFKMusic='${toggle}' WHERE ID='${serverID}'`)
                .then(() => {
                    if(toggle === 0){
                        return message.channel.send("AFKMusic is now off");
                    } else {
                        return message.channel.send("AFKMusic is now on");
                    }
                })
                .catch((err) => {
                    console.log(err);
                    return message.channel.send("Failed to toggle AFKMusic");
            });
        }).catch((err) => {
            console.log(err);
            return message.channel.send("Failed to toggle AFKMusic");
    });
}

function setAFKSong(message) {
    const serverID = message.guild.id.toString();
    const searchTerm = message.content.substr(12).trim();

    client.connect();
    client.query(`UPDATE Settings SET AFKSong='${searchTerm}' WHERE ID='${serverID}'`)
        .then(() => {
            return message.channel.send("Successfully set afk song");
        })
        .catch((err) => {
            console.log("Failed to set afk song: ");
            console.log(err);
            return message.channel.send("Failed to set afk song")
        });
}

async function joinAFKChannel(serverID) {
    client.connect();

    let songTerm;
    const serverQueue = serverMap.get(serverID);

    if(!serverQueue) return;

    await client.query(`SELECT AFKChannel, AFKSong, AFKMusic FROM Settings WHERE ID='${serverID}'`)
        .then((res) => {
            if(res.rows[0].afkmusic !== 1) {
                console.log("leaving");
                const voiceChannel = serverQueue.voiceChannel;
                voiceChannel.leave();
                serverMap.delete(serverID);
                return;
            }
            const AFKChannelID = res.rows[0].afkchannel;
            const voiceChannel = getChannel(AFKChannelID);
            getChannel(AFKChannelID).then((res) => {
                serverQueue.voiceChannel = res;
                res.join();
            });
            songTerm = res.rows[0].afksong;

            serverQueue.afk = true;
            serverQueue.loop = true;
            serverQueue.playing = true;

            if(!songTerm.includes("https://")) {
                songTerm = "ytsearch:" + songTerm;
            }
        }).catch((err) => {
            console.log("Failed to fetch afk channel: ");
            console.log(err);
    });

    //Create new song object
    const song = {
        title: null,
        url: null,
    };

    //Get song info from ytdl
    await getInfo(songTerm, [], true).then((info) => {
        song.title = info.items[0].title;
        song.url = info.items[0].webpage_url;
        console.log(`Song added: ${song.title}`);
        console.log(song);
    }).catch((err) => {
        console.log(err);
        console.log(`Could not find any song matching ${songTerm}`);
    });

    if(song.title === null || song.url === null) {
        console.log(`Could not find any song matching ${songTerm}`)
    }

    serverQueue.songs[0] = song;

    const guild = bot.guilds.cache.get(serverID);

    play(guild, serverQueue.songs[0]);

    serverQueue.voiceChannel.members.get(bot.user.id).voice.setMute(false);
}

function history(message) {
    const args = message.content.split(' ');

    if(args.length < 2) {
        return message.channel.send(`Bad format. Usage: ${prefix}history [@User] OPTIONAL[length]`);
    }

    //Get userID from message
    const userID = args[1].replace('<@!', '').replace('>', '');

    let length = 5;

    //Allow custom history length
    if(args.length > 2) {
        length = parseInt(args[2]);
    }

    //History message string builder
    let msg = "";

    //Connect to database
    client.connect();

    //Get results from db and then disconnect
    client.query(`SELECT Nickname FROM History WHERE UserID='${userID}';`)
        .then((res) => {
            //If wished length is more than result length, set length to result length
            if(length > res.rows.length) {
                length = res.rows.length;
            }

            //Get last n entries
            for(let i = res.rows.length - length; i < res.rows.length; i++) {
                msg += res.rows[i].nickname + "\n"
            }

            //Print history
            return message.channel.send(msg);
        }).catch((err) => {
            console.log(err);
            return message.channel.send("Failed to retrieve history");
        });
}

//Join voice channel and play music
//Returns true if successful
async function execute(message, serverQueue) {
    const args = message.content.split(' ');

    //Join voice channel if not already joined
    if(!serverQueue || serverQueue.afk) {
        if(!await join(message, serverQueue)) {
            //Something went wrong when joining voicechannel
            return false;
        }
        serverQueue = serverMap.get(message.guild.id);
    }
    //Store searching message for later editing/deletion
    let msg;

    //Let the user know we read the command
    message.channel.send("Searching...").then((m) => {
        msg = m;
    });

    const request = message.content.substr(6).trim();
    let searchTerm = request;

    //Check if searchTerm is a link
    if(!request.includes("https://")) {
        searchTerm = "ytsearch:" + searchTerm;
    }

    //Get song info from ytdl
    await getInfo(searchTerm).then((info) => {
        //Is true for playlists
        if(info.partial) {
            info.on('video', (v) => {
                //Create new song object
                const song = {
                    title: v.title,
                    url: v.webpage_url.toString(),
                };

                //Push song to queue
                serverQueue.songs.push(song);

                console.log(`Song added: ${song.title}`);
                console.log(song);

                //We are not already playing a song
                if(!serverQueue.playing) {
                    try {
                        //Play music
                        console.log("Trying to play song");
                        play(message.guild, serverQueue.songs[0]);
                        console.log("Executed play function");
                        serverQueue.playing = true;
                        message.channel.send(`Now playing: ${serverQueue.songs[0].title}`);
                    } catch (err) {
                        serverQueue.playing = false;
                        serverQueue.songs.clear();
                        execute(message, serverQueue);
                    }
                }

                if(msg != null) {
                    msg.edit(`Adding songs to queue...`);
                } else {
                    message.channel.send(`Adding songs to queue...`);
                }
            });
            info.on('done', () => {
                if(msg != null) {
                    return msg.edit(`${info.items.length} songs added to queue`);
                } else {
                    return message.channel.send(`${info.items.length} songs added to queue`);
                }
            })
        } else {
            //Single song
            //Create new song object
            const song = {
                title: info.items[0].title,
                url: info.items[0].webpage_url.toString(),
            };

            //Push song to queue
            serverQueue.songs.push(song);

            console.log(`Song added: ${song.title}`);
            console.log(song);

            //We are not already playing a song
            if(!serverQueue.playing) {
                try {
                    //Play music
                    play(message.guild, serverQueue.songs[0]);
                    serverQueue.playing = true;
                } catch(err) {
                    serverQueue.playing = false;
                    serverQueue.songs.clear();
                    execute(message, serverQueue);
                }
                if(msg != null) {
                    msg.edit(`Now playing: ${serverQueue.songs[0].title}`);
                    return true;
                } else {
                    message.channel.send(`Now playing: ${serverQueue.songs[0].title}`);
                    return true;
                }
            } else {
                if(msg != null) {
                    msg.edit(`${song.title} added to queue`);
                    return true;
                } else {
                    message.channel.send(`${song.title} added to queue`);
                    return true;
                }
            }
        }
    }).catch((err) => {
        console.log(err);
        if(msg != null) {
            msg.edit(`Could not find any song matching ${searchTerm}`);
            return false;
        } else {
            message.channel.send(`Could not find any song matching ${searchTerm}`);
            return false;
        }
    });
    return true;
}

//Join voice channel without playing any music
//Returns true if successful
async function join(message, serverQueue) {
    //Check if the user is in a voice channel
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel){
        await message.channel.send("You need to be in a voice channel to play music you dumb dumb.");
        return false;
    }

    //Check if the bot has permissions to join/speak in channel
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if(!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        await message.channel.send("I need permission to join and speak in your channel.")
        return false;
    }

    //Check if we are already connected
    if(!serverQueue || serverQueue.afk) {
        //If not, create new queueConstruct. This holds all information about current session
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 100,
            playing: false,
            loop: false,
            afk: false,
        };

        //Add this server session to list of all sessions
        serverMap.set(message.guild.id, queueConstruct);

        //Try joining voice channel
        try {
            queueConstruct.connection = await voiceChannel.join();
        } catch (err) {
            console.log(err);
            serverMap.delete(message.guild.id);
            await msg.edit(err);
            return false;
        }
    } else {
        await message.channel.send("Already in a voice channel");
        return true;
    }
    return true;
}

//Skip to next song if any
function skip(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to skip");
    if(!serverQueue) return message.channel.send("There is no song to skip!");
    serverQueue.songs.shift();
    play(message.guild, serverQueue.songs[0]);
}

//Disconnect from voice channel
function disconnect(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to disconnect the bot");
    serverQueue.voiceChannel.leave();
    //Delete this server session from list of sessions
    serverMap.delete(message.guild.id);
}

//Handles playing song in voice channels
function play(guild, song) {
    //Get this server's music session data
    const serverQueue = serverMap.get(guild.id);

    //No song to play, so just return
    if(!song) {
        serverQueue.playing = false;
        return;
    }

    //Create dispatcher to play song from ytdl
    const dispatcher = serverQueue.connection.play(ytdl(song.url, {
        filter: "audioonly",
        highWaterMark: 1<<20, //We need a higher than usual buffer or else songs will end prematurely
    }))
        .on('finish', () => { //Current song has ended, so play the next song
            console.log("Music ended");
            if(!serverQueue.loop) {
                serverQueue.songs.shift(); //If not looping, shift queue, so we can play next song in line
            }
            play(guild, serverQueue.songs[0]); //Play next song in queue
        })
        .on('error', error => {
            console.error(error);
            play(guild, song);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / defaultVolume);
}

function volume(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to set volume");
    const args = message.content.split(' ');

    try {
        //Read volume from arguments
        const vol = parseInt(args[1]);
        //Volume must be between 0 and default
        if(vol < 0 || vol > defaultVolume) {
            return message.channel.send("Volume must be between 0 and " + defaultVolume);
        }
        //Update construct volume
        serverQueue.volume = vol;
        //Update played volume
        serverQueue.connection.dispatcher.setVolumeLogarithmic(serverQueue.volume / defaultVolume);
        return message.channel.send("Successfully set volume to " + serverQueue.volume + "");
    } catch (err) {
        return message.channel.send("Failed to set volume");
    }
}

function earRape(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to earRape");

    //Increase volume to 2000%
    try {
        serverQueue.volume = defaultVolume * 20;
        serverQueue.connection.dispatcher.setVolumeLogarithmic(serverQueue.volume / defaultVolume);
        return message.channel.send("!!!BEN!!!");
    } catch (err) {
        return message.channel.send("Failed to !!!BEN!!!");
    }
}

function loop(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to loop");

    //Toggle looping
    serverQueue.loop = !serverQueue.loop;

    return message.channel.send("Looping: " + serverQueue.loop);
}

//Displays all song in queue
function queue(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to view the queue");

    if(!serverQueue) return message.channel.send("Not currently in a channel");

    //Special message if no songs in queue
    if(serverQueue.songs.length < 1) return message.channel.send("No songs in queue");

    let msg = "Queue: ";

    //Number of songs left to show in queue
    let leftToShow = serverQueue.songs.length;

    //Build queue string
    for (let song of serverQueue.songs) {
        //Discord sets a 2000 character message limit
        if(msg.length + `\n...\n(${leftToShow} more)`.length + `\n${song.title}`.length > 2000) {
            break;
        }
        //Add title to queue string
        msg += `\n${song.title}`;

        leftToShow--;
    }

    //We were not able to display entire queue
    if(leftToShow > 0) {
        msg += `\n...\n(${leftToShow} more)`;
    }

    return message.channel.send(msg);
}

//Clears song queue
function clear(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You have to be in a voice channel to clear the queue");

    //Clear the queue
    serverQueue.songs = [];
    return message.channel.send("Queue cleared");
}

//Removes specific song from queue
function remove(message, serverQueue) {
    if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to edit the queue");
    
    //Remove ".remove " from message
    const songName = message.content.substr(8).trim();

    const prevLength = serverQueue.songs.length;

    //Filter songs that match the song name
    serverQueue.songs = serverQueue.songs.filter(function(song) {
        return song.title !== songName;
    });

    //If length is not changed song(s) were not removed
    if(serverQueue.songs.length === prevLength) {
        return message.channel.send(`Failed to remove ${songName} from the queue`);
    }

    //Song(s) were removed
    return message.channel.send(`Successfully removed ${songName} from the queue`);
}

function nowPlaying(message, serverQueue) {
    if(!serverQueue) return message.channel.send("Not currently in a channel");

    if(serverQueue.songs.length < 1) return message.channel.send("Nothing is playing currently");

    return message.channel.send("Currently playing: " + serverQueue.songs[0].title);
}

function drawMe(message) {
    return message.channel.send("``,,......,,**/(%%#######(((((((#%%%%####((/**/(((((%%#/,,//,.    \n" +
        "/(((////(((#####(//////////***//((((((((////(####%%%(/**/*,.    \n" +
        "#%%%%%%%%%##((/******************/***********/((#######(#(/**,..\n" +
        "&&&&&&%%%%#(/*************////////*,,**********////((#%%%%###(*,\n" +
        "&%%%%%###((/*******//***/////////*******////////*****/(#%%&&&%#/\n" +
        "%%###((((//*****/////////((((////////////((////********//(#%&&&#\n" +
        "##(((/////****///(((((((((((((/////////((((((////*********(#%&&%\n" +
        "##((/********//((((((((#((((((////((((((((##((////*********/(%&%\n" +
        "((((/********///(((#(((((/////////((((((((###((((//******,**/#%%\n" +
        "&%((/*,********//((##(((////***////((((((((##(((((//*****,,*/(%&\n" +
        "@@%(*******,,,*/(((###((//*****/////(((((((#####((///********(#&\n" +
        "@@%(/////*,.,*/(((((#((((///**//((((((##########((/////******/#&\n" +
        "@@#(((((/****/((((((((((((((((((((##############((///////////(#&\n" +
        "%#/**/((////(((((((((((##########################((((((((((((#%&\n" +
        "**,,*//((/((((((((((((((#########################((((((((((###%&\n" +
        ",,...*/((//((((((((((/((((#######################((((((((((###%&\n" +
        "    .*/(///////////(((((((((##################((((((((((((####%&\n" +
        "     ,*//////////(((((((((((((#############(((((((((((#((((((#%&\n" +
        "     .,///***////((((((((((((((###########((((((((/((((//***/(%&\n" +
        "      .*//*,.,,***********//((###########((((((((((((/**,,,*/(%&\n" +
        "       .//*,............,,**((##########(((((/////////**,,,*(##%\n" +
        "        ,//*,,..........,**/((####(##((((/////////////**,,,*(#(/\n" +
        "        .*//***///*****///(((((((((((((////////***//****,..,*/*.\n" +
        "        .*/////(((((((((((((((((((((/////////**********,....,,,,\n" +
        "         ,////((((((((((((((((((((//////////**********,,..,,****\n" +
        "        .*////((((((((((((((((/((//////////******/***,,.,*////**\n" +
        "         ,*///((((((((((((///////////////******///***,,,*/((////\n" +
        "          ,****//////////////////*******/////////**,,,,,********\n" +
        "             ...,,,,,***/////**********//////////****,,,,,,,..,.``")
}
