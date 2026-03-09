using Jotunn.Models;
using YoutubeExplode;
using YoutubeExplode.Common;
using YoutubeExplode.Playlists;
using YoutubeExplode.Videos;
using YoutubeExplode.Videos.Streams;

namespace Jotunn.Services;

public enum SongResultType { Video, Playlist }

public record SongResult(SongResultType Type, IReadOnlyList<Song> Songs);

public class YoutubeService
{
    private readonly YoutubeClient _youtube = new();

    public async Task<SongResult> ResolveAsync(string query, ulong guildId, ulong authorId)
    {
        // YouTube video URL
        if (VideoId.TryParse(query) is { } videoId)
        {
            var video = await _youtube.Videos.GetAsync(videoId);
            return new SongResult(SongResultType.Video, [ToSong(video, guildId, authorId, 0)]);
        }

        // YouTube playlist URL
        if (PlaylistId.TryParse(query) is { } playlistId)
        {
            var videos = await _youtube.Playlists.GetVideosAsync(playlistId);
            var songs = videos
                .Select((v, i) => ToSong(v, guildId, authorId, i))
                .ToList();
            return new SongResult(SongResultType.Playlist, songs);
        }

        // Text search
        var results = await _youtube.Search.GetVideosAsync(query).CollectAsync(1);
        if (results.Count == 0)
            throw new InvalidOperationException("No results found for query.");

        return new SongResult(SongResultType.Video, [ToSong(results[0], guildId, authorId, 0)]);
    }

    /// <summary>
    /// Gets the best audio stream URL for a video.
    /// Falls back to muxed streams if no audio-only stream is available.
    /// </summary>
    public async Task<string> GetAudioStreamUrlAsync(string videoUrl)
    {
        var videoId = VideoId.Parse(videoUrl);
        var manifest = await _youtube.Videos.Streams.GetManifestAsync(videoId);

        // Prefer audio-only streams (webm/opus or mp4/aac), sorted by bitrate descending
        var audioStream = manifest
            .GetAudioOnlyStreams()
            .OrderByDescending(s => s.Bitrate)
            .FirstOrDefault();

        if (audioStream != null)
            return audioStream.Url;

        // Fall back to muxed stream with best quality
        var muxedStream = manifest
            .GetMuxedStreams()
            .OrderByDescending(s => s.VideoQuality)
            .FirstOrDefault()
            ?? throw new InvalidOperationException($"No playable streams found for video: {videoUrl}");

        return muxedStream.Url;
    }

    private static Song ToSong(IVideo video, ulong guildId, ulong authorId, int position)
    {
        var duration = video.Duration.HasValue
            ? video.Duration.Value.ToString(@"h\:mm\:ss").TrimStart('0').TrimStart(':')
            : "Live";

        var thumbnail = $"https://img.youtube.com/vi/{video.Id}/mqdefault.jpg";

        return new Song(
            Title: video.Title,
            Url: video.Url,
            Id: video.Id,
            Duration: duration,
            Thumbnail: thumbnail,
            GuildId: guildId,
            AuthorId: authorId,
            Position: position
        );
    }
}
