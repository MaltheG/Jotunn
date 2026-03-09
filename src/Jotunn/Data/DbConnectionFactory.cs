using MySqlConnector;

namespace Jotunn.Data;

public class DbConnectionFactory(string connectionString)
{
    public MySqlConnection CreateConnection() => new(connectionString);
}
