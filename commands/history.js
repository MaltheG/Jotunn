const db = require("../db.js");
const {prefix} = require("../config.json");
const {sendHistoryEmbed} = require("../messageUtility.js");

module.exports = async function history(message){
    const args = message.content.split(' ');

    if(args.length < 2){
        message.channel.send(`Bad format. Usage: ${prefix}history [@User] OPTIONAL[length]`);
        return
    }

    //Get userID from message
    const userID = args[1].replace('<@!', '').replace('>', '');

    let length = 5;

    //Allow custom history length
    if(args.length > 2) {
        length = parseInt(args[2]);
    }

    //History message string builder
    let nicknameHistory = "";
    let authorHistory = "";
    let timeHistory = "";

    db.query(`SELECT Nickname, Namer, TO_CHAR(Time :: DATE, 'dd-mm-yyyy') as Time FROM History WHERE UserID=$1;`, [userID])
        .then(res => {

            if(res.rows.length < 1){
                message.channel.send("This user has no nickname history");
                return
            }

            //If wished length is more than result length, set length to result length
            if(length > res.rows.length) {
                length = res.rows.length;
            }

            //Get last n entries
            for(let i = res.rows.length - 1; i >= res.rows.length - length; i--) {
                nicknameHistory += res.rows[i].nickname + "\n";
                authorHistory += "<@!" + res.rows[i].namer + ">\n";
                timeHistory += res.rows[i].time + "\n";
            }
            sendHistoryEmbed(message, userID, nicknameHistory, authorHistory, timeHistory);
        }).catch(err => {
            console.log(err);
            message.channel.send("Failed to retrieve history");
        })
}