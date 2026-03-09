using Dapper;
using Jotunn.Models;

namespace Jotunn.Data;

public record SongHistoryRow(string SongName, string SongUrl, int Requests, int Plays);

public class SongHistoryRepository(DbConnectionFactory factory)
{
    public async Task AddSongRequestAsync(Song song)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO songHistory (songName, songUrl, songID, guildID, userID, requests, plays)
            VALUES (@Title, @Url, @Id, @GuildId, @AuthorId, 1, 0)
            ON DUPLICATE KEY UPDATE requests = songHistory.requests + 1
            """,
            new { song.Title, song.Url, song.Id, GuildId = song.GuildId.ToString(), AuthorId = song.AuthorId.ToString() });
    }

    public async Task AddSongPlayAsync(Song song)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            UPDATE songHistory SET plays = plays + 1
            WHERE songID = @Id AND guildID = @GuildId AND userID = @AuthorId
            """,
            new { song.Id, GuildId = song.GuildId.ToString(), AuthorId = song.AuthorId.ToString() });
    }

    public async Task<(long Requests, long Plays)> GetSongStatsAsync(string songId, ulong guildId)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        var row = await conn.QueryFirstOrDefaultAsync("""
            SELECT SUM(requests) AS TotalRequests, SUM(plays) AS TotalPlays
            FROM songHistory WHERE songID = @SongId AND guildID = @GuildId
            """,
            new { SongId = songId, GuildId = guildId.ToString() });

        return ((long)(row?.TotalRequests ?? 0m), (long)(row?.TotalPlays ?? 0m));
    }

    public async Task<IEnumerable<SongHistoryRow>> GetUserHistoryAsync(ulong guildId, ulong userId, int limit = 10)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync<SongHistoryRow>("""
            SELECT songName AS SongName, songUrl AS SongUrl, requests AS Requests, plays AS Plays
            FROM songHistory WHERE guildID = @GuildId AND userID = @UserId
            ORDER BY requests DESC LIMIT @Limit
            """,
            new { GuildId = guildId.ToString(), UserId = userId.ToString(), Limit = limit });
    }

    public async Task<IEnumerable<SongHistoryRow>> GetGuildHistoryAsync(ulong guildId, int limit = 10)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync<SongHistoryRow>("""
            SELECT songName AS SongName, songUrl AS SongUrl,
                   SUM(requests) AS Requests, SUM(plays) AS Plays
            FROM songHistory WHERE guildID = @GuildId
            GROUP BY songName, songUrl
            ORDER BY Requests DESC LIMIT @Limit
            """,
            new { GuildId = guildId.ToString(), Limit = limit });
    }
}
