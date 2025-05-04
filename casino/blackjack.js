const { MessageEmbed } = require("discord.js");
const embedColour = "#009900";

const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const activeGames = new Map(); // userId -> game state

function drawCard() {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    return { suit, value };
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
}

function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        value += getCardValue(card);
        if (card.value === 'A') aces++;
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

function formatHand(hand) {
    return hand.map(c => `${c.value}${c.suit}`).join(' ');
}

function createGame(userId, amount) {
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    const game = {
        bet: amount,
        playerHand,
        dealerHand,
        status: "playing" // could be: "playing", "stand", "finished"
    };

    activeGames.set(userId, game);
    return game;
}

function getGame(userId) {
    return activeGames.get(userId);
}

function clearGame(userId) {
    activeGames.delete(userId);
}

function handleHit(userId) {
    const game = getGame(userId);
    if (!game || game.status !== "playing") return null;

    game.playerHand.push(drawCard());
    const value = calculateHandValue(game.playerHand);

    if (value > 21) {
        game.status = "finished";
        return { result: "bust", value, bet: game.bet };
    }

    return { result: "continue", value, bet: game.bet };
}

function handleStand(userId) {
    const game = getGame(userId);
    if (!game || game.status !== "playing") return null;

    game.status = "stand";

    let dealerValue = calculateHandValue(game.dealerHand);
    while (dealerValue < 17) {
        game.dealerHand.push(drawCard());
        dealerValue = calculateHandValue(game.dealerHand);
    }

    const playerValue = calculateHandValue(game.playerHand);

    let result = "lose";
    let payout = 0;

    if (dealerValue > 21 || playerValue > dealerValue) {
        result = "win";
        payout = game.bet * 2;
    } else if (dealerValue === playerValue) {
        result = "push";
        payout = game.bet;
    }

    game.status = "finished";

    return {
        result,
        playerValue,
        dealerValue,
        payout,
        bet: game.bet
    };
}

function renderGameEmbed(userId, phase = "playing") {
    const game = getGame(userId);
    if (!game) return null;

    const embed = new MessageEmbed().setColor(embedColour).setTitle("Blackjack:");
    const playerVal = calculateHandValue(game.playerHand);

    if (phase === "playing") {
        embed.setDescription(`**User**: <@${userId}> \n**Your hand**: ${formatHand(game.playerHand)} (${playerVal})\n**Dealer shows**: ${game.dealerHand[0].value}${game.dealerHand[0].suit}`);
    } else if (phase === "result") {
        const dealerVal = calculateHandValue(game.dealerHand);
        embed.setDescription(`**User**: <@${userId}> \n**Your hand**: ${formatHand(game.playerHand)} (${playerVal})\n**Dealer hand**: ${formatHand(game.dealerHand)} (${dealerVal})`);
    }

    return embed;
}

module.exports = {
    createGame,
    getGame,
    clearGame,
    handleHit,
    handleStand,
    renderGameEmbed
};
