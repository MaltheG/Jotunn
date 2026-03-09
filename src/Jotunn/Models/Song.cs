namespace Jotunn.Models;

public record Song(
    string Title,
    string Url,
    string Id,
    string Duration,
    string Thumbnail,
    ulong GuildId,
    ulong AuthorId,
    int Position
);
