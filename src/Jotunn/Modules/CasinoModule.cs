using Discord;
using Discord.Interactions;
using Jotunn.Casino;
using Jotunn.Data;

namespace Jotunn.Modules;

[Group("casino", "Casino commands")]
public class CasinoModule(CasinoRepository casino) : InteractionModuleBase<SocketInteractionContext>
{
    private const int MinBet = 10;
    private static readonly Color CasinoColor = Color.Green;

    // ── /casino balance ────────────────────────────────────────────────────
    [SlashCommand("balance", "Check your TOPS balance")]
    public async Task BalanceAsync()
    {
        var balance = await casino.GetBalanceAsync(Context.Guild.Id, Context.User.Id);
        if (balance == null)
        {
            await RespondAsync("You don't have an account yet. Play a game to get started!", ephemeral: true);
            return;
        }
        await RespondAsync($"Your balance is: **{balance} TOPS**");
    }

    // ── /casino give ───────────────────────────────────────────────────────
    [SlashCommand("give", "Gift TOPS to another user")]
    public async Task GiveAsync(
        [Summary("user", "Recipient")] IGuildUser target,
        [Summary("amount", "Amount to gift")] int amount)
    {
        if (amount < 0)
        {
            await RespondAsync("Very clever.", ephemeral: true);
            return;
        }

        var balance = await casino.GetBalanceAsync(Context.Guild.Id, Context.User.Id);
        if (balance == null || balance < amount)
        {
            await RespondAsync($"You're too poor! Your balance is: {balance ?? 0} TOPS", ephemeral: true);
            return;
        }

        await casino.TransferAsync(Context.Guild.Id, Context.User.Id, target.Id, amount);
        await RespondAsync($"Gifted **{amount} TOPS** to <@{target.Id}>! New balance: {balance - amount} TOPS");
    }

    // ── /casino leaderboards ───────────────────────────────────────────────
    [SlashCommand("leaderboards", "Show the TOPS leaderboard")]
    public async Task LeaderboardsAsync()
    {
        var rows = (await casino.GetLeaderboardAsync(Context.Guild.Id)).ToList();

        if (rows.Count == 0)
        {
            await RespondAsync("No leaderboards yet!", ephemeral: true);
            return;
        }

        int leaderLength = Math.Min(10, rows.Count);
        var posStr     = string.Join("\n", Enumerable.Range(1, leaderLength));
        var userStr    = string.Join("\n", rows.Take(leaderLength).Select(r => $"<@{r.UserId}>"));
        var balanceStr = string.Join("\n", rows.Take(leaderLength).Select(r => r.Balance));

        var embed = new EmbedBuilder()
            .WithColor(new Color(0xFFD700))
            .WithTitle(":trophy: Leaderboards :trophy:")
            .AddField("Pos",     posStr,     inline: true)
            .AddField("User",    userStr,    inline: true)
            .AddField("Balance", balanceStr, inline: true);

        // Show caller's position
        var callerIdx = rows.FindIndex(r => r.UserId == Context.User.Id.ToString());
        if (callerIdx >= 0)
        {
            embed
                .AddField("\u200b", "Your position:")
                .AddField("Pos",     $"{callerIdx + 1} / {rows.Count}", inline: true)
                .AddField("User",    $"<@{Context.User.Id}>",            inline: true)
                .AddField("Balance", rows[callerIdx].Balance.ToString(), inline: true);
        }

        await RespondAsync(embed: embed.Build());
    }

    // ── /casino slots ──────────────────────────────────────────────────────
    [SlashCommand("slots", "Spin the slot machine")]
    public async Task SlotsAsync(
        [Summary("bet", "Amount to bet (or 'all')")] string betStr)
    {
        var (bet, err) = await ParseBetAsync(betStr);
        if (err != null) { await RespondAsync(err, ephemeral: true); return; }

        var result = Slots.Spin(bet);
        var embed = new EmbedBuilder()
            .WithColor(CasinoColor)
            .WithTitle("Slots:")
            .AddField("\u200b", Slots.SymbolEmoji(result.S1), inline: true)
            .AddField("\u200b", Slots.SymbolEmoji(result.S2), inline: true)
            .AddField("\u200b", Slots.SymbolEmoji(result.S3), inline: true);

        if (result.Win)
        {
            embed.AddField("You won!", $"Prize: {result.BalanceChange} TOPS 🔥!");
            await casino.AddWinAsync(Context.Guild.Id, Context.User.Id, result.BalanceChange - bet);
        }
        else
        {
            embed.AddField("You lost!", $"Loss: {bet} TOPS 😭!");
            await casino.AddLossAsync(Context.Guild.Id, Context.User.Id, result.BalanceChange);
        }

        await RespondAsync(embed: embed.Build());
    }

    // ── /casino roulette ───────────────────────────────────────────────────
    [SlashCommand("roulette", "Bet on roulette")]
    public async Task RouletteAsync(
        [Summary("bet", "Bet type: red/black/green/odd/even/1st/2nd/3rd or a number 0-36")] string bet,
        [Summary("amount", "Amount to bet (or 'all')")] string amountStr)
    {
        bet = bet.ToLowerInvariant().Trim();
        if (!Roulette.IsValidBet(bet))
        {
            await RespondAsync($"**{bet}** is not a valid bet. Choose: red/black/green/odd/even/1st/2nd/3rd or 0-36.", ephemeral: true);
            return;
        }

        var (amount, err) = await ParseBetAsync(amountStr);
        if (err != null) { await RespondAsync(err, ephemeral: true); return; }

        var result = Roulette.Spin(bet, amount);
        var embed = new EmbedBuilder()
            .WithColor(CasinoColor)
            .WithTitle("Roulette:")
            .WithDescription($"Result: {result.Color}");

        if (result.Win)
        {
            embed.AddField("You won!", $"Prize: {result.BalanceChange} TOPS 🔥!");
            await casino.AddWinAsync(Context.Guild.Id, Context.User.Id, result.BalanceChange - amount);
        }
        else
        {
            embed.AddField("You lost!", $"Loss: {amount} TOPS 😭!");
            await casino.AddLossAsync(Context.Guild.Id, Context.User.Id, result.BalanceChange);
        }

        await RespondAsync(embed: embed.Build());
    }

    // ── /casino blackjack ──────────────────────────────────────────────────
    [SlashCommand("blackjack", "Start a blackjack game")]
    public async Task BlackjackAsync(
        [Summary("bet", "Amount to bet (or 'all')")] string betStr)
    {
        var existing = Blackjack.GetGame(Context.User.Id);
        if (existing?.Status == BlackjackStatus.Playing)
        {
            await RespondAsync("You're already in a game. Use `/casino hit` or `/casino stand`.", ephemeral: true);
            return;
        }

        var (bet, err) = await ParseBetAsync(betStr);
        if (err != null) { await RespondAsync(err, ephemeral: true); return; }

        var game = Blackjack.CreateGame(Context.User.Id, bet);
        await RespondAsync(embed: RenderBlackjackEmbed(game, Context.User.Id));
    }

    // ── /casino hit ────────────────────────────────────────────────────────
    [SlashCommand("hit", "Draw another card in blackjack")]
    public async Task HitAsync()
    {
        var result = Blackjack.Hit(Context.User.Id);
        if (result == null)
        {
            await RespondAsync("You're not in a game!", ephemeral: true);
            return;
        }

        var game = Blackjack.GetGame(Context.User.Id)!;
        var embed = new EmbedBuilder()
            .WithColor(CasinoColor)
            .WithTitle("Blackjack:")
            .WithDescription(BuildGameDescription(game, Context.User.Id, false));

        if (result.Bust)
        {
            embed.AddField("Busted!", $"You lost {result.Bet} TOPS 😭");
            await casino.AddLossAsync(Context.Guild.Id, Context.User.Id, -result.Bet);
            Blackjack.ClearGame(Context.User.Id);
        }

        await RespondAsync(embed: embed.Build());
    }

    // ── /casino stand ──────────────────────────────────────────────────────
    [SlashCommand("stand", "Stand in blackjack")]
    public async Task StandAsync()
    {
        var result = Blackjack.Stand(Context.User.Id);
        if (result == null)
        {
            await RespondAsync("You're not in a game!", ephemeral: true);
            return;
        }

        var game = Blackjack.GetGame(Context.User.Id)!;
        var embed = new EmbedBuilder()
            .WithColor(CasinoColor)
            .WithTitle("Blackjack:")
            .WithDescription(BuildGameDescription(game, Context.User.Id, true));

        switch (result.Outcome)
        {
            case BlackjackOutcome.Win:
                embed.AddField("You won!", $"Prize: {result.Payout} TOPS 🔥");
                await casino.AddWinAsync(Context.Guild.Id, Context.User.Id, result.Payout);
                break;
            case BlackjackOutcome.Push:
                embed.AddField("Push!", "It's a tie, your bet is returned.");
                break;
            case BlackjackOutcome.Lose:
                embed.AddField($"You lost {result.Bet} TOPS 😭", "Better luck next time!");
                await casino.AddLossAsync(Context.Guild.Id, Context.User.Id, -result.Bet);
                break;
        }

        await RespondAsync(embed: embed.Build());
        Blackjack.ClearGame(Context.User.Id);
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private async Task<(int Bet, string? Error)> ParseBetAsync(string raw)
    {
        raw = raw.ToLowerInvariant().Trim();

        if (raw == "all")
        {
            var bal = await casino.GetBalanceAsync(Context.Guild.Id, Context.User.Id);
            if (bal == null || bal == 0)
                return (0, "You have no balance!");
            return (bal.Value, null);
        }

        if (!int.TryParse(raw, out var amount))
            return (0, "Nice try dumbo.");

        if (amount < MinBet)
            return (0, $"Minimum bet is {MinBet} TOPS.");

        var balance = await casino.GetBalanceAsync(Context.Guild.Id, Context.User.Id);
        if (balance == null || balance < amount)
            return (0, $"You're too poor! Your balance is: {balance ?? 0} TOPS");

        return (amount, null);
    }

    private static Embed RenderBlackjackEmbed(BlackjackGame game, ulong userId)
        => new EmbedBuilder()
            .WithColor(CasinoColor)
            .WithTitle("Blackjack:")
            .WithDescription(BuildGameDescription(game, userId, false))
            .Build();

    private static string BuildGameDescription(BlackjackGame game, ulong userId, bool showDealer)
    {
        var playerVal = Blackjack.GetHandValue(game.PlayerHand);
        if (showDealer)
        {
            var dealerVal = Blackjack.GetHandValue(game.DealerHand);
            return $"**User**: <@{userId}>\n" +
                   $"**Your hand**: {Blackjack.FormatHand(game.PlayerHand)} ({playerVal})\n" +
                   $"**Dealer hand**: {Blackjack.FormatHand(game.DealerHand)} ({dealerVal})";
        }
        return $"**User**: <@{userId}>\n" +
               $"**Your hand**: {Blackjack.FormatHand(game.PlayerHand)} ({playerVal})\n" +
               $"**Dealer shows**: {game.DealerHand[0]}";
    }
}
