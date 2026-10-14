using System.Net;
using Xunit;

namespace KhazObras.Security.Tests.Http;

/// <summary>Regra 9: CORS libera so a origem exata do frontend. Nunca AllowAnyOrigin.</summary>
public sealed class CorsTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public CorsTests(ApiFactory factory) => _client = factory.CreateApiClient();

    private async Task<HttpResponseMessage> PreflightAsync(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/obras");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
        return await _client.SendAsync(request);
    }

    [Fact]
    public async Task Origem_do_frontend_e_permitida()
    {
        using var response = await PreflightAsync("http://localhost:5173");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:5173", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Theory]
    [InlineData("https://site-malicioso.example")]
    [InlineData("http://localhost:3000")]
    [InlineData("http://localhost:5173.evil.example")]
    public async Task Outras_origens_nao_recebem_permissao(string origin)
    {
        using var response = await PreflightAsync(origin);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Resposta_nunca_usa_curinga_de_origem()
    {
        using var response = await PreflightAsync("http://localhost:5173");

        Assert.DoesNotContain("*", response.Headers.GetValues("Access-Control-Allow-Origin"));
    }
}
