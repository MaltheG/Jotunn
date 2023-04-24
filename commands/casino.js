const {prefix} = require("../config.json");
const db = require("../db.js");
const {betSlots} = require("../casino/slots.js");
const {MessageEmbed} = require("discord.js");
const { isValidBet, betRoulette } = require("../casino/roulette");

const minBet = 10;

const casinoGuilds = [
    {
        id: "446227876652515339",
        channels: [
            "446227876652515343"
        ]
    },
    {
        id: "504272240095920137",
        channels: [
            "504940170961879043",
            "504272240599105538",
            "504940143409364998",
            "504940194399649802",
            "545603191585243138"
        ]
    }
]

function leaderboards(message) {
    const guildID = message.guild.id;
    const memberID = message.member.id;

    db.query(`SELECT userID, balance FROM casino WHERE guildID = $1 ORDER BY balance DESC`, [guildID]).then(res => {
        if(res.rows.length < 1) {
            message.channel.send("No leaderboards yet... Or maybe something went wrong...");
            return
        }

        let userPos = "";
        let userID = "";
        let userBalance = "";

        for(let i = 0; i < res.rows.length; i++) {
            if(res.rows[i].userID == memberID) {
                userPos = `${i + 1} / ${res.rows.length}`;
                userID = `<@${memberID}>`;
                userBalance = `${res.rows[i].balance}`;

                break;
            }
        }

        let positionString = ""
        let userString = ""
        let balanceString = ""

        let leaderLength = 10;

        if(res.rows.length < leaderLength) leaderLength = res.rows.length;

        for(let i = 0; i < leaderLength; i++) {
            positionString += `${i + 1}\n`
            userString += `<@${res.rows[i].userID}>\n`
            balanceString += `${res.rows[i].balance}\n`
        }

        const embed = new MessageEmbed()
        .setColor("#FFD700")
        .setTitle(":trophy: Leaderboards :trophy:")
        .addFields(
            { name: 'Pos', value: positionString, inline: true },
            { name: 'User', value: userString, inline: true },
            { name: 'Balance', value: balanceString, inline: true }
        )
        
        
        if (userPos != "") {
            embed.addFields(
                { name: " ", value: "Your position:" },
                { name: 'Pos', value: userPos, inline: true },
                { name: 'User', value: userID, inline: true },
                { name: 'Balance', value: userBalance, inline: true }
            );
        }

        message.channel.send({ embeds: [embed] });
    });
}

function addWin(message, guildID, memberID, amount) {
    db.query(`INSERT INTO casino (guildID, userID, balance, win) 
    VALUES($1, $2, $3, $3) 
    ON DUPLICATE KEY UPDATE balance = casino.balance + $3, win = casino.win + $3`,
    [guildID, memberID, amount]).catch(err => {
        console.log(err);
        message.channel.send("You forgot to pay your taxes. Your balance wasn't updated!");
        return;
    })
}

function addLoss(message, guildID, memberID, amount) {
    db.query(`INSERT INTO casino (guildID, userID, balance, loss) 
    VALUES($1, $2, $3, $3) 
    ON DUPLICATE KEY UPDATE balance = casino.balance + $3, loss = casino.loss + $3`,
    [guildID, memberID, amount]).catch(err => {
        console.log(err);
        message.channel.send("You have somehow been bailed out by a Nigerian prince!");
        return;
    })
}

function slots(message) {
    const guildID = message.guild.id;
    const memberID = message.member.id;

    const args = message.content.split(' ');

    if(args.length < 2) {
        message.channel.send(`Bad format. Usage: ${prefix}slots [bet_amount]`);
        return;
    }

    let amount = 0;

    if(args[1].toLowerCase().trim() == "all") {
        amount = -1;
    } else {
        amount = parseInt(args[1]);

        if(isNaN(amount)) {
            message.channel.send("Nice try dumbo");
            return;
        }
    
        if(amount < minBet) {
            message.channel.send("Minimum bet amount: " + minBet);
            return;
        }
    }

    db.query(`SELECT balance FROM casino WHERE guildID = $1 AND userID = $2`, [guildID, memberID]).then(res => {
        if(res.rows.length < 1) {
            message.channel.send("Something went wrong, sry dude!");
            return
        }

        let balance = parseInt(res.rows[0].balance);

        if(amount == -1) {
            amount = balance;
        }

        if (balance < amount) {
            message.channel.send("Sry, you're too poor! Your balance is: " + balance);
            return;
        }

        const balanceChange = betSlots(message, amount);

        if (balanceChange > 0) {
            addWin(message, guildID, memberID, balanceChange - amount);
        } else {
            addLoss(message, guildID, memberID, balanceChange);
        }
    });
}

function roulette(message) {
    const guildID = message.guild.id;
    const memberID = message.member.id;

    const args = message.content.split(' ');

    if(args.length < 3) {
        message.channel.send(`Bad format. Usage: ${prefix}roulette [bet] [bet_amount]`);
        return;
    }

    const bet = args[1].toLowerCase().trim();

    if(!isValidBet(bet)) {
        message.channel.send(`${bet} is not a valid bet! Choose black or something, idk.`);
        return
    }

    let amount = 0;

    if(args[2].toLowerCase().trim() == "all") {
        amount = -1;
    } else {
        amount = parseInt(args[2]);

        if(isNaN(amount)) {
            message.channel.send("Nice try dumbo");
            return;
        }
    
        if(amount < minBet) {
            message.channel.send("Minimum bet amount: " + minBet);
            return;
        }
    }

    db.query(`SELECT balance FROM casino WHERE guildID = $1 AND userID = $2`, [guildID, memberID]).then(res => {
        if(res.rows.length < 1) {
            message.channel.send("Something went wrong, sry dude!");
            return
        }

        let balance = parseInt(res.rows[0].balance);

        if(amount == -1) {
            amount = balance;
        }

        if (balance < amount) {
            message.channel.send("Sry, you're too poor! Your balance is: " + balance);
            return;
        }

        const balanceChange = betRoulette(message, bet, amount);

        if (balanceChange > 0) {
            addWin(message, guildID, memberID, balanceChange - amount);
        } else {
            addLoss(message, guildID, memberID, balanceChange);
        }
    });
}

function balance(message) {
    const guildID = message.guild.id;
    const memberID = message.member.id;

    db.query(`SELECT balance FROM casino WHERE guildID = $1 AND userID = $2`, [guildID, memberID]).then(res => {
        if(res.rows.length < 1) {
            message.channel.send("Something went wrong, sry dude!");
            return
        }

        let balance = parseInt(res.rows[0].balance);

        message.channel.send("Your balance is: " + balance);
    });
}

function gift(message) {

    const guildID = message.guild.id;
    const gifterID = message.member.id;

    const args = message.content.split(' ');

    if(args.length < 3) {
        message.channel.send(`Bad format. Usage: ${prefix}give [@User] [amount]`);
        return;
    }

    const receiverID = args[1].replace('<@!', '').replace('>', '').replace('<@', '');;
    const amount = parseInt(args[2]);

    if(isNaN(amount)) {
        message.channel.send("Nice try dumbo");
        return;
    }

    if(amount < 0) {
        message.channel.send("Very clever");
        return;
    }

    db.query(`SELECT balance FROM casino WHERE guildID = $1 AND userID = $2`, [guildID, gifterID]).then(res => {
        if(res.rows.length < 1) {
            message.channel.send("Something went wrong, sry dude!");
            return
        }

        let balance = parseInt(res.rows[0].balance);

        if (balance < amount) {
            message.channel.send("Sry, you're too poor! Your balance is: " + balance);
            return;
        }

        console.log(gifterID + " is giving " + receiverID + ": " + amount);
        //Deduct from gifter
        db.query(`INSERT INTO casino (guildID, userID, balance, gifted) 
        VALUES($1, $2, $3, $3) 
        ON DUPLICATE KEY UPDATE balance = casino.balance - $3, gifted = casino.gifted + $3`,
        [guildID, gifterID, amount]).catch(err => {
            console.log(err);
            message.channel.send("Something went wrong, sry dude!");
            return;
        })

        //Add to receiver
        db.query(`INSERT INTO casino (guildID, userID, balance, received) 
        VALUES($1, $2, $3, $3) 
        ON DUPLICATE KEY UPDATE balance = casino.balance + $3, received = casino.received - $3`,
        [guildID, receiverID, amount]).catch(err => {
            console.log(err);
            message.channel.send("Something went wrong, sry dude!");
            return;
        })

        message.channel.send("Gifted " + amount + " TOPS! New balance: " + (balance - amount) + " TOPS");
    })    
}

function payMember(guildID, memberID, amount) {
    console.log("Paying " + memberID + " amount: " + amount + " in guild: " + guildID);
    db.query(`INSERT INTO casino (guildID, userID, balance) VALUES($1, $2, $3) ON DUPLICATE KEY UPDATE balance = casino.balance + $3`,
    [guildID, memberID, amount]).catch(err => {
        console.log(err);
    })
}

function payout(client) {
    const payout = 10; //TOPS

    console.log("PAYOUT TIME!");

    for(let casinoGuild of casinoGuilds) {
        client.guilds.fetch(casinoGuild.id).then(guild => {
            for(channelID of casinoGuild.channels) {
                guild.channels.fetch(channelID).then(channel => {
                    return channel.members;
                }).then(members => {
                    for(let member of members) {
                        //console.log(member)
                        const memberID = member[0];
                        const isSelfMuted = member[1].voice.selfMute;

                        if (!isSelfMuted) payMember(casinoGuild.id, memberID, payout);
                    }
                })
            }
        })
    }
}

module.exports = {
    payout: payout,
    gift: gift,
    balance: balance,
    slots: slots,
    roulette: roulette,
    leaderboards: leaderboards
}