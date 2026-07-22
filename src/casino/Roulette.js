// src/casino/Roulette.js
// Mirrors Roulette.cs

const REDS   = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACKS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

const BET_MULTIPLIERS = {
  red: 2, black: 2, green: 36, even: 2, odd: 2,
  '1st': 3, '2nd': 3, '3rd': 3,
};

export const Roulette = {
  isValidBet(bet) {
    if (bet in BET_MULTIPLIERS) return true;
    const n = parseInt(bet, 10);
    return !isNaN(n) && n >= 0 && n <= 36;
  },

  spin(bet, amount) {
    const hit   = Math.floor(Math.random() * 37); // 0–36
    const color = hit === 0 ? 'green' : REDS.has(hit) ? 'red' : 'black';
    const colorEmoji = hit === 0 ? '🟩' : REDS.has(hit) ? '🟥' : '⬛';

    let win = false, multiplier = 0;

    if (hit === 0) {
      if (bet === 'green' || bet === '0') { win = true; multiplier = BET_MULTIPLIERS['green']; }
    } else {
      if      (bet === 'odd'   && hit % 2 === 1)               { win = true; multiplier = 2; }
      else if (bet === 'even'  && hit % 2 === 0)               { win = true; multiplier = 2; }
      else if (bet === '1st'   && hit <= 12)                   { win = true; multiplier = 3; }
      else if (bet === '2nd'   && hit >= 13 && hit <= 24)      { win = true; multiplier = 3; }
      else if (bet === '3rd'   && hit >= 25)                   { win = true; multiplier = 3; }
      else if (bet === 'black' && BLACKS.has(hit))             { win = true; multiplier = 2; }
      else if (bet === 'red'   && REDS.has(hit))               { win = true; multiplier = 2; }
      else if (parseInt(bet, 10) === hit && !isNaN(parseInt(bet, 10))) { win = true; multiplier = 36; }
    }

    const balanceChange = win ? amount * multiplier : -amount;
    return { number: hit, color: `${hit} ${colorEmoji}`, win, multiplier, balanceChange };
  },
};
