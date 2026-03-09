using Discord;
using Discord.Interactions;
using Discord.Audio;
using Jotunn.Data;
using Jotunn.Models;
using Jotunn.Services;

namespace Jotunn.Modules;

[Group("music", "Music playback commands")]
public class MusicModule(
    GuildQueueService queues,
    YoutubeService youtube,
    AudioPlayerService player,
    SongHistoryRepository songHistory) : InteractionModuleBase<SocketInteractionContext>
{
    // ── /play ──────────────────────────────────────────────────────────────
    [SlashCommand("play", "Play a song or playlist from YouTube")]
    public async Task PlayAsync(
        [Summary("query", "YouTube URL or search terms")] string query)
    {
        await DeferAsync();

        var user = Context.User as IGuildUser;
        var voiceChannel = user?.VoiceChannel;
        if (voiceChannel == null)
        {
            await FollowupAsync("You need to be in a voice channel.", ephemeral: true);
            return;
        }

        var queue = queues.GetOrCreate(Context.Guild.Id);

        // Join if not already connected
        if (queue.AudioClient == null || queue.AudioClient.ConnectionState == ConnectionState.Disconnected)
        {
            try
            {
                var audioClient = await voiceChannel.ConnectAsync();
                queue.AudioClient = audioClient;
                queue.AudioStream = audioClient.CreatePCMStream(AudioApplication.Music, bufferMillis: 1000);
            }
            catch (Exception ex)
            {
                await FollowupAsync($"Could not join voice channel: {ex.Message}");
                return;
            }
        }

        // Reject non-YouTube URLs
        if (query.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
            !query.Contains("youtube.com") && !query.Contains("youtu.be"))
        {
            await FollowupAsync("Jeg skal nok tilføje det, okay :(");
            return;
        }

        SongResult result;
        try
        {
            result = await youtube.ResolveAsync(query, Context.Guild.Id, Context.User.Id);
        }
        catch (Exception ex)
        {
            await FollowupAsync($"Something went wrong: {ex.Message}");
            return;
        }

        int basePosition = queue.Songs.Count;
        foreach (var song in result.Songs)
        {
            var positioned = song with { Position = basePosition++ };
            queue.Songs.Add(positioned);
            await songHistory.AddSongRequestAsync(positioned);
        }

        if (result.Songs.Count > 1)
        {
            await FollowupAsync($"{result.Songs.Count} songs added to queue.");
        }
        else
        {
            var song = result.Songs[0];
            var (requests, plays) = await songHistory.GetSongStatsAsync(song.Id, Context.Guild.Id);
            var embed = BuildSongEmbed(song, queue.Playing ? "Song added:" : "Now playing:", requests, plays);
            await FollowupAsync(embed: embed);
        }

        if (!queue.Playing)
            await player.PlayNextAsync(Context.Guild.Id);
    }

    // ── /skip ──────────────────────────────────────────────────────────────
    [SlashCommand("skip", "Skip the current song")]
    public async Task SkipAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.Songs.Count == 0)
        {
            await RespondAsync("Nothing is playing.", ephemeral: true);
            return;
        }

        var skipped = queue.Songs[0].Title;
        player.Skip(Context.Guild.Id);
        await RespondAsync($"Skipped: **{skipped}**");
    }

    // ── /pause ─────────────────────────────────────────────────────────────
    [SlashCommand("pause", "Pause playback")]
    public async Task PauseAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || !queue.Playing)
        {
            await RespondAsync("Nothing is playing.", ephemeral: true);
            return;
        }

        player.Pause(Context.Guild.Id);
        await RespondAsync("Paused.");
    }

    // ── /unpause ───────────────────────────────────────────────────────────
    [SlashCommand("unpause", "Resume playback")]
    public async Task UnpauseAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.Songs.Count == 0)
        {
            await RespondAsync("Nothing in queue.", ephemeral: true);
            return;
        }

        await player.UnpauseAsync(Context.Guild.Id);
        await RespondAsync("Resumed.");
    }

    // ── /loop ──────────────────────────────────────────────────────────────
    [SlashCommand("loop", "Toggle looping of the current song")]
    public async Task LoopAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null)
        {
            await RespondAsync("Nothing is playing.", ephemeral: true);
            return;
        }

        queue.Loop = !queue.Loop;
        await RespondAsync(queue.Loop ? "Loop enabled." : "Loop disabled.");
    }

    // ── /queue ─────────────────────────────────────────────────────────────
    [SlashCommand("queue", "Show the current queue")]
    public async Task QueueAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.Songs.Count == 0)
        {
            await RespondAsync("The queue is empty.", ephemeral: true);
            return;
        }

        var positions = string.Join("\n", queue.Songs.Take(20).Select((_, i) => i == 0 ? "▶ Now" : $"{i}"));
        var titles = string.Join("\n", queue.Songs.Take(20).Select(s =>
            s.Title.Length > 50 ? s.Title[..50] + "…" : s.Title));
        var authors = string.Join("\n", queue.Songs.Take(20).Select(s => $"<@{s.AuthorId}>"));

        var embed = new EmbedBuilder()
            .WithColor(Color.Red)
            .WithAuthor("Queue:")
            .AddField("Pos", positions, inline: true)
            .AddField("Track", titles, inline: true)
            .AddField("Requested by", authors, inline: true)
            .WithCurrentTimestamp()
            .Build();

        await RespondAsync(embed: embed);
    }

    // ── /clear ─────────────────────────────────────────────────────────────
    [SlashCommand("clear", "Clear the queue (keeps current song)")]
    public async Task ClearAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.Songs.Count <= 1)
        {
            await RespondAsync("Nothing to clear.", ephemeral: true);
            return;
        }

        var count = queue.Songs.Count - 1;
        queue.Songs.RemoveRange(1, count);
        await RespondAsync($"Cleared {count} song(s) from the queue.");
    }

    // ── /remove ────────────────────────────────────────────────────────────
    [SlashCommand("remove", "Remove a song from the queue by position (1-based, 1 = next up)")]
    public async Task RemoveAsync([Summary("position", "Position in queue (1 = next up)")] int position)
    {
        var queue = queues.Get(Context.Guild.Id);
        // position 1 means second element (index 1) since index 0 is currently playing
        var idx = position; // skip index 0 (now playing)
        if (queue == null || idx < 1 || idx >= queue.Songs.Count)
        {
            await RespondAsync("Invalid position.", ephemeral: true);
            return;
        }

        var removed = queue.Songs[idx];
        queue.Songs.RemoveAt(idx);
        await RespondAsync($"Removed: **{removed.Title}**");
    }

    // ── /playnext ──────────────────────────────────────────────────────────
    [SlashCommand("playnext", "Queue a song to play after the current one")]
    public async Task PlayNextAsync([Summary("query", "YouTube URL or search terms")] string query)
    {
        await DeferAsync();

        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.AudioClient == null)
        {
            await FollowupAsync("Not connected to a voice channel. Use /music play first.", ephemeral: true);
            return;
        }

        SongResult result;
        try
        {
            result = await youtube.ResolveAsync(query, Context.Guild.Id, Context.User.Id);
        }
        catch (Exception ex)
        {
            await FollowupAsync($"Something went wrong: {ex.Message}");
            return;
        }

        // Insert after index 0 (currently playing)
        var insertAt = Math.Min(1, queue.Songs.Count);
        foreach (var (song, i) in result.Songs.Select((s, i) => (s, i)))
        {
            var positioned = song with { Position = insertAt + i };
            queue.Songs.Insert(insertAt + i, positioned);
            await songHistory.AddSongRequestAsync(positioned);
        }

        await FollowupAsync($"**{result.Songs[0].Title}** will play next.");
    }

    // ── /nowplaying ────────────────────────────────────────────────────────
    [SlashCommand("nowplaying", "Show the currently playing song")]
    public async Task NowPlayingAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue == null || queue.Songs.Count == 0)
        {
            await RespondAsync("Nothing is playing.", ephemeral: true);
            return;
        }

        var song = queue.Songs[0];
        var (requests, plays) = await songHistory.GetSongStatsAsync(song.Id, Context.Guild.Id);
        var embed = BuildSongEmbed(song, "Now playing:", requests, plays);
        await RespondAsync(embed: embed);
    }

    // ── /join ──────────────────────────────────────────────────────────────
    [SlashCommand("join", "Join your voice channel")]
    public async Task JoinAsync()
    {
        var user = Context.User as IGuildUser;
        var voiceChannel = user?.VoiceChannel;
        if (voiceChannel == null)
        {
            await RespondAsync("You need to be in a voice channel.", ephemeral: true);
            return;
        }

        var queue = queues.GetOrCreate(Context.Guild.Id);
        var audioClient = await voiceChannel.ConnectAsync();
        queue.AudioClient = audioClient;
        queue.AudioStream = audioClient.CreatePCMStream(AudioApplication.Music, bufferMillis: 1000);

        await RespondAsync($"Joined **{voiceChannel.Name}**.");
    }

    // ── /disconnect ────────────────────────────────────────────────────────
    [SlashCommand("disconnect", "Disconnect from the voice channel")]
    public async Task DisconnectAsync()
    {
        var queue = queues.Get(Context.Guild.Id);
        if (queue?.AudioClient == null)
        {
            await RespondAsync("Not connected.", ephemeral: true);
            return;
        }

        queue.PlaybackCts?.Cancel();
        await queue.AudioClient.StopAsync();
        queue.AudioClient = null;
        queue.AudioStream = null;
        queue.Playing = false;
        queue.Songs.Clear();
        queues.Remove(Context.Guild.Id);

        await RespondAsync("Disconnected.");
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private static Embed BuildSongEmbed(Song song, string title, long requests, long plays)
        => new EmbedBuilder()
            .WithColor(Color.Red)
            .WithTitle(song.Title)
            .WithUrl(song.Url)
            .WithAuthor(title)
            .AddField("Total requests", requests.ToString(), inline: true)
            .AddField("Total plays", plays.ToString(), inline: true)
            .AddField("Added by", $"<@{song.AuthorId}>")
            .AddField("Position in queue", song.Position.ToString(), inline: true)
            .AddField("Duration", song.Duration, inline: true)
            .WithImageUrl(song.Thumbnail)
            .WithCurrentTimestamp()
            .Build();
}
