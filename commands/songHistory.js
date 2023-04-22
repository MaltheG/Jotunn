const db = require("../db.js");
const {sendUserSongHistoryEmbed, sendGuildSongHistoryEmbed} = require("../messageUtility.js");

async function addSongRequest(song){
    db.query(`INSERT INTO songHistory (songName, songUrl, songID, guildID, userID, requests, plays) 
    VALUES($1, $2, $3, $4, $5, $6, $7)
    ON DUPLICATE KEY UPDATE requests = songHistory.requests + 1`,
        [song.title, song.url, song.id, song.guild, song.author, 1, 0]).catch(err => {
        console.log(err);
    })
}

async function addSongPlay(song){
    db.query(`UPDATE songHistory SET plays = plays + 1 WHERE songID = $1 AND guildID = $2 AND userID = $3`,
        [song.id, song.guild, song.author]).catch(err => {
        console.log(err);
    })
}

function userHistory(message, guildID, args){
    //Get userID from message
    const userID = args[1].replace('<@!', '').replace('>', '').replace('<@', '');

    db.query(`SELECT requests, plays, songName, songUrl FROM songHistory WHERE guildID = $1 AND userID = $2 ORDER BY requests DESC LIMIT 10`, [guildID, userID]).then(res => {

        if(res.rows.length < 1){
            message.channel.send("This user has no song history");
            return
        }

        let requestString = "";
        let nameString = "";
        let playsString = "";

        for(let row of res.rows){
            requestString += `${row.requests}\n`;
            let songName = row.songName;

            if(songName.length > 50){
                songName = songName.substring(0, 50) + "...";
            }

            nameString += `[${songName}](${row.songUrl})\n`
            playsString += `${row.plays}\n`
        }

        sendUserSongHistoryEmbed(message, userID, requestString, nameString, playsString);

    }).catch(err => {
        console.log(err);
        message.channel.send("Could not retrieve song history for this user");
    })
}

function guildHistory(message, guildID){
    db.query(`SELECT SUM(requests) as requests, SUM(plays) as plays, songName, songUrl FROM songHistory WHERE guildID = $1 GROUP BY songName, songUrl ORDER BY requests DESC LIMIT 10`, [guildID]).then(res =>{
        if(res.rows.length < 1){
            message.channel.send("This server has no song history")
            return
        }

        let requestString = "";
        let nameString = "";
        let playsString = "";

        for(let row of res.rows){
            requestString += `${row.requests}\n`;
            let songName = row.songName;

            if(songName.length > 50){
                songName = songName.substring(0, 50) + "...";
            }

            nameString += `[${songName}](${row.songUrl})\n`
            playsString += `${row.plays}\n`
        }

        sendGuildSongHistoryEmbed(message, requestString, nameString, playsString);
    }).catch(err => {
        console.log(err);
        message.channel.send("Could not retrieve song history");
    })
}

async function getSongHistory(message){
    const guildID = message.guild.id;

    const args = message.content.split(' ');

    if(args.length > 1){
        userHistory(message, guildID, args);
    } else {
        guildHistory(message, guildID);
    }
}

module.exports = {
    addSongRequest: addSongRequest,
    addSongPlay: addSongPlay,
    getSongHistory: getSongHistory,
}