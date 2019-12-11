var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
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
                const username = args[1].replace('!', '').replace('<@', '').replace('>', '');
                const nickname = args.slice(2).join(' ');
                const server = bot.channels[channelID].guild_id;
                logger.info(username);
                logger.info(userID);

                if(userID !== username && username !== bot.id) {
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
                            })
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
            // Just add any case commands if you want to..
         }
     }
});