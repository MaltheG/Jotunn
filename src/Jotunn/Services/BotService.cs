using Discord;
using Discord.Interactions;
using Discord.WebSocket;
using Jotunn.Data;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Reflection;

namespace Jotunn.Services;

public class BotService(
    DiscordSocketClient client,
    InteractionService interactions,
    IServiceProvider services,
    DbSetup dbSetup,
    GuildQueueService queues,
    ILogger<BotService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Wire up event handlers before logging in
        client.Log += OnLog;
        client.Ready += OnReadyAsync;
        client.InteractionCreated += OnInteractionCreatedAsync;
        client.UserVoiceStateUpdated += OnVoiceStateUpdatedAsync;
        interactions.Log += OnLog;

        // Initialize database tables
        await dbSetup.InitializeAsync();

        // Load all interaction modules from this assembly
        await interactions.AddModulesAsync(Assembly.GetEntryAssembly(), services);

        // Log in and connect
        var token = Environment.GetEnvironmentVariable("JOTUNN_TOKEN")
            ?? throw new InvalidOperationException("JOTUNN_TOKEN environment variable is not set.");

        await client.LoginAsync(TokenType.Bot, token);
        await client.StartAsync();
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await client.StopAsync();
        await client.LogoutAsync();
    }

    private async Task OnReadyAsync()
    {
        logger.LogInformation("Bot ready as {User}", client.CurrentUser);

        // Register slash commands globally.
        // For faster iteration during development, swap to RegisterCommandsToGuildAsync(guildId).
        await interactions.RegisterCommandsGloballyAsync();
        logger.LogInformation("Slash commands registered globally.");
    }

    private async Task OnInteractionCreatedAsync(SocketInteraction interaction)
    {
        var ctx = new SocketInteractionContext(client, interaction);
        var result = await interactions.ExecuteCommandAsync(ctx, services);

        if (!result.IsSuccess)
        {
            logger.LogWarning("Interaction failed: {Error}", result.ErrorReason);
        }
    }

    /// <summary>
    /// Auto-disconnect if the bot is left alone in a voice channel for 5 seconds.
    /// Mirrors the original voiceStateUpdate handler in index.js.
    /// </summary>
    private Task OnVoiceStateUpdatedAsync(SocketUser user, SocketVoiceState oldState, SocketVoiceState newState)
    {
        // Only care about users leaving a channel (not joining or switching into a new one)
        if (oldState.VoiceChannel == null)
            return Task.CompletedTask;

        // The bot itself moving/leaving is not interesting here
        if (user.Id == client.CurrentUser.Id)
            return Task.CompletedTask;

        var botVoiceChannel = (oldState.VoiceChannel.Guild as SocketGuild)
            ?.CurrentUser.VoiceChannel;

        // Only react when the user left the bot's current channel
        if (botVoiceChannel == null || oldState.VoiceChannel.Id != botVoiceChannel.Id)
            return Task.CompletedTask;

        // If there is still at least one non-bot human in the channel, do nothing
        var humansRemaining = botVoiceChannel.ConnectedUsers
            .Count(u => !u.IsBot);

        if (humansRemaining > 0)
            return Task.CompletedTask;

        var guildId = oldState.VoiceChannel.Guild.Id;

        // Wait 5 seconds, then disconnect if still alone
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5));

            // Re-check: still alone?
            var stillAlone = botVoiceChannel.ConnectedUsers
                .Count(u => !u.IsBot) == 0;

            if (!stillAlone)
                return;

            logger.LogInformation("Left alone in voice — disconnecting from guild {GuildId}", guildId);

            var queue = queues.Get(guildId);
            if (queue != null)
            {
                queue.PlaybackCts?.Cancel();

                if (queue.AudioStream != null)
                    await queue.AudioStream.DisposeAsync();

                if (queue.AudioClient != null)
                    await queue.AudioClient.StopAsync();

                queues.Remove(guildId);
            }
        });

        return Task.CompletedTask;
    }

    private Task OnLog(LogMessage msg)
    {
        var level = msg.Severity switch
        {
            LogSeverity.Critical => LogLevel.Critical,
            LogSeverity.Error    => LogLevel.Error,
            LogSeverity.Warning  => LogLevel.Warning,
            LogSeverity.Info     => LogLevel.Information,
            LogSeverity.Verbose  => LogLevel.Debug,
            LogSeverity.Debug    => LogLevel.Trace,
            _                    => LogLevel.Information,
        };

        if (msg.Exception != null)
            logger.Log(level, msg.Exception, "[Discord] {Message}", msg.Message);
        else
            logger.Log(level, "[Discord] {Message}", msg.Message);

        return Task.CompletedTask;
    }
}
