using Discord;
using Discord.Interactions;
using Jotunn.Data;

namespace Jotunn.Modules;

[Group("util", "Utility commands")]
public class UtilityModule(
    NicknameHistoryRepository nicknameHistory,
    SongHistoryRepository songHistory) : InteractionModuleBase<SocketInteractionContext>
{
    // ── /util setname ──────────────────────────────────────────────────────
    [SlashCommand("setname", "Set a server nickname for another user")]
    public async Task SetNameAsync(
        [Summary("user", "The user to rename")] IGuildUser target,
        [Summary("nickname", "New nickname (max 32 characters)")] string nickname)
    {
        if (target.Id == Context.User.Id)
        {
            await RespondAsync($"<@{target.Id}> er en pølse", ephemeral: true);
            return;
        }

        if (nickname.Length > 32)
        {
            await RespondAsync("Name must not be longer than 32 characters.", ephemeral: true);
            return;
        }

        try
        {
            await target.ModifyAsync(p => p.Nickname = nickname);
        }
        catch
        {
            await RespondAsync("Failed to change name. Missing permissions?", ephemeral: true);
            return;
        }

        await nicknameHistory.AddAsync(target.Id, nickname, Context.User.Id);
        await RespondAsync($"Successfully changed <@{target.Id}>'s name to **{nickname}**.");
    }

    // ── /util history ──────────────────────────────────────────────────────
    [SlashCommand("history", "View nickname history for a user")]
    public async Task HistoryAsync(
        [Summary("user", "The user to look up")] IGuildUser target,
        [Summary("length", "Number of entries to show (default 5)")] int length = 5)
    {
        var rows = (await nicknameHistory.GetAsync(target.Id)).ToList();

        if (rows.Count == 0)
        {
            await RespondAsync("This user has no nickname history.", ephemeral: true);
            return;
        }

        length = Math.Min(length, rows.Count);
        var recent = rows.TakeLast(length).ToList();

        var nicknameStr = string.Join("\n", recent.Select(r => r.Nickname));
        var authorStr   = string.Join("\n", recent.Select(r => $"<@{r.Namer}>"));
        var dateStr     = string.Join("\n", recent.Select(r => r.Time.ToString("dd-MM-yyyy")));

        var embed = new EmbedBuilder()
            .WithColor(Color.Red)
            .WithAuthor("Nickname history")
            .AddField("User", $"<@{target.Id}>")
            .AddField("Nickname", nicknameStr, inline: true)
            .AddField("Author",   authorStr,   inline: true)
            .AddField("Date",     dateStr,      inline: true)
            .WithCurrentTimestamp()
            .Build();

        await RespondAsync(embed: embed);
    }

    // ── /util songhistory ──────────────────────────────────────────────────
    [SlashCommand("songhistory", "View song history for the server or a specific user")]
    public async Task SongHistoryAsync(
        [Summary("user", "Optional: a specific user's history")] IGuildUser? user = null)
    {
        if (user != null)
        {
            var rows = (await songHistory.GetUserHistoryAsync(Context.Guild.Id, user.Id)).ToList();

            if (rows.Count == 0)
            {
                await RespondAsync("This user has no song history.", ephemeral: true);
                return;
            }

            var requestStr = string.Join("\n", rows.Select(r => r.Requests));
            var nameStr    = string.Join("\n", rows.Select(r =>
            {
                var name = r.SongName.Length > 50 ? r.SongName[..50] + "…" : r.SongName;
                return $"[{name}]({r.SongUrl})";
            }));
            var playsStr = string.Join("\n", rows.Select(r => r.Plays));

            var embed = new EmbedBuilder()
                .WithColor(Color.Red)
                .WithAuthor("Song history")
                .AddField("User", $"<@{user.Id}>")
                .AddField("Requests", requestStr, inline: true)
                .AddField("Song",     nameStr,    inline: true)
                .AddField("Plays",    playsStr,   inline: true)
                .WithCurrentTimestamp()
                .Build();

            await RespondAsync(embed: embed);
        }
        else
        {
            var rows = (await songHistory.GetGuildHistoryAsync(Context.Guild.Id)).ToList();

            if (rows.Count == 0)
            {
                await RespondAsync("This server has no song history.", ephemeral: true);
                return;
            }

            var requestStr = string.Join("\n", rows.Select(r => r.Requests));
            var nameStr    = string.Join("\n", rows.Select(r =>
            {
                var name = r.SongName.Length > 50 ? r.SongName[..50] + "…" : r.SongName;
                return $"[{name}]({r.SongUrl})";
            }));
            var playsStr = string.Join("\n", rows.Select(r => r.Plays));

            var embed = new EmbedBuilder()
                .WithColor(Color.Red)
                .WithAuthor("Song history")
                .AddField("Requests", requestStr, inline: true)
                .AddField("Song",     nameStr,    inline: true)
                .AddField("Plays",    playsStr,   inline: true)
                .WithCurrentTimestamp()
                .Build();

            await RespondAsync(embed: embed);
        }
    }
}
