using Microsoft.AspNetCore.Mvc.Testing;

namespace KhazObras.Security.Tests.Http;

/// <summary>
/// Sobe a API real em memoria (pipeline completo: CORS, autenticacao, autorizacao).
/// Configuracao por variaveis de ambiente, que tem prioridade sobre appsettings*.json: assim o teste
/// nunca usa o banco, o R2 nem os segredos reais da maquina de quem roda. Os 403/401 sao decididos
/// pelo middleware de autorizacao, antes de qualquer handler, entao nenhuma conexao e aberta.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    // Valores FALSOS, exclusivos de teste.
    public const string JwtSecret = "segredo-falso-de-teste-com-mais-de-32-caracteres";
    public const string Issuer = "KhazObras";
    public const string Audience = "KhazObras";

    static ApiFactory()
    {
        Set("Jwt__Secret", JwtSecret);
        Set("Jwt__Issuer", Issuer);
        Set("Jwt__Audience", Audience);
        Set("ConnectionStrings__Postgres", "Host=127.0.0.1;Port=1;Database=teste;Username=teste;Password=teste;Timeout=1");
        Set("R2__AccessKey", "falso");
        Set("R2__SecretKey", "falso");
        Set("R2__Endpoint", "https://r2.invalid");
        Set("R2__BucketName", "falso");
        Set("Cors__AllowedOrigins__0", "http://localhost:5173");
    }

    private static void Set(string name, string value) => Environment.SetEnvironmentVariable(name, value);

    public HttpClient CreateApiClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
}
