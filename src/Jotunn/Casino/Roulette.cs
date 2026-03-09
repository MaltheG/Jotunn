namespace Jotunn.Casino;

public record RouletteResult(int Number, string Color, bool Win, int Multiplier, int BalanceChange);

public static class Roulette
{
    private static readonly HashSet<int> Reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    private static readonly HashSet<int> Blacks = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

    private static readonly Dictionary<string, int> BetMultipliers = new()
    {
        ["red"]   = 2,
        ["black"] = 2,
        ["green"] = 36,
        ["even"]  = 2,
        ["odd"]   = 2,
        ["1st"]   = 3,
        ["2nd"]   = 3,
        ["3rd"]   = 3,
    };

    public static bool IsValidBet(string bet)
        => BetMultipliers.ContainsKey(bet) || (int.TryParse(bet, out var n) && n >= 0 && n <= 36);

    public static RouletteResult Spin(string bet, int amount)
    {
        var hit = Random.Shared.Next(37); // 0–36
        var color = hit == 0 ? "green" : Reds.Contains(hit) ? "red" : "black";
        var colorEmoji = hit == 0 ? "🟩" : Reds.Contains(hit) ? "🟥" : "⬛";

        bool win = false;
        int multiplier = 0;

        if (hit == 0)
        {
            if (bet == "green" || bet == "0") { win = true; multiplier = BetMultipliers["green"]; }
        }
        else
        {
            if (bet == "odd"  && hit % 2 == 1)               { win = true; multiplier = 2; }
            else if (bet == "even" && hit % 2 == 0)          { win = true; multiplier = 2; }
            else if (bet == "1st" && hit <= 12)               { win = true; multiplier = 3; }
            else if (bet == "2nd" && hit >= 13 && hit <= 24)  { win = true; multiplier = 3; }
            else if (bet == "3rd" && hit >= 25)               { win = true; multiplier = 3; }
            else if (bet == "black" && Blacks.Contains(hit))  { win = true; multiplier = 2; }
            else if (bet == "red"   && Reds.Contains(hit))    { win = true; multiplier = 2; }
            else if (int.TryParse(bet, out var n) && n == hit){ win = true; multiplier = 36; }
        }

        var balanceChange = win ? amount * multiplier : -amount;
        return new RouletteResult(hit, $"{hit} {colorEmoji}", win, multiplier, balanceChange);
    }
}
