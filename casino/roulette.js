const {MessageEmbed} = require("discord.js");
const embedColour = "#009900";

const betReturns = new Map();

betReturns.set('red', 2);
betReturns.set('black', 2);
betReturns.set('green', 36);
betReturns.set('even', 2);
betReturns.set('odd', 2);
betReturns.set('1st', 3);
betReturns.set('2nd', 3);
betReturns.set('3rd', 3);

const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blacks = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function isValidBet(bet) {
    if(betReturns.has(bet)) return true;
    if(parseInt(bet) >= 0 && parseInt(bet) <= 36) return true;
    return false;
}

function betRoulette(message, bet, amount) {
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle("Roulette:")

    const hit = Math.floor(Math.random()*37);

    if(hit == 0) {
        embed.setDescription(`Result: ${hit} :green_square:`);
    } else if (blacks.includes(hit)) {
        embed.setDescription(`Result: ${hit} :black_large_square:`);
    } else {
        embed.setDescription(`Result: ${hit} :red_square:`);
    }

    let win = false;
    let multiplier = 0;

    //Special case if we hit 0
    checkwin: if(hit == 0) {
        if(parseInt(bet) == 0 || bet == "green"){
            multiplier = betReturns.get("green");
            win = true;
        }
    } else {
        if(bet == "odd" && hit % 2 == 1) {
            multiplier = betReturns.get("odd");
            win = true;
            break checkwin;
        }

        if(bet == "even" && hit % 2 == 0){
            multiplier = betReturns.get("even");
            win = true;
            break checkwin;
        }

        if(bet == "1st" && hit < 13) {
            multiplier = betReturns.get("1st");
            win = true;
            break checkwin;
        }

        if(bet == "2nd" && hit > 12 && hit < 25) {
            multiplier = betReturns.get("2nd");
            win = true;
            break checkwin;
        }

        if(bet == "3rd" && hit > 24 && hit < 37) {
            multiplier = betReturns.get("3rd");
            win = true;
            break checkwin;
        }

        if(bet == "black" && blacks.includes(hit)) {
            multiplier = betReturns.get("black");
            win = true;
            break checkwin;
        }

        if(bet == "red" && reds.includes(hit)) {
            multiplier = betReturns.get("red");
            win = true;
            break checkwin;
        }

        if(parseInt(bet) == hit) {
            multiplier = 36;
            win = true;
            break checkwin;
        }        
    }

    if (win) {
        const profit = (amount * multiplier);

        embed.addFields( {name: "You won!", value: "Profit: " + profit + " TOPS :fire:!"} );
        message.channel.send({embeds: [embed]})
        return profit;
    } else {
        embed.addFields( {name: "You lost!", value: `Loss: ${amount} TOPS :sob:!`} )
        message.channel.send({embeds: [embed]})
        return -amount;
    }
}

module.exports = {
    isValidBet: isValidBet,
    betRoulette: betRoulette
}