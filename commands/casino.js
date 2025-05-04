const {prefix} = require("../config.json");
const db = require("../db.js");
const {betSlots} = require("../casino/slots.js");
const {MessageEmbed} = require("discord.js");
const { isValidBet, betRoulette } = require("../casino/roulette");
const Blackjack = require("../casino/blackjack");

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

function getGuildAndMemberIDs(message) {
    return {
        guildID: message.guild.id,
        memberID: message.member.id
    };
}

function parseAmount(rawAmount, message) {
    rawAmount = rawAmount.toLowerCase().trim();
    if (rawAmount === "all") return -1;

    const amount = parseInt(rawAmount);
    if (isNaN(amount)) {
        message.channel.send("Nice try dumbo");
        return null;
    }
    if (amount < minBet) {
        message.channel.send("Minimum bet amount: " + minBet);
        return null;
    }
    return amount;
}

async function getUserBalance(guildID, userID, message) {
    try {
        const res = await db.query(`SELECT balance FROM casino WHERE guildID = $1 AND userID = $2`, [guildID, userID]);
        if (res.rows.length < 1) {
            message.channel.send("Something went wrong, sry dude!");
            return null;
        }
        return parseInt(res.rows[0].balance);
    } catch (err) {
        console.log(err);
        message.channel.send("DB error!");
        return null;
    }
}

async function slots(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const args = message.content.split(' ');

    if (args.length < 2) {
        message.channel.send(`Bad format. Usage: ${prefix}slots [bet_amount]`);
        return;
    }

    let amount = parseAmount(args[1], message);
    if (amount === null) return;

    let balance = await getUserBalance(guildID, memberID, message);
    if (balance === null) return;

    if (amount === -1) amount = balance;
    if (balance < amount || amount === 0) {
        message.channel.send("Sry, you're too poor! Your balance is: " + balance);
        return;
    }

    const balanceChange = betSlots(message, amount);
    balanceChange > 0
        ? addWin(message, guildID, memberID, balanceChange - amount)
        : addLoss(message, guildID, memberID, balanceChange);
}

async function roulette(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const args = message.content.split(' ');

    if (args.length < 3) {
        message.channel.send(`Bad format. Usage: ${prefix}roulette [bet] [bet_amount]`);
        return;
    }

    const bet = args[1].toLowerCase().trim();
    if (!isValidBet(bet)) {
        message.channel.send(`${bet} is not a valid bet! Choose black or something, idk.`);
        return;
    }

    let amount = parseAmount(args[2], message);
    if (amount === null) return;

    let balance = await getUserBalance(guildID, memberID, message);
    if (balance === null) return;

    if (amount === -1) amount = balance;
    if (balance < amount || amount === 0) {
        message.channel.send("Sry, you're too poor! Your balance is: " + balance);
        return;
    }

    const balanceChange = betRoulette(message, bet, amount);
    balanceChange > 0
        ? addWin(message, guildID, memberID, balanceChange - amount)
        : addLoss(message, guildID, memberID, balanceChange);
}

async function blackjack(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const args = message.content.split(' ');

    if (args.length < 2) {
        message.channel.send(`Bad format. Usage ${prefix}blackjack [bet_amount]`);
        return;
    }

    const existing = Blackjack.getGame(memberID);
    if (existing && existing.status === "playing") {
        message.channel.send(`You're already in a game. Use ${prefix}hit or ${prefix}stand`);
        return;
    }

    let amount = parseAmount(args[1], message);
    if (amount === null) return;

    let balance = await getUserBalance(guildID, memberID, message);
    if (balance === null) return;

    if (amount === -1) amount = balance;
    if (balance < amount || amount === 0) {
        message.channel.send("Sry, you're too poor! Your balance is: " + balance);
        return;
    }

    Blackjack.createGame(memberID, amount);
    const embed = Blackjack.renderGameEmbed(memberID);
    message.channel.send({ embeds: [embed]});
}

async function hit(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const result = Blackjack.handleHit(memberID);

    if (!result) {
        message.channel.send("You're not in a game!");
        return;
    }

    if (result.result === "bust") {
        const embed = Blackjack.renderGameEmbed(memberID);
        embed.addField("Busted!", `You lost ${result.bet} TOPS :sob:`);
        message.channel.send({ embeds: [embed] });
        Blackjack.clearGame(memberID);
        addLoss(message, guildID, memberID, -result.bet);
    } else {
        const embed = Blackjack.renderGameEmbed(memberID);
        message.channel.send({ embeds: [embed]});
    }
}

async function stand(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const outcome = Blackjack.handleStand(memberID);

    if (!outcome) {
        message.channel.send("You're not in a game!");
        return;
    }

    const embed = Blackjack.renderGameEmbed(memberID, "result");

    if (outcome.result === "win") {
        embed.addField("You won!", `Prize: ${outcome.payout} TOPS :fire:`);
        addWin(message, guildID, memberID, outcome.payout)
    } else if (outcome.result === "push") {
        embed.addField("Push!", "It's a tie, your bet is returned.");
    } else {
        embed.addField(`You lost ${outcome.bet} TOPS :sob:`, "Better luck next time!");
        addLoss(message, guildID, memberID, -outcome.bet);
    }

    message.channel.send({ embeds: [embed] });
    Blackjack.clearGame(message.author.id);
}

async function balance(message) {
    const { guildID, memberID } = getGuildAndMemberIDs(message);
    const userBalance = await getUserBalance(guildID, memberID, message);

    if (userBalance === null) return;

    message.channel.send("Your balance is: " + userBalance);
}

async function gift(message) {
    const { guildID, memberID: gifterID } = getGuildAndMemberIDs(message);
    const args = message.content.split(' ');

    if (args.length < 3) {
        message.channel.send(`Bad format. Usage: ${prefix}give [@User] [amount]`);
        return;
    }

    const receiverID = args[1].replace(/[<@!>]/g, '');
    const amount = parseInt(args[2]);

    if (isNaN(amount)) {
        message.channel.send("Nice try dumbo");
        return;
    }

    if (amount < 0) {
        message.channel.send("Very clever");
        return;
    }

    const gifterBalance = await getUserBalance(guildID, gifterID, message);
    if (gifterBalance === null) return;

    if (gifterBalance < amount) {
        message.channel.send("Sry, you're too poor! Your balance is: " + gifterBalance);
        return;
    }

    try {
        // Deduct from gifter
        await db.query(`
            INSERT INTO casino (guildID, userID, balance, gifted) 
            VALUES($1, $2, $3, $3) 
            ON DUPLICATE KEY UPDATE balance = casino.balance - $3, gifted = casino.gifted + $3
        `, [guildID, gifterID, amount]);

        // Add to receiver
        await db.query(`
            INSERT INTO casino (guildID, userID, balance, received) 
            VALUES($1, $2, $3, $3) 
            ON DUPLICATE KEY UPDATE balance = casino.balance + $3, received = casino.received + $3
        `, [guildID, receiverID, amount]);

        message.channel.send(`Gifted ${amount} TOPS! New balance: ${gifterBalance - amount} TOPS`);
    } catch (err) {
        console.error(err);
        message.channel.send("Something went wrong, sry dude!");
    }
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
    leaderboards: leaderboards,
    blackjack: blackjack,
    hit: hit,
    stand: stand
}