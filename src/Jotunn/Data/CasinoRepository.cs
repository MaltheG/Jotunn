using Dapper;

namespace Jotunn.Data;

public record CasinoRow(string UserId, int Balance);

public class CasinoRepository(DbConnectionFactory factory)
{
    public async Task<int?> GetBalanceAsync(ulong guildId, ulong userId)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryFirstOrDefaultAsync<int?>(
            "SELECT balance FROM casino WHERE guildID = @GuildId AND userID = @UserId",
            new { GuildId = guildId.ToString(), UserId = userId.ToString() });
    }

    public async Task AddWinAsync(ulong guildId, ulong userId, int amount)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO casino (guildID, userID, balance, win)
            VALUES (@GuildId, @UserId, @Amount, @Amount)
            ON DUPLICATE KEY UPDATE balance = casino.balance + @Amount, win = casino.win + @Amount
            """,
            new { GuildId = guildId.ToString(), UserId = userId.ToString(), Amount = amount });
    }

    public async Task AddLossAsync(ulong guildId, ulong userId, int amount)
    {
        var abs = Math.Abs(amount);
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO casino (guildID, userID, balance, loss)
            VALUES (@GuildId, @UserId, @Neg, @Abs)
            ON DUPLICATE KEY UPDATE balance = casino.balance - @Abs, loss = casino.loss + @Abs
            """,
            new { GuildId = guildId.ToString(), UserId = userId.ToString(), Neg = -abs, Abs = abs });
    }

    public async Task TransferAsync(ulong guildId, ulong giverId, ulong receiverId, int amount)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();

        await conn.ExecuteAsync("""
            INSERT INTO casino (guildID, userID, balance, gifted)
            VALUES (@GuildId, @UserId, @Neg, @Amount)
            ON DUPLICATE KEY UPDATE balance = casino.balance - @Amount, gifted = casino.gifted + @Amount
            """,
            new { GuildId = guildId.ToString(), UserId = giverId.ToString(), Neg = -amount, Amount = amount },
            transaction: tx);

        await conn.ExecuteAsync("""
            INSERT INTO casino (guildID, userID, balance, received)
            VALUES (@GuildId, @UserId, @Amount, @Amount)
            ON DUPLICATE KEY UPDATE balance = casino.balance + @Amount, received = casino.received + @Amount
            """,
            new { GuildId = guildId.ToString(), UserId = receiverId.ToString(), Amount = amount },
            transaction: tx);

        await tx.CommitAsync();
    }

    public async Task PayMemberAsync(ulong guildId, ulong userId, int amount)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        await conn.ExecuteAsync("""
            INSERT INTO casino (guildID, userID, balance)
            VALUES (@GuildId, @UserId, @Amount)
            ON DUPLICATE KEY UPDATE balance = casino.balance + @Amount
            """,
            new { GuildId = guildId.ToString(), UserId = userId.ToString(), Amount = amount });
    }

    public async Task<IEnumerable<CasinoRow>> GetLeaderboardAsync(ulong guildId)
    {
        await using var conn = factory.CreateConnection();
        await conn.OpenAsync();
        return await conn.QueryAsync<CasinoRow>(
            "SELECT userID AS UserId, balance AS Balance FROM casino WHERE guildID = @GuildId ORDER BY balance DESC",
            new { GuildId = guildId.ToString() });
    }
}
