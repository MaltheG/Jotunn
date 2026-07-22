// src/casino/Blackjack.js
// Mirrors Blackjack.cs — in-memory blackjack state machine.

const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawCard() {
  return {
    suit:  SUITS[Math.floor(Math.random() * SUITS.length)],
    value: VALUES[Math.floor(Math.random() * VALUES.length)],
  };
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value, 10);
}

function handValue(hand) {
  let value = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces  = hand.filter(c => c.value === 'A').length;
  while (value > 21 && aces > 0) { value -= 10; aces--; }
  return value;
}

function formatHand(hand) {
  return hand.map(c => `${c.value}${c.suit}`).join(' ');
}

/** @type {Map<string, {bet: number, playerHand: object[], dealerHand: object[], status: string}>} */
const games = new Map();

export const Blackjack = {
  createGame(userId, bet) {
    const game = {
      bet,
      playerHand: [drawCard(), drawCard()],
      dealerHand: [drawCard(), drawCard()],
      status: 'playing',
    };
    games.set(userId, game);
    return game;
  },

  getGame(userId) {
    return games.get(userId) ?? null;
  },

  clearGame(userId) {
    games.delete(userId);
  },

  hit(userId) {
    const game = games.get(userId);
    if (!game || game.status !== 'playing') return null;

    game.playerHand.push(drawCard());
    const value = handValue(game.playerHand);

    if (value > 21) {
      game.status = 'finished';
      return { bust: true, playerValue: value, bet: game.bet };
    }

    return { bust: false, playerValue: value, bet: game.bet };
  },

  stand(userId) {
    const game = games.get(userId);
    if (!game || game.status !== 'playing') return null;

    game.status = 'stand';

    // Dealer draws to 17+
    let dealerVal = handValue(game.dealerHand);
    while (dealerVal < 17) {
      game.dealerHand.push(drawCard());
      dealerVal = handValue(game.dealerHand);
    }

    const playerVal = handValue(game.playerHand);
    game.status = 'finished';

    let outcome, payout;
    if (dealerVal > 21 || playerVal > dealerVal) {
      outcome = 'win';
      payout  = game.bet * 2;
    } else if (playerVal === dealerVal) {
      outcome = 'push';
      payout  = game.bet;
    } else {
      outcome = 'lose';
      payout  = 0;
    }

    return { outcome, playerValue: playerVal, dealerValue: dealerVal, payout, bet: game.bet };
  },

  formatHand,
  handValue,
};
