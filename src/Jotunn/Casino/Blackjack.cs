using System.Collections.Concurrent;

namespace Jotunn.Casino;

public enum BlackjackStatus { Playing, Stand, Finished }
public enum BlackjackOutcome { Win, Push, Lose }

public record Card(string Suit, string Value)
{
    public override string ToString() => $"{Value}{Suit}";
}

public class BlackjackGame
{
    public int Bet { get; init; }
    public List<Card> PlayerHand { get; } = [];
    public List<Card> DealerHand { get; } = [];
    public BlackjackStatus Status { get; set; } = BlackjackStatus.Playing;
}

public record BlackjackHitResult(bool Bust, int PlayerValue, int Bet);
public record BlackjackStandResult(BlackjackOutcome Outcome, int PlayerValue, int DealerValue, int Payout, int Bet);

public static class Blackjack
{
    private static readonly string[] Suits  = ["♠", "♥", "♦", "♣"];
    private static readonly string[] Values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

    private static readonly ConcurrentDictionary<ulong, BlackjackGame> Games = new();

    private static Card DrawCard()
        => new(Suits[Random.Shared.Next(Suits.Length)], Values[Random.Shared.Next(Values.Length)]);

    private static int CardValue(Card c) => c.Value switch
    {
        "J" or "Q" or "K" => 10,
        "A"                => 11,
        _                  => int.Parse(c.Value)
    };

    private static int HandValue(IEnumerable<Card> hand)
    {
        var cards = hand.ToList();
        int value = cards.Sum(CardValue);
        int aces  = cards.Count(c => c.Value == "A");
        while (value > 21 && aces > 0) { value -= 10; aces--; }
        return value;
    }

    public static BlackjackGame CreateGame(ulong userId, int bet)
    {
        var game = new BlackjackGame { Bet = bet };
        game.PlayerHand.Add(DrawCard()); game.PlayerHand.Add(DrawCard());
        game.DealerHand.Add(DrawCard()); game.DealerHand.Add(DrawCard());
        Games[userId] = game;
        return game;
    }

    public static BlackjackGame? GetGame(ulong userId)
        => Games.TryGetValue(userId, out var g) ? g : null;

    public static void ClearGame(ulong userId)
        => Games.TryRemove(userId, out _);

    public static BlackjackHitResult? Hit(ulong userId)
    {
        var game = GetGame(userId);
        if (game == null || game.Status != BlackjackStatus.Playing) return null;

        game.PlayerHand.Add(DrawCard());
        var value = HandValue(game.PlayerHand);

        if (value > 21)
        {
            game.Status = BlackjackStatus.Finished;
            return new BlackjackHitResult(true, value, game.Bet);
        }

        return new BlackjackHitResult(false, value, game.Bet);
    }

    public static BlackjackStandResult? Stand(ulong userId)
    {
        var game = GetGame(userId);
        if (game == null || game.Status != BlackjackStatus.Playing) return null;

        game.Status = BlackjackStatus.Stand;

        // Dealer draws until 17+
        int dealerVal = HandValue(game.DealerHand);
        while (dealerVal < 17)
        {
            game.DealerHand.Add(DrawCard());
            dealerVal = HandValue(game.DealerHand);
        }

        int playerVal = HandValue(game.PlayerHand);
        game.Status = BlackjackStatus.Finished;

        BlackjackOutcome outcome;
        int payout;

        if (dealerVal > 21 || playerVal > dealerVal)
        {
            outcome = BlackjackOutcome.Win;
            payout  = game.Bet * 2;
        }
        else if (playerVal == dealerVal)
        {
            outcome = BlackjackOutcome.Push;
            payout  = game.Bet;
        }
        else
        {
            outcome = BlackjackOutcome.Lose;
            payout  = 0;
        }

        return new BlackjackStandResult(outcome, playerVal, dealerVal, payout, game.Bet);
    }

    public static string FormatHand(IEnumerable<Card> hand)
        => string.Join(" ", hand);

    public static int GetHandValue(IEnumerable<Card> hand)
        => HandValue(hand.ToList());
}
