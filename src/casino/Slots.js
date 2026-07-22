// src/casino/Slots.js
// Mirrors Slots.cs

const SYMBOLS = ['pinchingHand', 'poop', 'eggplant', 'fire'];

const MULTIPLIERS = {
  pinchingHand: 4,
  poop:         8,
  eggplant:     12,
  fire:         21,
};

const EMOJIS = {
  pinchingHand: '🤏',
  poop:         '💩',
  eggplant:     '🍆',
  fire:         '🔥',
};

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

export const Slots = {
  spin(bet) {
    const s1 = randomSymbol();
    const s2 = randomSymbol();
    const s3 = randomSymbol();

    // Three of a kind
    if (s1 === s2 && s1 === s3) {
      const mult = MULTIPLIERS[s1];
      return { s1, s2, s3, multiplier: mult, win: true, balanceChange: bet * mult };
    }

    // Two or more fires = 2x
    const fires = [s1, s2, s3].filter(s => s === 'fire').length;
    if (fires >= 2) {
      return { s1, s2, s3, multiplier: 2, win: true, balanceChange: bet * 2 };
    }

    return { s1, s2, s3, multiplier: 0, win: false, balanceChange: -bet };
  },

  emoji(symbol) {
    return EMOJIS[symbol] ?? '?';
  },
};
