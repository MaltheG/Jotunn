using Discord.WebSocket;
using Jotunn.Data;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jotunn.Services;

/// <summary>
/// Every 10 minutes, pays 10 TOPS to every unmuted member in the configured voice channels.
/// </summary>
public class PayoutService(
    DiscordSocketClient discord,
    CasinoRepository casino,
    ILogger<PayoutService> logger) : BackgroundService
{
    private const int PayoutAmount = 10;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);

    // Guild → voice channel IDs that qualify for passive payout
    private static readonly Dictionary<ulong, ulong[]> CasinoGuilds = new()
    {
        [446227876652515339] = [446227876652515343],
        [504272240095920137] = [504940170961879043, 504272240599105538, 504940143409364998, 504940194399649802, 545603191585243138],
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(Interval, stoppingToken);
            await RunPayoutAsync();
        }
    }

    private async Task RunPayoutAsync()
    {
        logger.LogInformation("Payout time!");

        foreach (var (guildId, channelIds) in CasinoGuilds)
        {
            var guild = discord.GetGuild(guildId);
            if (guild == null) continue;

            foreach (var channelId in channelIds)
            {
                var channel = guild.GetVoiceChannel(channelId);
                if (channel == null) continue;

                foreach (var member in channel.ConnectedUsers)
                {
                    if (member.IsSelfMuted) continue;

                    try
                    {
                        await casino.PayMemberAsync(guildId, member.Id, PayoutAmount);
                        logger.LogDebug("Paid {Amount} TOPS to {User} in {Guild}", PayoutAmount, member.Id, guildId);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Failed to pay {User}", member.Id);
                    }
                }
            }
        }
    }
}
