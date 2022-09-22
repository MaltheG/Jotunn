const {MessageEmbed} = require("discord.js");
const db = require("./db");

const embedColour = "#ff0000";

function sendSongEmbed(message, song, title){
    db.query(`SELECT SUM(requests) as totalRequests, SUM(plays) as totalPlays FROM songHistory WHERE songID = $1 AND guildID = $2`,
        [song.id, song.guild]).then(res => {
        const embed = new MessageEmbed()
            .setColor(embedColour)
            .setTitle(song.title)
            .setURL(song.url)
            .setAuthor({name: title})
            .addField("Total requests:", res.rows[0].totalrequests, true)
            .addField("Total plays:", res.rows[0].totalplays, true)
            .addField("Added by:", "<@!" + song.author + ">")
            .addField("Position in queue:", song.position.toString(), true)
            .addField("Song duration:", song.duration, true)
            .setImage(song.thumbnail)
            .setTimestamp()

        message.channel.send({embeds: [embed]});
    }).catch(err => {
        console.log(err)

        //Send embed without stats
        const embed = new MessageEmbed()
            .setColor(embedColour)
            .setTitle(song.title)
            .setURL(song.url)
            .setAuthor({name: title})
            .addField("Added by:", "<@!" + song.author + ">")
            .addField("Position in queue:", song.position.toString(), true)
            .addField("Song duration:", song.duration, true)
            .setImage(song.thumbnail)
            .setTimestamp()

        message.channel.send({embeds: [embed]});
    })
}

function sendQueueEmbed(message, positionString, queueString, authorString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Queue:"})
        .addField("Position:", positionString, true)
        .addField("Track:", queueString, true)
        .addField("Requested by:", authorString, true)
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendHistoryEmbed(message, userID, nicknameHistory, authorHistory, timeHistory){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Nickname history"})
        .addField("User:", "<@!" + userID + ">")
        .addField("Nickname:", nicknameHistory, true)
        .addField("Author:", authorHistory, true)
        .addField("Date:", timeHistory, true)
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendUserSongHistoryEmbed(message, userID, requestString, nameString, playsString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Song history"})
        .addField("User:", "<@!" + userID + ">")
        .addField("Requests:", requestString, true)
        .addField("Song:", nameString, true)
        .addField("Plays:", playsString, true)
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendGuildSongHistoryEmbed(message, requestString, nameString, playsString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Song history"})
        .addField("Requests:", requestString, true)
        .addField("Song:", nameString, true)
        .addField("Plays:", playsString, true)
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendGuildSoundEffects(message, commandString, authorString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Sound Effects:"})
        .addField("Command:", commandString, true)
        .addField("Added by:", authorString, true)
        .setTimestamp()

    message.channel.send({embeds: [embed]})
}

function sendPlaylistEmbed(message, length){
    message.channel.send(length + " songs added to queue");
}

module.exports = {
    sendSongEmbed: sendSongEmbed,
    sendQueueEmbed: sendQueueEmbed,
    sendHistoryEmbed: sendHistoryEmbed,
    sendUserSongHistoryEmbed: sendUserSongHistoryEmbed,
    sendGuildSongHistoryEmbed: sendGuildSongHistoryEmbed,
    sendGuildSoundEffects: sendGuildSoundEffects,
    sendPlaylistEmbed: sendPlaylistEmbed,
}