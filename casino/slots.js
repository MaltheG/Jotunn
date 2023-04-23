const {MessageEmbed} = require("discord.js");
const embedColour = "#009900";

const symbolReturns = new Map();

symbolReturns.set(':pinching_hand:', 4);
//symbolReturns.set(':ok_hand:', 3);
symbolReturns.set(':poop:', 8);
symbolReturns.set(':eggplant:', 12);
//symbolReturns.set(':muscle:', 15);
symbolReturns.set(':fire:', 21); //21 has 98% return

const symbols = Array.from(symbolReturns.keys());

function getSymbol() {
    const symbol = symbols[Math.floor(Math.random()*symbols.length)]
    return symbol;
}

function betSlots(message, amount) {
    const embed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle("Slots:")


    const symbol1 = getSymbol();
    const symbol2 = getSymbol();
    const symbol3 = getSymbol();

    embed.addFields(
        { name: " ", value: symbol1, inline: true },
        { name: " ", value: symbol2, inline: true },
        { name: " ", value: symbol3, inline: true }
    )

    //{ name: ":one:", value: symbol1, inline: true },
    //{ name: ":two:", value: symbol2, inline: true },
    //{ name: ":three:", value: symbol3, inline: true }
    //message.channel.send("Result:")
    //message.channel.send(symbol1 + " " + symbol2 + " " + symbol3);

    let win = false;
    let multiplier = 0;

    if(symbol1 == symbol2 && symbol1 == symbol3) {
        multiplier = symbolReturns.get(symbol1);
        win = true;
    } else {
        let firecount = 0;

        if (symbol1 == ':fire:') firecount++;
        if (symbol2 == ':fire:') firecount++;
        if (symbol3 == ':fire:') firecount++;

        if (firecount > 1) {
            multiplier = 2;
            win = true;
        } 
    }

    if (win) {
        const profit = (amount * multiplier);

        embed.addFields( {name: "You won!", value: "Profit: " + profit + " TOPS :fire:!"} );
        message.channel.send({embeds: [embed]})
        return profit;
    } else {
        embed.addFields( {name: "You lost", value: "No bueno :sob:"} )
        message.channel.send({embeds: [embed]})
        return -amount;
    }
}


function testSlots(iterations) {
    let won = 0;
    let lost = 0;

    const bet_amount = 10;

    for(i = 0; i < iterations; i++) {
        const symbol1 = getSymbol();
        const symbol2 = getSymbol();
        const symbol3 = getSymbol();

        let win = false;
        let multiplier = 0;

        if(symbol1 == symbol2 && symbol1 == symbol3) {
            multiplier = symbolReturns.get(symbol1);
            win = true;
        } else {
            let firecount = 0;

            if (symbol1 == ':fire:') firecount++;
            if (symbol2 == ':fire:') firecount++;
            if (symbol3 == ':fire:') firecount++;

            if (firecount > 1) {
                multiplier = 2;
                win = true;
            } 
        }

        if(win) {
            won += bet_amount * multiplier;
        }
        
        lost += bet_amount;
        
    }
    
    console.log(won);
    console.log(lost)
}

module.exports = {
    betSlots: betSlots
}