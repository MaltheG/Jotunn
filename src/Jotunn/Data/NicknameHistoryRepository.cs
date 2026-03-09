using Dapper;

namespace Jotunn.Data;

public record NicknameHistoryRow(string Nickname, string Namer, DateTime Time);

public class NicknameHistoryRepository(DbConnectionFactory factory)
{
    public async Task AddAsync(ulong userId, string nickname, ulong namerId)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO history (userID, nickname, namer)
            VALUES (@UserId, @Nickname, @Namer)
            """,
            new { UserId = userId.ToString(), Nickname = nickname, Namer = namerId.ToString() });
    }

    public async Task<IEnumerable<NicknameHistoryRow>> GetAsync(ulong userId)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync<NicknameHistoryRow>("""
            SELECT nickname AS Nickname, namer AS Namer, time AS Time
            FROM history WHERE userID = @UserId
            ORDER BY time ASC
            """,
            new { UserId = userId.ToString() });
    }
}
