const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require("fs");
const db = require("../db.js");
const {prefix} = require("../config.json");
const join = require("./join.js");
const {getServerQueue} = require("../guildData.js");
const {AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection} = require("@discordjs/voice");

function downloadFile(guildID, fileName, url){
    const folderName = `./soundEffects/${guildID}`;

    return new Promise((resolve, reject) => {
       fetch(url).then(res => {
           try {
               if (!fs.existsSync(folderName)) {
                   fs.mkdirSync(folderName, {recursive: true});
               }
           } catch (err) {
               console.log("Error when creating guild folder");
               console.log(err);
               reject(err);
           }

           const dest = fs.createWriteStream(`${folderName}/${fileName}`)
           res.body.pipe(dest);
           res.body.on("end", () => resolve());
           dest.on("error", (err) => {
               console.log("Error when trying to write to file");
               console.log(err)
               reject(err)
           });
       }).catch(err => {
           console.log("Error when downloading file");
           console.log(err);
           reject(err);
       })
    });
}

async function addSoundCommand(message){
    const guildID = message.guild.id;
    const userID = message.member.id;

    const args = message.content.split(' ');

    if(args.length < 2){
        message.channel.send("Please provide a command for your sound effect");
        return
    }

    const commandName = args[1].toLowerCase();
    if(!/^[a-zæøå]/i.test(commandName)){
        message.channel.send("Command can only contain letters and have no leading prefix");
        return
    }

    if(commandName.length > 250){
        message.channel.send("Please choose a shorter command name");
        return
    }

    if(!message.attachments.first()){
        message.channel.send("No file attachment found");
        return
    }

    //https://stackoverflow.com/questions/680929/how-to-extract-extension-from-filename-string-in-javascript/680982
    const re = /(?:\.([^.]+))?$/;
    const fileExtension = re.exec(message.attachments.first().name)[1];

    if(fileExtension === undefined){
        message.channel.send("Unknown file extension");
        return
    }

    const fileName = `${commandName}.${fileExtension}`;
    const url = message.attachments.first().url;
    downloadFile(guildID, fileName, url).then(() => {
        const location = `./soundEffects/${guildID}/${fileName}`
        db.query(`INSERT INTO commands (command, guildid, userid, location)
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (command, guildid) DO UPDATE SET userid = $3, location = $4`,
            [commandName, guildID, userID, location]).then(() => {
            message.channel.send(`Sound effect added. Play with ${prefix}${commandName}`);
        }).catch(err => {
            console.log("Failed to insert sound command");
            console.log(err);
            message.channel.send("Something went wrong when adding sound effect");
        })
    }).catch(err => {
        message.channel.send("Unable to download attached file");
    });
}

function play(guildID, serverQueue, resource){
    const newAudioPlayer = createAudioPlayer();
    const oldAudioPlayer = serverQueue.audioPlayer;

    const connection = getVoiceConnection(guildID)

    oldAudioPlayer.pause();
    connection.subscribe(newAudioPlayer);

    newAudioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log("Done playing");
        connection.subscribe(oldAudioPlayer);
        oldAudioPlayer.unpause();
        newAudioPlayer.stop();
    }).on('error', err => {
        console.log("Something went wrong when trying to play sound effect");
        console.log(err);
        connection.subscribe(oldAudioPlayer);
        oldAudioPlayer.unpause();
        newAudioPlayer.stop();
    })

    newAudioPlayer.play(resource);
    console.log("Trying to play");
}
/*
.on(AudioPlayerStatus.Playing, () => {
    console.log("Playing audio file");
}).on(AudioPlayerStatus.AutoPaused, () => {
    console.log("I am autopaused");
}).on(AudioPlayerStatus.Idle, () => {
    console.log("I am idle");
})*/

async function playSoundEffect(message){
    const args = message.content.split(" ");
    const command = args[0].substring(1).toLowerCase(); //Remember to remove prefix

    const guildID = message.guild.id;

    //First check if actually sound effect
    db.query(`SELECT location FROM commands WHERE guildID = $1 AND command = $2`, [guildID, command])
        .then(async res => {
            if (res.rows.length < 1) {
                message.channel.send("Unknown command");
                return;
            }

            const location = res.rows[0].location;

            //Check if we are already connected
            let serverQueue = getServerQueue(guildID);
            //Check if we are in a voice channel
            if (!serverQueue || !getVoiceConnection(guildID)) {
                if (!await join(message)) {
                    //Something went wrong when trying to join a voice channel
                    return;
                }
                //Update serverQueue after join
                serverQueue = getServerQueue(guildID);
            }

            //Create audio resource
            const resource = createAudioResource(fs.createReadStream(location));
            play(guildID, serverQueue, resource);

        }).catch(err => {
            console.log("Error when looking for custom commands in database");
            console.log(err);
    })
}

module.exports = {
    addSoundCommand: addSoundCommand,
    playSoundEffect: playSoundEffect,
}