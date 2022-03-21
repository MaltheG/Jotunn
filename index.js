const {Client, Intents} = require("discord.js");
const {prefix} = require("./config.json");
const dbsetup = require("./dbsetup.js");
const guildData = require("./guildData.js");

const setName = require("./commands/setName.js");
const join = require("./commands/join.js");
const disconnect = require("./commands/disconnect.js");
const {play} = require("./commands/play.js");
const pause = require("./commands/pause.js");
const unpause = require("./commands/unpause.js");
const loop = require("./commands/loop.js");
const skip = require("./commands/skip.js");
const queue = require("./commands/queue.js");
const clear = require("./commands/clear.js");
const remove = require("./commands/remove.js");
const playNext = require("./commands/playNext.js");
const nowPlaying = require("./commands/nowPlaying.js");
const history = require("./commands/history.js");
const {getSongHistory} = require("./commands/songHistory.js");
const {addSoundCommand, playSoundEffect} = require("./commands/customCommand");
const {getVoiceConnection} = require("@discordjs/voice");
const getEffects = require("./commands/getEffects.js");

//Init database
dbsetup();

const bot = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]});

bot.once("ready", () => {
    console.log("ready");
})

const token = process.env.JOTUNN_TOKEN;
bot.login(token);

bot.on("messageCreate", async message => {
    const content = message.content;

    if(content.slice(0, 1) !== prefix){
        return;
    }

    const args = content.split(" ");
    const command = args[0].substring(1).toLowerCase(); //Remember to remove prefix

    switch (command) {
        case "setname":
            setName(message);
            break;
        case "p":
        case "play":
            play(message);
            break;
        case "join":
            join(message);
            break;
        case "pause":
            pause(message);
            break;
        case "unpause":
            unpause(message);
            break;
        case "n":
        case "s":
        case "next":
        case "skip":
            skip(message);
            break;
        case "dc":
            disconnect(message);
            break;
        case "l":
        case "loop":
            loop(message);
            break;
        case "q":
        case "queue":
            queue(message);
            break;
        case "c":
        case "clear":
            clear(message);
            break;
        case "remove":
            remove(message);
            break;
        case "pn":
        case "tf":
        case "playnext":
        case "tofront":
            playNext(message);
            break
        case "np":
        case "nowplaying":
            nowPlaying(message);
            break;
        case "history":
            history(message);
            break;
        case "sh":
        case "songhistory":
            getSongHistory(message);
            break;
        case "ae":
        case "addeffect":
            addSoundCommand(message);
            break;
        case "se":
        case "soundeffects":
        case "e":
        case "effects":
        case "ge":
        case "geteffects":
        case "gse":
        case "getsoundeffects":
            getEffects(message);
            break;
        default:
            //Look if command is custom command
            playSoundEffect(message);
            break;
    }
})

//Idle timer. Leave voice channel if no user for 30 seconds
bot.on('voiceStateUpdate', (oldState, newState) => {
    if(oldState.channelId !== oldState.guild.me.voice.channelId || newState.channel){
        return;
    }

    if(!(oldState.channel.members.size - 1)){
        setTimeout(() => {
            if(!(oldState.channel.members.size - 1)){
                const guildID = oldState.guild.id;

                const connection = getVoiceConnection(guildID);
                if(connection){
                    connection.destroy();
                }

                const audioPlayer = guildData.getServerQueue(guildID).audioPlayer;
                if(audioPlayer){
                    audioPlayer.stop();
                }

                guildData.removeServerQueue(guildID);
            }
        }, 30000);
    }
});