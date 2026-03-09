using Discord.Audio;

namespace Jotunn.Models;

public class GuildQueue
{
    public ulong GuildId { get; init; }
    public List<Song> Songs { get; } = [];
    public bool Playing { get; set; }
    public bool Loop { get; set; }
    public IAudioClient? AudioClient { get; set; }
    public AudioOutStream? AudioStream { get; set; }
    public CancellationTokenSource? PlaybackCts { get; set; }
}
