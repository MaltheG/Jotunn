const guildData = require("../guildData.js");
const mu = require("../messageUtility.js");


module.exports = async function queue(message){
    const guildID = message.guild.id;

    const serverQueue = guildData.getServerQueue(guildID);

    if(!serverQueue || serverQueue.songs.length < 1){
        message.channel.send("No queue to print");
        return;
    }

    //Number of songs left to show in queue
    let leftToShow = serverQueue.songs.length;

    let posString = "";
    let queueString = "";
    let authorString = "";

    let pos = 1;

    //Build queue string
    for (let song of serverQueue.songs) {
        //Discord sets a 1024-character message limit in field values
        if(queueString.length + `${song.title}\n`.length + `...\n(${leftToShow} more)`.length > 1000) {
            break;
        }

        if(posString.length + `${pos}\n`.length > 1000){
            break;
        }

        if(authorString.length + `<@!${song.author}>\n`.length > 1000){
            break;
        }

        //Add title to queue string
        queueString += `${song.title}\n`;
        posString += `${pos}\n`;
        authorString += `<@!${song.author}>\n`;

        leftToShow--;
        pos++;
    }

    //We were not able to display entire queue
    if(leftToShow > 0) {
        posString += `...`;
        queueString += `...\n(${leftToShow} more)`;
        authorString += `...`;
    }

    mu.sendQueueEmbed(message, posString, queueString, authorString);
}