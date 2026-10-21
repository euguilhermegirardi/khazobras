using System.Net;
using System.Net.Http.Headers;
using System.Text;
using KhazObras.Domain.Enums;
using Xunit;

namespace KhazObras.Security.Tests.Http;

/// <summary>
/// Regra 6 do CLAUDE.md: cliente e somente leitura (unica escrita: aprovar medicao).
/// Regra 5: modulos internos = AdminOrMaster; usuarios e auditoria = MasterOnly.
/// Estes testes passam pelo pipeline HTTP real (ao contrario dos testes com fakes).
/// </summary>
public sealed class WriteEndpointsAuthorizationTests : IClassFixture<ApiFactory>
{
    private const string Id = "11111111-1111-1111-1111-111111111111";
    private readonly HttpClient _client;

    public WriteEndpointsAuthorizationTests(ApiFactory factory) => _client = factory.CreateApiClient();

    private async Task<HttpStatusCode> SendAsync(string method, string route, UserRole? role)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), route);
        if (method != "GET")
        {
            request.Content = IsUpload(route)
                ? MultipartBody()
                : new StringContent("{}", Encoding.UTF8, "application/json");
        }

        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value));
        }

        using var response = await _client.SendAsync(request);
        return response.StatusCode;
    }

    // Rotas com IFormFile so casam no roteamento com multipart (senao 415 antes da autorizacao).
    private static bool IsUpload(string route) =>
        route.EndsWith("/anexos") || route.EndsWith("/fotos") || route.EndsWith("/projetos");

    private static MultipartFormDataContent MultipartBody()
    {
        var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent([1, 2, 3]), "file", "teste.pdf");
        return content;
    }

    /// <summary>Rotas que exigem Admin ou Master (escrita de obra + modulos internos).</summary>
    public static TheoryData<string, string> RotasAdminOuMaster => new()
    {
        { "POST", "/obras" },
        { "POST", "/etapas" },
        { "POST", "/medicoes" },
        { "POST", $"/medicoes/{Id}/issue-invoice" },
        { "GET", $"/obras/{Id}/medicoes/resumo" },
        { "POST", "/contratos" },
        { "POST", $"/contratos/{Id}/pagamentos" },
        { "POST", "/financeiro/lancamentos" },
        { "POST", $"/financeiro/lancamentos/{Id}/anexos" },
        { "PATCH", $"/financeiro/lancamentos/{Id}/visibilidade" },
        { "GET", "/financeiro/categorias" },
        { "GET", $"/obras/{Id}/financeiro/resumo" },
        { "PUT", $"/financeiro/lancamentos/{Id}" },
        { "DELETE", $"/financeiro/lancamentos/{Id}" },
        { "PATCH", $"/obras/{Id}/financeiro/lancamentos/visibilidade" },
        { "DELETE", $"/financeiro/anexos/{Id}" },
        { "POST", "/relatorios-fotograficos" },
        { "POST", $"/relatorios-fotograficos/{Id}/fotos" },
        { "PUT", $"/relatorios-fotograficos/{Id}" },
        { "DELETE", $"/relatorios-fotograficos/{Id}" },
        { "PATCH", $"/relatorios-fotograficos/{Id}/fotos/ordem" },
        { "PATCH", $"/fotos/{Id}" },
        { "DELETE", $"/fotos/{Id}" },
        { "POST", "/relatorios-mensais" },
        { "POST", $"/obras/{Id}/projetos" },
        { "PUT", $"/projetos/{Id}" },
        { "DELETE", $"/projetos/{Id}" },
        { "POST", "/notificacoes" },
        { "POST", "/fornecedores" },
        { "GET", "/fornecedores" },
        { "GET", $"/fornecedores/{Id}" },
        { "POST", "/prestadores" },
        { "GET", $"/prestadores/{Id}" },
        { "GET", $"/obras/{Id}/prestadores" },
        { "POST", "/estoque/itens" },
        { "GET", $"/obras/{Id}/estoque/itens" },
        { "POST", $"/estoque/itens/{Id}/movimentacoes" },
        { "POST", "/pipeline" },
        { "GET", "/pipeline" },
    };

    /// <summary>Rotas exclusivas do Master.</summary>
    public static TheoryData<string, string> RotasSomenteMaster => new()
    {
        { "POST", "/users" },
        { "GET", "/users" },
        { "POST", $"/users/{Id}/obras/{Id}" },
        { "GET", $"/auditoria/obra/{Id}" },
    };

    /// <summary>Rotas de escrita cujo handler valida o corpo antes de tocar no banco (400 sem DB).</summary>
    public static TheoryData<string, string> RotasDeEscritaComValidacaoPrimeiro => new()
    {
        { "POST", "/obras" },
        { "POST", "/etapas" },
        { "POST", "/medicoes" },
        { "POST", "/contratos" },
        { "POST", "/financeiro/lancamentos" },
        { "POST", "/relatorios-fotograficos" },
        { "POST", "/relatorios-mensais" },
    };

    [Theory]
    [MemberData(nameof(RotasAdminOuMaster))]
    public async Task Cliente_nao_acessa_rotas_de_admin(string method, string route)
    {
        Assert.Equal(HttpStatusCode.Forbidden, await SendAsync(method, route, UserRole.Client));
    }

    [Theory]
    [MemberData(nameof(RotasSomenteMaster))]
    public async Task Cliente_nao_acessa_rotas_do_master(string method, string route)
    {
        Assert.Equal(HttpStatusCode.Forbidden, await SendAsync(method, route, UserRole.Client));
    }

    [Theory]
    [MemberData(nameof(RotasSomenteMaster))]
    public async Task Admin_nao_acessa_rotas_do_master(string method, string route)
    {
        Assert.Equal(HttpStatusCode.Forbidden, await SendAsync(method, route, UserRole.Admin));
    }

    [Theory]
    [InlineData("GET", "/obras")]
    [InlineData("POST", "/etapas")]
    [InlineData("GET", "/users")]
    [InlineData("GET", "/pipeline")]
    public async Task Sem_token_retorna_401(string method, string route)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, await SendAsync(method, route, role: null));
    }

    [Fact]
    public async Task Token_com_assinatura_invalida_retorna_401()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/obras");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(UserRole.Master) + "x");

        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// Controle positivo: garante que o teste nao passa "por acidente" (ex.: tudo devolvendo 403).
    /// Admin e Master passam da autorizacao nessas rotas; o corpo vazio {} e rejeitado pela validacao (400).
    /// </summary>
    [Theory]
    [MemberData(nameof(RotasDeEscritaComValidacaoPrimeiro))]
    public async Task Admin_e_master_passam_da_autorizacao_nas_rotas_de_escrita(string method, string route)
    {
        foreach (var role in new[] { UserRole.Admin, UserRole.Master })
        {
            var status = await SendAsync(method, route, role);

            Assert.Equal(HttpStatusCode.BadRequest, status);
        }
    }
}
