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
            .addFields(
                { name: "Total requests:", value: res.rows[0].totalrequests, inline: true },
                { name: "Total plays:", value: res.rows[0].totalplays, inline: true },
                { name: "Added by:", value: "<@!" + song.author + ">" },
                { name: "Position in queue:", value: song.position.toString(), inline: true },
                { name: "Song duration:", value: song.duration, inline: true }
            )
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
            .addFields(
                { name: "Added by:", value: "<@!" + song.author + ">" },
                { name: "Position in queue:", value: song.position.toString(), inline: true },
                { name: "Song duration:", value: song.duration, inline: true }
            )
            .setImage(song.thumbnail)
            .setTimestamp()

        message.channel.send({embeds: [embed]});
    })
}

function sendQueueEmbed(message, positionString, queueString, authorString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Queue:"})
        .addFields(
            { name: "Position:", value: positionString, inline: true },
            { name: "Track:", value: queueString, inline: true },
            { name: "Requested by:", value: authorString, inline: true }
        )
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendHistoryEmbed(message, userID, nicknameHistory, authorHistory, timeHistory){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Nickname history"})
        .addFields(
            { name: "User:", value: "<@!" + userID + ">" },
            { name: "Nickname:", value: nicknameHistory, inline: true },
            { name: "Author:", value: authorHistory, inline: true },
            { name: "Date:", value: timeHistory, inline: true }
        )
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendUserSongHistoryEmbed(message, userID, requestString, nameString, playsString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Song history"})
        .addFields(
            { name: "User:", value: "<@!" + userID + ">" },
            { name: "Requests:", value: requestString, inline: true },
            { name: "Song:", value: nameString, inline: true },
            { name: "Plays:", value: playsString, inline: true }
        )
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendGuildSongHistoryEmbed(message, requestString, nameString, playsString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Song history"})
        .addFields(
            { name: "Requests:", value: requestString, inline: true },
            { name: "Song:", value: nameString, inline: true },
            { name: "Plays:", value: playsString, inline: true }
        )
        .setTimestamp()

    message.channel.send({embeds: [embed]});
}

function sendGuildSoundEffects(message, commandString, authorString){
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setAuthor({name: "Sound Effects:"})
        .addFields(
            { name: "Command:", value: commandString, inline: true },
            { name: "Added by::", value: authorString, inline: true }
        )
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