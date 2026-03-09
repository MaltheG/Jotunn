namespace Jotunn.Casino;

public enum SlotSymbol
{
    PinchingHand,
    Poop,
    Eggplant,
    Fire
}

public record SlotResult(SlotSymbol S1, SlotSymbol S2, SlotSymbol S3, int Multiplier, bool Win, int BalanceChange);

public static class Slots
{
    // Multipliers for three-of-a-kind
    private static readonly Dictionary<SlotSymbol, int> Multipliers = new()
    {
        [SlotSymbol.PinchingHand] = 4,
        [SlotSymbol.Poop]         = 8,
        [SlotSymbol.Eggplant]     = 12,
        [SlotSymbol.Fire]         = 21,
    };

    private static readonly SlotSymbol[] Symbols = (SlotSymbol[])Enum.GetValues(typeof(SlotSymbol));

    private static SlotSymbol RandomSymbol()
        => Symbols[Random.Shared.Next(Symbols.Length)];

    public static SlotResult Spin(int bet)
    {
        var s1 = RandomSymbol();
        var s2 = RandomSymbol();
        var s3 = RandomSymbol();

        // Three of a kind
        if (s1 == s2 && s1 == s3)
        {
            var mult = Multipliers[s1];
            return new SlotResult(s1, s2, s3, mult, true, bet * mult);
        }

        // Two fires = 2x
        var fires = (s1 == SlotSymbol.Fire ? 1 : 0)
                  + (s2 == SlotSymbol.Fire ? 1 : 0)
                  + (s3 == SlotSymbol.Fire ? 1 : 0);

        if (fires >= 2)
            return new SlotResult(s1, s2, s3, 2, true, bet * 2);

        return new SlotResult(s1, s2, s3, 0, false, -bet);
    }

    public static string SymbolEmoji(SlotSymbol s) => s switch
    {
        SlotSymbol.PinchingHand => "🤏",
        SlotSymbol.Poop         => "💩",
        SlotSymbol.Eggplant     => "🍆",
        SlotSymbol.Fire         => "🔥",
        _                       => "?"
    };
}
