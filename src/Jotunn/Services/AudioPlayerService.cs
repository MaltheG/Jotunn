using System.Diagnostics;
using Discord;
using Discord.Audio;
using Jotunn.Data;
using Jotunn.Models;
using Microsoft.Extensions.Logging;

namespace Jotunn.Services;

/// <summary>
/// Handles audio playback for a guild by piping a direct stream URL through FFmpeg
/// into Discord's PCM audio pipeline.
/// </summary>
public class AudioPlayerService(
    GuildQueueService queues,
    YoutubeService youtube,
    SongHistoryRepository songHistory,
    ILogger<AudioPlayerService> logger)
{
    public async Task PlayNextAsync(ulong guildId)
    {
        var queue = queues.Get(guildId);
        if (queue == null) return;

        if (queue.Songs.Count == 0)
        {
            queue.Playing = false;
            return;
        }

        var song = queue.Songs[0];
        logger.LogInformation("Now playing: {Title}", song.Title);

        // Cancel any previous playback
        queue.PlaybackCts?.Cancel();
        queue.PlaybackCts?.Dispose();
        var cts = new CancellationTokenSource();
        queue.PlaybackCts = cts;

        queue.Playing = true;

        _ = Task.Run(async () =>
        {
            try
            {
                await StreamSongAsync(queue, song, cts.Token);
            }
            catch (OperationCanceledException)
            {
                logger.LogDebug("Playback cancelled for guild {GuildId}", guildId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Playback error for guild {GuildId}", guildId);
            }
            finally
            {
                if (!cts.Token.IsCancellationRequested)
                {
                    // Song finished naturally — advance the queue
                    if (!queue.Loop && queue.Songs.Count > 0)
                        queue.Songs.RemoveAt(0);

                    await PlayNextAsync(guildId);
                }
            }
        }, cts.Token);

        await songHistory.AddSongPlayAsync(song);
    }

    private async Task StreamSongAsync(GuildQueue queue, Song song, CancellationToken ct)
    {
        var streamUrl = await youtube.GetAudioStreamUrlAsync(song.Url);

        var ffmpeg = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-hide_banner -loglevel error " +
                            $"-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 " +
                            $"-i \"{streamUrl}\" " +
                            $"-ac 2 -f s16le -ar 48000 pipe:1",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            }
        };

        ffmpeg.Start();

        ffmpeg.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) logger.LogDebug("[FFmpeg] {Data}", e.Data);
        };
        ffmpeg.BeginErrorReadLine();

        var audioStream = queue.AudioStream
            ?? throw new InvalidOperationException("No audio stream available.");

        try
        {
            await ffmpeg.StandardOutput.BaseStream.CopyToAsync(audioStream, ct);
            await audioStream.FlushAsync(ct);
        }
        finally
        {
            if (!ffmpeg.HasExited)
            {
                ffmpeg.Kill();
            }
            ffmpeg.Dispose();
        }
    }

    public void Skip(ulong guildId)
    {
        var queue = queues.Get(guildId);
        if (queue == null) return;

        // Cancel current playback; PlayNextAsync will be called from the finally block
        if (queue.Songs.Count > 0)
            queue.Songs.RemoveAt(0);

        queue.PlaybackCts?.Cancel();
    }

    public void Pause(ulong guildId)
    {
        var queue = queues.Get(guildId);
        queue?.AudioClient?.SetSpeakingAsync(false);
        // Pausing isn't trivially supported with raw PCM streaming;
        // we cancel playback and keep the current song in the queue.
        queue?.PlaybackCts?.Cancel();
        if (queue != null) queue.Playing = false;
    }

    public async Task UnpauseAsync(ulong guildId)
    {
        var queue = queues.Get(guildId);
        if (queue == null || queue.Songs.Count == 0) return;
        await PlayNextAsync(guildId);
    }
}
