using System.Collections.Concurrent;
using Jotunn.Models;

namespace Jotunn.Services;

public class GuildQueueService
{
    private readonly ConcurrentDictionary<ulong, GuildQueue> _queues = new();

    public GuildQueue GetOrCreate(ulong guildId)
        => _queues.GetOrAdd(guildId, id => new GuildQueue { GuildId = id });

    public GuildQueue? Get(ulong guildId)
        => _queues.TryGetValue(guildId, out var q) ? q : null;

    public void Remove(ulong guildId)
        => _queues.TryRemove(guildId, out _);
}
