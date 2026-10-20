using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Services;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Security.Tests.Fakes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace KhazObras.Security.Tests.Http;

/// <summary>
/// Financeiro admin (tela "Financeiro - edicao completa"), pipeline HTTP real com repositorios em memoria:
/// lista admin x cliente + filtros, resumo (custo real: 403 ao cliente), PUT, DELETE, PATCH de visibilidade
/// (unico e em lote), anexos (limite, exclusao) e auditoria. Padrao de acesso: 404 -> 403 -> corpo 400.
/// </summary>
public sealed class FinanceiroAdminTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public FinanceiroAdminTests(ApiFactory factory) => _factory = factory;

    private sealed class CapturingStorageService : IStorageService
    {
        public List<string> Uploads { get; } = [];
        public List<string> Downloads { get; } = [];
        public List<string> Deletes { get; } = [];
        public bool FalharAoApagar { get; set; }

        public Task<string> UploadAsync(string key, Stream content, string contentType)
        {
            Uploads.Add(key);
            return Task.FromResult(key);
        }

        public Task<Stream> DownloadAsync(string key)
        {
            Downloads.Add(key);
            return Task.FromResult<Stream>(new MemoryStream());
        }

        public Task DeleteAsync(string key)
        {
            if (FalharAoApagar)
            {
                throw new InvalidOperationException("R2 indisponivel");
            }

            Deletes.Add(key);
            return Task.CompletedTask;
        }
    }

    private sealed record Cenario(
        HttpClient Client,
        FakeFinanceiroRepository Financeiro,
        FakeLogAuditoriaRepository Logs,
        CapturingStorageService Storage,
        Guid ObraId,
        Guid OutraObraId,
        Guid ClienteId,
        Guid OutroClienteId,
        Guid LiberadoId,
        Guid OcultoId,
        Guid DaOutraObraId,
        Guid AnexoLiberadoId);

    private static async Task<Guid> SeedAsync(
        FakeFinanceiroRepository financeiro, Guid obraId, bool visivel, ItemTipo categoria, decimal valor, DateOnly mes, string descricao = "Cimento")
    {
        var lancamento = await financeiro.CreateAsync(new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            Categoria = categoria,
            Descricao = descricao,
            Valor = valor,
            DataLancamento = mes.AddDays(9),
            MesCompetencia = mes,
            CreatedByUserId = Guid.NewGuid(),
            VisivelCliente = visivel,
            CreatedAt = DateTime.UtcNow
        });
        return lancamento.Id;
    }

    private static async Task<Guid> SeedAnexoAsync(FakeFinanceiroRepository financeiro, Guid lancamentoId, Guid obraId)
    {
        var anexo = await financeiro.AddAnexoAsync(new FinanceiroLancamentoAnexo
        {
            Id = Guid.NewGuid(),
            LancamentoId = lancamentoId,
            NomeArquivo = "nota-fiscal.pdf",
            StorageKey = $"obras/{obraId}/financeiro/{lancamentoId}/{Guid.NewGuid()}.pdf",
            ContentType = "application/pdf",
            TamanhoBytes = 10,
            UploadedAt = DateTime.UtcNow
        });
        return anexo.Id;
    }

    private async Task<Cenario> CriarCenarioAsync()
    {
        var financeiro = new FakeFinanceiroRepository();
        var vinculos = new FakeUserObraRepository();
        var obras = new FakeObraRepository();
        var logs = new FakeLogAuditoriaRepository();
        var storage = new CapturingStorageService();
        var obraId = Guid.NewGuid();
        var outraObraId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var outroClienteId = Guid.NewGuid();

        await vinculos.LinkAsync(clienteId, obraId);
        await vinculos.LinkAsync(outroClienteId, outraObraId);
        await obras.CreateAsync(new Obra { Id = obraId, Nome = "Obra A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await obras.CreateAsync(new Obra { Id = outraObraId, Nome = "Obra B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

        // Obra A: um liberado (material, set/2026, 1500) e um oculto (mao de obra, out/2026, 500,50). Obra B: um lancamento alheio.
        var liberado = await SeedAsync(financeiro, obraId, true, ItemTipo.Material, 1500m, new DateOnly(2026, 9, 1));
        var oculto = await SeedAsync(financeiro, obraId, false, ItemTipo.MaoDeObra, 500.50m, new DateOnly(2026, 10, 1), "Pedreiro");
        var daOutra = await SeedAsync(financeiro, outraObraId, false, ItemTipo.Equipamento, 9999m, new DateOnly(2026, 10, 1), "Alheio");
        var anexo = await SeedAnexoAsync(financeiro, liberado, obraId);

        var client = _factory
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<IFinanceiroLancamentoRepository>(financeiro);
                services.AddSingleton<IUserObraRepository>(vinculos);
                services.AddSingleton<IObraRepository>(obras);
                services.AddSingleton<ILogAuditoriaRepository>(logs);
                services.AddSingleton<IStorageService>(storage);
            }))
            .CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        return new Cenario(client, financeiro, logs, storage, obraId, outraObraId, clienteId, outroClienteId, liberado, oculto, daOutra, anexo);
    }

    private static async Task<HttpResponseMessage> SendAsync(
        Cenario c, HttpMethod method, string url, UserRole? role, Guid? userId = null, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> UploadAsync(Cenario c, Guid lancamentoId, UserRole? role, Guid? userId = null, string fileName = "comprovante.pdf")
    {
        using var body = new MultipartFormDataContent();
        var pdf = new ByteArrayContent("%PDF-1.4 conteudo"u8.ToArray());
        pdf.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(pdf, "file", fileName);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/financeiro/lancamentos/{lancamentoId}/anexos") { Content = body };
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.For(role.Value, userId));
        }

        return await c.Client.SendAsync(request);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static object CorpoEdicao(
        string categoria = "equipamento", string descricao = "Betoneira alugada", decimal valor = 2300.75m,
        string data = "2026-10-05", string mes = "2026-10-01", bool? visivelCliente = null, Guid? obraId = null) =>
        new { categoria, descricao, valor, dataLancamento = data, mesCompetencia = mes, visivelCliente, obraId };

    private static object CorpoCriacao(Guid obraId, string categoria = "material", string descricao = "Areia", decimal valor = 800m) =>
        new { obraId, categoria, descricao, valor, dataLancamento = "2026-10-12", mesCompetencia = "2026-10-01" };

    // ===== Lista: admin x cliente =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Lista_admin_traz_todos_os_lancamentos_com_dto_completo(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos", role);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, json.GetProperty("totalItems").GetInt32());
        var items = json.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());

        var ids = items.EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(c.LiberadoId, ids);
        Assert.Contains(c.OcultoId, ids);
        Assert.DoesNotContain(c.DaOutraObraId, ids);

        var oculto = items.EnumerateArray().Single(i => i.GetProperty("id").GetGuid() == c.OcultoId);
        Assert.False(oculto.GetProperty("visivelCliente").GetBoolean());
        Assert.True(oculto.TryGetProperty("createdByUserId", out _));
        Assert.True(oculto.TryGetProperty("createdAt", out _));
        Assert.Equal("MaoDeObra", oculto.GetProperty("categoria").GetString());
        Assert.Equal(500.50m, oculto.GetProperty("valor").GetDecimal());
        Assert.Equal("2026-10-10", oculto.GetProperty("dataLancamento").GetString());
        Assert.Equal("2026-10-01", oculto.GetProperty("mesCompetencia").GetString());

        var liberado = items.EnumerateArray().Single(i => i.GetProperty("id").GetGuid() == c.LiberadoId);
        Assert.True(liberado.GetProperty("visivelCliente").GetBoolean());
        var anexo = Assert.Single(liberado.GetProperty("anexos").EnumerateArray());
        Assert.Equal(c.AnexoLiberadoId, anexo.GetProperty("id").GetGuid());
        Assert.Equal("nota-fiscal.pdf", anexo.GetProperty("nomeArquivo").GetString());
        Assert.False(anexo.TryGetProperty("storageKey", out _));
    }

    [Fact]
    public async Task Lista_cliente_traz_so_os_liberados_no_dto_reduzido()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos", UserRole.Client, c.ClienteId);
        var texto = await response.Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(texto).RootElement;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, json.GetProperty("totalItems").GetInt32());
        Assert.Equal(c.LiberadoId, Assert.Single(json.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.DoesNotContain("visivelCliente", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("createdByUserId", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(c.OcultoId.ToString(), texto);
    }

    // ===== Lista: filtros do admin =====

    [Theory]
    [InlineData("visivelCliente=false", 1)]
    [InlineData("visivelCliente=true", 1)]
    [InlineData("visivelCliente=FALSE", 1)]
    [InlineData("categoria=mao_de_obra", 1)]
    [InlineData("categoria=MaoDeObra", 1)]
    [InlineData("categoria=equipamento", 0)]
    [InlineData("competencia=2026-09", 1)]
    [InlineData("competencia=2026-10", 1)]
    [InlineData("competencia=2026-11", 0)]
    [InlineData("visivelCliente=false&categoria=mao_de_obra&competencia=2026-10", 1)]
    [InlineData("visivelCliente=true&categoria=mao_de_obra", 0)]
    [InlineData("visivelCliente=&categoria=&competencia=", 2)]
    public async Task Filtros_do_admin_reduzem_a_lista_e_a_contagem(string query, int esperados)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?{query}", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(esperados, json.GetProperty("totalItems").GetInt32());
        Assert.Equal(esperados, json.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Filtro_por_visibilidade_devolve_o_lancamento_certo()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?visivelCliente=false", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(c.OcultoId, json.GetProperty("items")[0].GetProperty("id").GetGuid());
    }

    [Theory]
    [InlineData("visivelCliente=talvez")]
    [InlineData("categoria=servico")]
    [InlineData("competencia=2026-13")]
    [InlineData("competencia=2026-9")]
    [InlineData("competencia=2026-10-01")]
    [InlineData("competencia=1999-12")]
    public async Task Filtro_invalido_retorna_400_para_o_admin(string query)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?{query}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Cliente_nao_consegue_ver_oculto_nem_com_filtro()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?visivelCliente=false", UserRole.Client, c.ClienteId);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(c.LiberadoId, Assert.Single(json.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Cliente_de_outra_obra_recebe_403_antes_de_validar_filtros()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos?categoria=servico", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ===== Resumo (custo real: so admin) =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Resumo_admin_soma_so_a_obra_pedida(UserRole role)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/resumo", role);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2000.50m, json.GetProperty("totalLancado").GetDecimal());
        Assert.Equal(1500m, json.GetProperty("totalLiberadoCliente").GetDecimal());
        Assert.Equal(500.50m, json.GetProperty("totalNaoLiberado").GetDecimal());
        Assert.Equal(2, json.GetProperty("quantidadeLancamentos").GetInt32());
        Assert.Equal(1, json.GetProperty("quantidadeLiberada").GetInt32());
        Assert.Equal(1, json.GetProperty("quantidadeNaoLiberada").GetInt32());
    }

    [Fact]
    public async Task Resumo_de_obra_sem_lancamentos_devolve_zeros()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Get, $"/obras/{Guid.NewGuid()}/financeiro/resumo", UserRole.Admin);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0m, json.GetProperty("totalLancado").GetDecimal());
        Assert.Equal(0, json.GetProperty("quantidadeLancamentos").GetInt32());
    }

    [Fact]
    public async Task Resumo_nunca_chega_ao_cliente_nem_ao_da_propria_obra()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/resumo", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/resumo", UserRole.Client, c.OutroClienteId);
        using var anonimo = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/resumo", null);

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.DoesNotContain("totalLancado", await daObra.Content.ReadAsStringAsync());
    }

    // ===== Categorias =====

    [Fact]
    public async Task Categorias_listam_os_valores_aceitos_pelo_post_e_put_e_o_cliente_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var admin = await SendAsync(c, HttpMethod.Get, "/financeiro/categorias", UserRole.Admin);
        using var cliente = await SendAsync(c, HttpMethod.Get, "/financeiro/categorias", UserRole.Client, c.ClienteId);
        var json = await JsonAsync(admin);

        Assert.Equal(HttpStatusCode.OK, admin.StatusCode);
        Assert.Equal(
            new[] { "mao_de_obra", "material", "equipamento" },
            json.EnumerateArray().Select(i => i.GetProperty("valor").GetString()).ToArray());
        Assert.Equal("Mão de obra", json[0].GetProperty("rotulo").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, cliente.StatusCode);
    }

    // ===== Criacao =====

    [Fact]
    public async Task Admin_cria_lancamento_oculto_por_padrao()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Post, "/financeiro/lancamentos", UserRole.Admin, body: CorpoCriacao(c.ObraId));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.False(json.GetProperty("visivelCliente").GetBoolean());
        Assert.Equal("Material", json.GetProperty("categoria").GetString());
        Assert.Equal($"/financeiro/lancamentos/{json.GetProperty("id").GetGuid()}", response.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Criar_em_obra_inexistente_retorna_404_e_nada_e_gravado()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Financeiro.TotalLancamentos;

        using var response = await SendAsync(c, HttpMethod.Post, "/financeiro/lancamentos", UserRole.Admin, body: CorpoCriacao(Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(antes, c.Financeiro.TotalLancamentos);
    }

    [Fact]
    public async Task Cliente_nao_cria_lancamento_nem_com_corpo_invalido_e_recebe_403()
    {
        var c = await CriarCenarioAsync();
        var antes = c.Financeiro.TotalLancamentos;

        using var valido = await SendAsync(c, HttpMethod.Post, "/financeiro/lancamentos", UserRole.Client, c.ClienteId, CorpoCriacao(c.ObraId));
        using var invalido = await SendAsync(c, HttpMethod.Post, "/financeiro/lancamentos", UserRole.Client, c.ClienteId, CorpoCriacao(c.ObraId, valor: -1m));

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(antes, c.Financeiro.TotalLancamentos);
    }

    [Theory]
    [InlineData(0.001)]
    [InlineData(10.123)]
    [InlineData(1000000000000.00)]
    public async Task Criar_com_valor_fora_dos_limites_da_coluna_retorna_400(double valor)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Post, "/financeiro/lancamentos", UserRole.Admin, body: CorpoCriacao(c.ObraId, valor: (decimal)valor));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ===== PUT /financeiro/lancamentos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Put_edita_os_campos_audita_e_nao_troca_a_obra(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var autorOriginal = (await c.Financeiro.GetByIdAsync(c.LiberadoId))!.CreatedByUserId;

        // O JSON traz um obraId de outra obra: precisa ser ignorado.
        using var response = await SendAsync(
            c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", role, atorId, CorpoEdicao(obraId: c.OutraObraId));
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(c.LiberadoId, json.GetProperty("id").GetGuid());
        Assert.Equal(c.ObraId, json.GetProperty("obraId").GetGuid());
        Assert.Equal("Equipamento", json.GetProperty("categoria").GetString());
        Assert.Equal("Betoneira alugada", json.GetProperty("descricao").GetString());
        Assert.Equal(2300.75m, json.GetProperty("valor").GetDecimal());
        Assert.Equal("2026-10-05", json.GetProperty("dataLancamento").GetString());
        Assert.Equal("2026-10-01", json.GetProperty("mesCompetencia").GetString());
        Assert.True(json.GetProperty("visivelCliente").GetBoolean());
        Assert.Single(json.GetProperty("anexos").EnumerateArray());

        var salvo = (await c.Financeiro.GetByIdAsync(c.LiberadoId))!;
        Assert.Equal(c.ObraId, salvo.ObraId);
        Assert.Equal(autorOriginal, salvo.CreatedByUserId);
        Assert.Equal(ItemTipo.Equipamento, salvo.Categoria);
        Assert.Equal(2300.75m, salvo.Valor);
        Assert.Equal(new DateOnly(2026, 10, 5), salvo.DataLancamento);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("lancamento_editado", log.Acao);
        Assert.Equal("financeiro_lancamento", log.Entidade);
        Assert.Equal(c.LiberadoId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"campos\":[\"categoria\",\"descricao\",\"valor\",\"dataLancamento\",\"mesCompetencia\"]", log.Detalhes);
        // Payload minimo: ids e nomes de campos, nunca valores nem texto livre.
        Assert.DoesNotContain("Betoneira", log.Detalhes);
        Assert.DoesNotContain("2300.75", log.Detalhes);
        Assert.DoesNotContain("Cimento", log.Detalhes);
    }

    [Fact]
    public async Task Put_sem_visivelCliente_mantem_o_valor_e_com_visivelCliente_altera_e_audita()
    {
        var c = await CriarCenarioAsync();

        using var manteve = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{c.OcultoId}", UserRole.Admin, body: CorpoEdicao());
        Assert.Equal(HttpStatusCode.OK, manteve.StatusCode);
        Assert.False((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);

        using var liberou = await SendAsync(
            c, HttpMethod.Put, $"/financeiro/lancamentos/{c.OcultoId}", UserRole.Admin, body: CorpoEdicao(visivelCliente: true));
        Assert.Equal(HttpStatusCode.OK, liberou.StatusCode);
        Assert.True((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
        Assert.Contains("\"visivelCliente\"", c.Logs.Logs.Last().Detalhes);
    }

    [Fact]
    public async Task Put_sem_nenhuma_mudanca_responde_200_e_nao_audita()
    {
        var c = await CriarCenarioAsync();
        var atual = (await c.Financeiro.GetByIdAsync(c.LiberadoId))!;

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Admin,
            body: CorpoEdicao("material", atual.Descricao, atual.Valor, "2026-09-10", "2026-09-01"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_do_cliente_da_obra_recebe_403_mesmo_com_corpo_invalido_e_nada_muda()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.ClienteId, CorpoEdicao());
        using var invalido = await SendAsync(
            c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.ClienteId, CorpoEdicao(valor: 0m));

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.Equal(1500m, (await c.Financeiro.GetByIdAsync(c.LiberadoId))!.Valor);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_do_cliente_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.OutroClienteId, CorpoEdicao());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(1500m, (await c.Financeiro.GetByIdAsync(c.LiberadoId))!.Valor);
    }

    [Fact]
    public async Task Put_anonimo_recebe_401()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", null, body: CorpoEdicao());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Put_de_lancamento_inexistente_retorna_404_mesmo_com_corpo_invalido()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{Guid.NewGuid()}", UserRole.Admin, body: CorpoEdicao(valor: 0m));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    public static IEnumerable<object[]> CorposDeEdicaoInvalidos() =>
    [
        [CorpoEdicao(categoria: "servico")],
        [CorpoEdicao(categoria: "")],
        [CorpoEdicao(descricao: "")],
        [CorpoEdicao(descricao: "   ")],
        [CorpoEdicao(descricao: new string('x', 256))],
        [CorpoEdicao(valor: 0m)],
        [CorpoEdicao(valor: -5m)],
        [CorpoEdicao(valor: 10.123m)],
        [CorpoEdicao(valor: 1_000_000_000_000m)],
        [CorpoEdicao(data: "1999-12-31")],
        [CorpoEdicao(mes: "0001-01-01")]
    ];

    [Theory]
    [MemberData(nameof(CorposDeEdicaoInvalidos))]
    public async Task Put_com_corpo_invalido_retorna_400_com_errors_e_nada_muda(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Admin, body: corpo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(JsonValueKind.Object, json.GetProperty("errors").ValueKind);
        var salvo = (await c.Financeiro.GetByIdAsync(c.LiberadoId))!;
        Assert.Equal(1500m, salvo.Valor);
        Assert.Equal(ItemTipo.Material, salvo.Categoria);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Put_aceita_categoria_em_pascal_case_como_a_api_devolve()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Put, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Admin, body: CorpoEdicao(categoria: "MaoDeObra"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(ItemTipo.MaoDeObra, (await c.Financeiro.GetByIdAsync(c.LiberadoId))!.Categoria);
    }

    [Fact]
    public async Task Service_nao_edita_lancamento_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var resultado = await service.UpdateAsync(
            c.LiberadoId, c.OutraObraId,
            new KhazObras.Application.Dtos.Financeiro.UpdateFinanceiroLancamentoRequest(
                "equipamento", "Invasao", 1m, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 1)),
            Guid.NewGuid());

        Assert.Null(resultado);
        var salvo = (await c.Financeiro.GetByIdAsync(c.LiberadoId))!;
        Assert.Equal("Cimento", salvo.Descricao);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== DELETE /financeiro/lancamentos/{id} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Delete_remove_o_lancamento_apaga_os_anexos_do_storage_e_audita(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var chave = (await c.Financeiro.GetAnexoByIdAndObraAsync(c.AnexoLiberadoId, c.ObraId, false))!.StorageKey;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.LiberadoId}", role, atorId);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await c.Financeiro.GetByIdAsync(c.LiberadoId));
        Assert.Null(await c.Financeiro.GetObraIdByAnexoIdAsync(c.AnexoLiberadoId));
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("lancamento_excluido", log.Acao);
        Assert.Equal("financeiro_lancamento", log.Entidade);
        Assert.Equal(c.LiberadoId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"quantidadeAnexos\":1", log.Detalhes);
        Assert.DoesNotContain("Cimento", log.Detalhes);
    }

    [Fact]
    public async Task Delete_nao_toca_nos_lancamentos_vizinhos()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.OcultoId}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.DaOutraObraId));
        Assert.Empty(c.Storage.Deletes);
    }

    [Fact]
    public async Task Delete_responde_204_mesmo_se_o_storage_falhar_e_o_registro_ja_saiu()
    {
        var c = await CriarCenarioAsync();
        c.Storage.FalharAoApagar = true;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await c.Financeiro.GetByIdAsync(c.LiberadoId));
        Assert.Single(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_do_cliente_da_obra_recebe_403_e_nada_e_apagado()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_do_cliente_de_outra_obra_recebe_403()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.LiberadoId}", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));
    }

    [Fact]
    public async Task Delete_anonimo_recebe_401_e_inexistente_recebe_404()
    {
        var c = await CriarCenarioAsync();

        using var anonimo = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{c.LiberadoId}", null);
        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/financeiro/lancamentos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));
    }

    [Fact]
    public async Task Service_nao_exclui_lancamento_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var resultado = await service.DeleteAsync(c.LiberadoId, c.OutraObraId, Guid.NewGuid());

        Assert.Null(resultado);
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== PATCH de visibilidade (unico) =====

    [Fact]
    public async Task Patch_unico_audita_com_status_anterior_e_novo()
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.OcultoId}/visibilidade", UserRole.Admin, atorId, new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("lancamento_visibilidade_alterada", log.Acao);
        Assert.Equal("financeiro_lancamento", log.Entidade);
        Assert.Equal(c.OcultoId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"statusAnterior\":\"oculto\"", log.Detalhes);
        Assert.Contains("\"statusNovo\":\"liberado\"", log.Detalhes);
        Assert.DoesNotContain("Pedreiro", log.Detalhes);
    }

    [Fact]
    public async Task Patch_unico_sem_mudanca_de_valor_nao_audita()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.LiberadoId}/visibilidade", UserRole.Admin, body: new { visivelCliente = true });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Patch_unico_do_cliente_recebe_403_antes_de_validar_o_corpo()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/financeiro/lancamentos/{c.OcultoId}/visibilidade", UserRole.Client, c.ClienteId, new { visivelCliente = "talvez" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.False((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
        Assert.Empty(c.Logs.Logs);
    }

    // ===== PATCH de visibilidade em lote =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Lote_libera_varios_e_audita_so_os_que_mudaram(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();

        // O liberado ja estava liberado: conta como atualizado, mas nao gera registro de auditoria.
        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", role, atorId,
            new { ids = new[] { c.LiberadoId, c.OcultoId }, visivelCliente = true });
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, json.GetProperty("atualizados").GetInt32());
        Assert.True(json.GetProperty("visivelCliente").GetBoolean());
        Assert.True((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
        Assert.True((await c.Financeiro.GetByIdAsync(c.LiberadoId))!.VisivelCliente);

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("lancamento_visibilidade_alterada", log.Acao);
        Assert.Equal(c.OcultoId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains("\"lote\":true", log.Detalhes);
        Assert.Contains("\"statusAnterior\":\"oculto\"", log.Detalhes);
        Assert.Contains("\"statusNovo\":\"liberado\"", log.Detalhes);
    }

    [Fact]
    public async Task Lote_oculta_e_o_cliente_deixa_de_ver()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = new[] { c.LiberadoId }, visivelCliente = false });
        using var lista = await SendAsync(c, HttpMethod.Get, $"/obras/{c.ObraId}/financeiro/lancamentos", UserRole.Client, c.ClienteId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, (await JsonAsync(lista)).GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task Lote_com_id_repetido_conta_uma_vez()
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = new[] { c.OcultoId, c.OcultoId }, visivelCliente = true });
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, json.GetProperty("atualizados").GetInt32());
    }

    [Fact]
    public async Task Lote_com_id_de_outra_obra_ou_inexistente_retorna_o_mesmo_400_e_nao_altera_nenhum()
    {
        var c = await CriarCenarioAsync();

        using var deOutraObra = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = new[] { c.OcultoId, c.DaOutraObraId }, visivelCliente = true });
        using var inexistente = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = new[] { c.OcultoId, Guid.NewGuid() }, visivelCliente = true });
        var textoOutraObra = await deOutraObra.Content.ReadAsStringAsync();
        var errosOutraObra = JsonDocument.Parse(textoOutraObra).RootElement.GetProperty("errors").GetRawText();
        var errosInexistente = (await JsonAsync(inexistente)).GetProperty("errors").GetRawText();

        Assert.Equal(HttpStatusCode.BadRequest, deOutraObra.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, inexistente.StatusCode);
        // Mesmo erro: nao confirma que o id existe em outra obra.
        Assert.Equal(errosOutraObra, errosInexistente);
        Assert.Contains("Ids", textoOutraObra);
        Assert.DoesNotContain(c.DaOutraObraId.ToString(), textoOutraObra);

        Assert.False((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
        Assert.False((await c.Financeiro.GetByIdAsync(c.DaOutraObraId))!.VisivelCliente);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_do_cliente_recebe_403_antes_de_validar_o_corpo()
    {
        var c = await CriarCenarioAsync();

        using var valido = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Client, c.ClienteId,
            new { ids = new[] { c.OcultoId }, visivelCliente = true });
        using var invalido = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Client, c.ClienteId,
            new { ids = Array.Empty<Guid>(), visivelCliente = true });

        Assert.Equal(HttpStatusCode.Forbidden, valido.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, invalido.StatusCode);
        Assert.False((await c.Financeiro.GetByIdAsync(c.OcultoId))!.VisivelCliente);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_do_cliente_de_outra_obra_recebe_403_e_anonimo_401()
    {
        var c = await CriarCenarioAsync();
        var corpo = new { ids = new[] { c.OcultoId }, visivelCliente = true };

        using var outraObra = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Client, c.OutroClienteId, corpo);
        using var anonimo = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", null, body: corpo);

        Assert.Equal(HttpStatusCode.Forbidden, outraObra.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
    }

    public static IEnumerable<object[]> CorposDeLoteInvalidos() =>
    [
        [new { ids = Array.Empty<Guid>(), visivelCliente = true }],
        [new { ids = new[] { Guid.Empty }, visivelCliente = true }],
        [new { visivelCliente = true }]
    ];

    [Theory]
    [MemberData(nameof(CorposDeLoteInvalidos))]
    public async Task Lote_com_corpo_invalido_retorna_400_para_o_admin(object corpo)
    {
        var c = await CriarCenarioAsync();

        using var response = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin, body: corpo);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Lote_aceita_200_ids_e_recusa_201()
    {
        var c = await CriarCenarioAsync();
        var ids = new List<Guid>();
        for (var i = 0; i < 201; i++)
        {
            ids.Add(await SeedAsync(c.Financeiro, c.ObraId, false, ItemTipo.Material, 10m, new DateOnly(2026, 8, 1), $"Item {i}"));
        }

        using var duzentos = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = ids.Take(200).ToArray(), visivelCliente = true });
        using var duzentosEUm = await SendAsync(
            c, HttpMethod.Patch, $"/obras/{c.ObraId}/financeiro/lancamentos/visibilidade", UserRole.Admin,
            body: new { ids = ids.ToArray(), visivelCliente = true });

        Assert.Equal(HttpStatusCode.OK, duzentos.StatusCode);
        Assert.Equal(200, (await JsonAsync(duzentos)).GetProperty("atualizados").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, duzentosEUm.StatusCode);
        Assert.False((await c.Financeiro.GetByIdAsync(ids[200]))!.VisivelCliente);
    }

    // ===== Anexos: upload e limite =====

    [Fact]
    public async Task Upload_do_cliente_recebe_403_e_nada_vai_ao_storage()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await UploadAsync(c, c.LiberadoId, UserRole.Client, c.ClienteId);
        using var deOutra = await UploadAsync(c, c.LiberadoId, UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_em_lancamento_inexistente_retorna_404()
    {
        var c = await CriarCenarioAsync();

        using var response = await UploadAsync(c, Guid.NewGuid(), UserRole.Admin);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(c.Storage.Uploads);
    }

    [Fact]
    public async Task Upload_ate_o_limite_de_10_anexos_e_recusa_o_11o_com_400()
    {
        var c = await CriarCenarioAsync();
        // O lancamento liberado ja tem 1 anexo: sobem mais 9 (total 10) e o proximo estoura.
        for (var i = 0; i < 9; i++)
        {
            using var ok = await UploadAsync(c, c.LiberadoId, UserRole.Admin);
            Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        }

        using var excedeu = await UploadAsync(c, c.LiberadoId, UserRole.Admin);
        var json = await JsonAsync(excedeu);

        Assert.Equal(HttpStatusCode.BadRequest, excedeu.StatusCode);
        Assert.Contains("10", json.GetProperty("message").GetString());
        Assert.Equal(9, c.Storage.Uploads.Count);
        Assert.Equal(10, (await c.Financeiro.GetByIdAsync(c.LiberadoId))!.Anexos.Count);
    }

    [Fact]
    public async Task Upload_com_nome_de_arquivo_maior_que_255_retorna_400_sem_tocar_no_storage()
    {
        var c = await CriarCenarioAsync();
        var nomeLongo = new string('a', 252) + ".pdf"; // 256 caracteres

        using var response = await UploadAsync(c, c.LiberadoId, UserRole.Admin, fileName: nomeLongo);
        var json = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("255", json.GetProperty("message").GetString());
        Assert.Empty(c.Storage.Uploads);
        Assert.Single((await c.Financeiro.GetByIdAsync(c.LiberadoId))!.Anexos);
    }

    [Fact]
    public async Task Upload_com_nome_de_exatamente_255_caracteres_e_aceito()
    {
        var c = await CriarCenarioAsync();
        var nome = new string('a', 251) + ".pdf"; // 255 caracteres

        using var response = await UploadAsync(c, c.LiberadoId, UserRole.Admin, fileName: nome);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(c.Storage.Uploads);
    }

    [Fact]
    public async Task Service_remove_o_objeto_do_storage_se_o_banco_falhar_depois_do_upload()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        c.Financeiro.FalharAoAnexar = true;
        using var conteudo = new MemoryStream("%PDF-1.4"u8.ToArray());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UploadAnexoAsync(c.LiberadoId, c.ObraId, conteudo, "x.pdf", "application/pdf", 8));

        var chave = Assert.Single(c.Storage.Uploads);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
    }

    [Fact]
    public async Task Limite_de_anexos_e_por_lancamento()
    {
        var c = await CriarCenarioAsync();

        using var noOculto = await UploadAsync(c, c.OcultoId, UserRole.Admin);

        Assert.Equal(HttpStatusCode.Created, noOculto.StatusCode);
    }

    // ===== DELETE /financeiro/anexos/{anexoId} =====

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Master)]
    public async Task Delete_de_anexo_remove_do_banco_e_do_storage_e_audita(UserRole role)
    {
        var c = await CriarCenarioAsync();
        var atorId = Guid.NewGuid();
        var chave = (await c.Financeiro.GetAnexoByIdAndObraAsync(c.AnexoLiberadoId, c.ObraId, false))!.StorageKey;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{c.AnexoLiberadoId}", role, atorId);
        using var download = await SendAsync(c, HttpMethod.Get, $"/financeiro/anexos/{c.AnexoLiberadoId}/download", role);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
        Assert.Equal(new[] { chave }, c.Storage.Deletes.ToArray());
        Assert.NotNull(await c.Financeiro.GetByIdAsync(c.LiberadoId));

        var log = Assert.Single(c.Logs.Logs);
        Assert.Equal("lancamento_anexo_removido", log.Acao);
        Assert.Equal("financeiro_lancamento", log.Entidade);
        Assert.Equal(c.LiberadoId, log.EntidadeId);
        Assert.Equal(atorId, log.UserId);
        Assert.Contains(c.AnexoLiberadoId.ToString(), log.Detalhes);
        Assert.DoesNotContain("nota-fiscal", log.Detalhes);
    }

    [Fact]
    public async Task Delete_de_anexo_do_cliente_recebe_403_mesmo_de_lancamento_liberado()
    {
        var c = await CriarCenarioAsync();

        using var daObra = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{c.AnexoLiberadoId}", UserRole.Client, c.ClienteId);
        using var deOutra = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{c.AnexoLiberadoId}", UserRole.Client, c.OutroClienteId);

        Assert.Equal(HttpStatusCode.Forbidden, daObra.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deOutra.StatusCode);
        Assert.NotNull(await c.Financeiro.GetObraIdByAnexoIdAsync(c.AnexoLiberadoId));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Delete_de_anexo_anonimo_401_e_inexistente_404()
    {
        var c = await CriarCenarioAsync();

        using var anonimo = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{c.AnexoLiberadoId}", null);
        using var inexistente = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{Guid.NewGuid()}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.Unauthorized, anonimo.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
    }

    [Fact]
    public async Task Delete_de_anexo_responde_204_mesmo_se_o_storage_falhar()
    {
        var c = await CriarCenarioAsync();
        c.Storage.FalharAoApagar = true;

        using var response = await SendAsync(c, HttpMethod.Delete, $"/financeiro/anexos/{c.AnexoLiberadoId}", UserRole.Admin);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await c.Financeiro.GetObraIdByAnexoIdAsync(c.AnexoLiberadoId));
    }

    [Fact]
    public async Task Service_nao_remove_anexo_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);

        var resultado = await service.DeleteAnexoAsync(c.AnexoLiberadoId, c.OutraObraId, Guid.NewGuid());

        Assert.Null(resultado);
        Assert.NotNull(await c.Financeiro.GetObraIdByAnexoIdAsync(c.AnexoLiberadoId));
        Assert.Empty(c.Storage.Deletes);
        Assert.Empty(c.Logs.Logs);
    }

    [Fact]
    public async Task Service_nao_sobe_anexo_em_lancamento_de_outra_obra()
    {
        var c = await CriarCenarioAsync();
        var service = NovoService(c);
        using var conteudo = new MemoryStream("%PDF-1.4"u8.ToArray());

        var resultado = await service.UploadAnexoAsync(c.LiberadoId, c.OutraObraId, conteudo, "x.pdf", "application/pdf", 8);

        Assert.Equal(AnexoUploadStatus.LancamentoNaoEncontrado, resultado.Status);
        Assert.Empty(c.Storage.Uploads);
    }

    private static FinanceiroService NovoService(Cenario c) =>
        new(c.Financeiro, c.Storage, new FakeObraRepository(), new LogAuditoriaService(c.Logs));
}
