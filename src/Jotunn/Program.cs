using Discord;
using Discord.Interactions;
using Discord.WebSocket;
using Jotunn.Data;
using Jotunn.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var token = Environment.GetEnvironmentVariable("JOTUNN_TOKEN")
    ?? throw new InvalidOperationException("JOTUNN_TOKEN environment variable is not set.");

var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set.");

// Support both mysql:// URI format and plain ADO.NET connection strings.
string dbConnectionString;
if (dbUrl.StartsWith("mysql://", StringComparison.OrdinalIgnoreCase))
{
    var uri = new Uri(dbUrl);
    var userInfo = uri.UserInfo.Split(':', 2);
    dbConnectionString = $"Server={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};User={userInfo[0]};Password={userInfo[1]};";
}
else
{
    dbConnectionString = dbUrl;
}

var host = Host.CreateDefaultBuilder(args)
    .ConfigureLogging(logging =>
    {
        logging.ClearProviders();
        logging.AddConsole();
        logging.SetMinimumLevel(LogLevel.Information);
    })
    .ConfigureServices(services =>
    {
        // Discord client
        var socketConfig = new DiscordSocketConfig
        {
            GatewayIntents = GatewayIntents.Guilds
                           | GatewayIntents.GuildMembers
                           | GatewayIntents.GuildVoiceStates,
            LogLevel = LogSeverity.Info,
            AlwaysDownloadUsers = false,
        };
        services.AddSingleton(socketConfig);
        services.AddSingleton<DiscordSocketClient>();

        // Interaction framework
        var interactionConfig = new InteractionServiceConfig
        {
            LogLevel = LogSeverity.Info,
            DefaultRunMode = RunMode.Async,
        };
        services.AddSingleton(interactionConfig);
        services.AddSingleton<InteractionService>(sp =>
            new InteractionService(sp.GetRequiredService<DiscordSocketClient>(), interactionConfig));

        // Database
        services.AddSingleton(new DbConnectionFactory(dbConnectionString));
        services.AddSingleton<DbSetup>();
        services.AddSingleton<SongHistoryRepository>();
        services.AddSingleton<NicknameHistoryRepository>();
        services.AddSingleton<CasinoRepository>();

        // Core services
        services.AddSingleton<GuildQueueService>();
        services.AddSingleton<YoutubeService>();
        services.AddSingleton<AudioPlayerService>();

        // Background services
        services.AddHostedService<PayoutService>();
        services.AddHostedService<BotService>();
    })
    .Build();

await host.RunAsync();
