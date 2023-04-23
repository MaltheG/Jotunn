const db = require("../db.js")
const {prefix} = require("../config.json");

//Set nickname of user in channel
module.exports = async function setName(message){
    const args = message.content.split(' ');

    if(args.length < 3) {
        return message.channel.send(`Bad format. Usage: ${prefix}setname [@User] [nickname]`);
    }

    //Get userID from message
    const userID = args[1].replace('<@!', '').replace('>', '').replace('<@', '');
    //Get nickname from message
    const nickname = args.slice(2).join(' ').trim();

    //Users are not allowed to change their own name
    if(message.author.id === userID) {
        return message.channel.send("<@" + userID + "> er en pølse");
    }

    if(nickname.length > 32) {
        return message.channel.send("Name must not be longer than 32 characters")
    }

    //Change nickname
    message.guild.members.fetch(userID).then(member => {
        member.setNickname(nickname).then((member) => {
            //Check if success
            if(member.nickname !== nickname) {
                return message.channel.send("Failed to change name");
            }

            //Add name to database and then disconnect
            db.query(`INSERT INTO history (UserID, Nickname, Namer) VALUES($1, $2, $3);`, [userID, nickname, message.author.id])
                .catch((error) => console.log(error));

            return message.channel.send("Successfully changed name");

        }).catch(err => {
            console.log(err);
            return message.channel.send("Failed to change name. " + err);
        });
    }).catch(err => {
        console.log(err);
        return message.channel.send("No member with that userID");
    })
}