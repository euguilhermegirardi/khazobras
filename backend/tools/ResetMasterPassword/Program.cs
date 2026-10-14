// Redefine a senha de um usuario Master direto no Postgres.
// Uso (a partir de backend/):  dotnet run --project tools/ResetMasterPassword
// A senha e digitada no terminal (nao aparece na tela) e nunca e gravada em arquivo.
// Connection string: variavel ConnectionStrings__Postgres ou
// src/KhazObras.Api/appsettings.Development.json (gitignored).
using KhazObras.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Npgsql;

var apiDir = Path.GetFullPath(Path.Combine("src", "KhazObras.Api"));
var configuration = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

var connectionString = configuration.GetConnectionString("Postgres");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("Connection string 'Postgres' nao encontrada. Rode a partir da pasta backend/.");
    return 1;
}

await using var dataSource = NpgsqlDataSource.Create(connectionString);

var masters = new List<(Guid Id, string Email)>();
await using (var cmd = dataSource.CreateCommand("SELECT id, email FROM users WHERE role = 'master' ORDER BY created_at"))
await using (var reader = await cmd.ExecuteReaderAsync())
{
    while (await reader.ReadAsync())
    {
        masters.Add((reader.GetGuid(0), reader.GetString(1)));
    }
}

if (masters.Count == 0)
{
    Console.Error.WriteLine("Nenhum usuario Master encontrado.");
    return 1;
}

var target = masters[0];
if (args.Length > 0)
{
    var match = masters.FirstOrDefault(m => string.Equals(m.Email, args[0], StringComparison.OrdinalIgnoreCase));
    if (match.Email is null)
    {
        Console.Error.WriteLine("Masters existentes: " + string.Join(", ", masters.Select(m => m.Email)));
        return 1;
    }

    target = match;
}
else if (masters.Count > 1)
{
    Console.Error.WriteLine("Mais de um Master. Informe o e-mail: " + string.Join(", ", masters.Select(m => m.Email)));
    return 1;
}

Console.WriteLine($"Master: {target.Email}");
var password = ReadHidden("Nova senha (minimo 8 caracteres): ");
var confirm = ReadHidden("Repita a senha: ");

if (password != confirm)
{
    Console.Error.WriteLine("As senhas nao conferem.");
    return 1;
}

if (password.Length < 8)
{
    Console.Error.WriteLine("Senha curta demais.");
    return 1;
}

var hash = new PasswordHasherAdapter().Hash(password);

await using (var update = dataSource.CreateCommand(
    "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND role = 'master'"))
{
    update.Parameters.AddWithValue(hash);
    update.Parameters.AddWithValue(target.Id);
    var rows = await update.ExecuteNonQueryAsync();
    Console.WriteLine(rows == 1 ? "Senha redefinida." : "Nada foi alterado.");
    return rows == 1 ? 0 : 1;
}

static string ReadHidden(string prompt)
{
    Console.Write(prompt);
    var buffer = new System.Text.StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            return buffer.ToString();
        }

        if (key.Key == ConsoleKey.Backspace)
        {
            if (buffer.Length > 0)
            {
                buffer.Length--;
            }

            continue;
        }

        buffer.Append(key.KeyChar);
    }
}
