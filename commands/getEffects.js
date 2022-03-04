const db = require("../db.js");
const {sendGuildSoundEffects} = require("../messageUtility.js");

module.exports = async function getEffects(message){
    const guildID = message.guild.id;

    db.query(`SELECT command, userid FROM commands WHERE guildID = $1`, [guildID])
        .then(async res => {
            if(res.rows.length < 1){
                message.channel.send("No custom soundeffects added");
                return;
            }

            let commandString = "";
            let authorString = "";

            for(let row of res.rows){
                commandString += `${row.command}\n`;
                authorString += `<@${row.userid}>\n`;
            }

            sendGuildSoundEffects(message, commandString, authorString)
        })
}