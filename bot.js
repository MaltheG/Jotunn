var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
const {Client} = require('pg');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) === '!') {
        const args = message.substring(1).split(' ');
        const cmd = args[0].toLowerCase();

        switch(cmd) {
            case 'setname':
                if(args.length < 3) {
                    break;
                }
                const username = args[1].replace('!', '').replace('<@', '').replace('>', '');
                const nickname = args.slice(2).join(' ');
                const server = bot.channels[channelID].guild_id;
                logger.info(username);
                logger.info(userID);

                if(userID !== username) {
                    bot.editNickname({
                        serverID: server,
                        userID: username,
                        nick: nickname
                    }, function (err) {
                        logger.info(err);
                        if(err == null) {
                            bot.sendMessage({
                                to: channelID,
                                message: "Successfully changed name of " + args[1] + " to " + nickname
                            });
                            addName(username, nickname, userID);
                        } else {
                            bot.sendMessage({
                                to: channelID,
                                message: "Failed to change name of " + args[1]
                            })
                        }
                    });
                } else {
                    bot.sendMessage( {
                        to: channelID,
                        message: "<@" + userID + ">" + " er en pølse"
                    })
                }
                break;
            case 'history':
                if(args.length < 2) {
                    break;
                }

                const historyName =  args[1].replace('!', '').replace('<@', '').replace('>', '');
                var length = 5;

                if(args.length > 2) {
                    length = parseInt(args[2]);
                }

                printHistory(channelID, historyName, length);
                break;
            // Just add any case commands if you want to..
         }
     }
});

function addName(userID, nickname, namer) {
    client.connect();

    client.query("INSERT INTO History (UserID, Nickname, Namer) VALUES ('" + userID + "', '" + nickname + "', '" + namer + "');", (err, res) => {
        if(err) throw err;

        client.end();
    });
}

function printHistory(channelID, userID, length) {
    client.connect();

    client.query("SELECT Nickname FROM History WHERE UserID='" + userID + "';", (err, res) => {
        if(err) throw err;
        
        for(let row of res.rows) {
            bot.sendMessage({
                to: channelID,
                message: JSON.stringify(row)
            });
        }

        client.end();
    })
}