using System.Security.Claims;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Services;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Security.Tests.Fakes;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Regra: o cliente so enxerga lancamentos que o admin liberou (visivel_cliente), em DTO reduzido,
/// e so da propria obra. Nada interno (ex.: CreatedByUserId) chega ao cliente.
/// </summary>
public sealed class FinanceiroClienteVisibilidadeTests : IntegrationTestBase
{
    private readonly FinanceiroService _service;

    public FinanceiroClienteVisibilidadeTests()
    {
        _service = new FinanceiroService(FinanceiroRepository, new FakeStorageService());
    }

    private async Task<FinanceiroLancamento> SeedLancamentoAsync(Guid obraId, bool visivel, string descricao = "Cimento")
    {
        var lancamento = new FinanceiroLancamento
        {
            Id = Guid.NewGuid(),
            ObraId = obraId,
            Categoria = ItemTipo.Material,
            Descricao = descricao,
            Valor = 1500m,
            DataLancamento = DateOnly.FromDateTime(DateTime.UtcNow),
            MesCompetencia = DateOnly.FromDateTime(DateTime.UtcNow),
            CreatedByUserId = AdminUserId,
            VisivelCliente = visivel,
            CreatedAt = DateTime.UtcNow
        };

        await FinanceiroRepository.CreateAsync(lancamento);
        return lancamento;
    }

    private static ClaimsPrincipal Principal(string role, Guid userId) => new(new ClaimsIdentity(
        new Claim[]
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role)
        }, "test"));

    [Fact]
    public async Task Novo_lancamento_nasce_oculto_para_o_cliente()
    {
        var created = await _service.CreateAsync(
            new CreateFinanceiroLancamentoRequest(
                ObraId, "material", "Areia", 800m,
                DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow)),
            AdminUserId);

        Assert.False(created.VisivelCliente);
        Assert.Null(_service.ToClienteView(created));
    }

    [Fact]
    public async Task Lista_do_cliente_traz_apenas_lancamentos_liberados_e_a_contagem_respeita_o_filtro()
    {
        await SeedLancamentoAsync(ObraId, visivel: true, descricao: "Liberado");
        await SeedLancamentoAsync(ObraId, visivel: false, descricao: "Interno 1");
        await SeedLancamentoAsync(ObraId, visivel: false, descricao: "Interno 2");

        var cliente = await _service.GetPagedParaClienteByObraIdAsync(ObraId, 0, 20);
        var admin = await _service.GetPagedByObraIdAsync(ObraId, 0, 20);

        Assert.Equal(1, cliente.TotalItems);
        Assert.Equal("Liberado", Assert.Single(cliente.Items).Descricao);
        Assert.Equal(3, admin.TotalItems);
    }

    [Fact]
    public async Task Lista_do_cliente_nao_inclui_lancamentos_de_outra_obra()
    {
        var outraObra = Guid.NewGuid();
        await SeedLancamentoAsync(ObraId, visivel: true);
        await SeedLancamentoAsync(outraObra, visivel: true);

        var cliente = await _service.GetPagedParaClienteByObraIdAsync(ObraId, 0, 20);

        Assert.All(cliente.Items, i => Assert.Equal(ObraId, i.ObraId));
        Assert.Equal(1, cliente.TotalItems);
    }

    [Fact]
    public void Visao_do_cliente_nao_expoe_campos_internos()
    {
        var properties = typeof(FinanceiroLancamentoClienteResponse).GetProperties().Select(p => p.Name).ToList();

        Assert.DoesNotContain("CreatedByUserId", properties);
        Assert.DoesNotContain("VisivelCliente", properties);
        Assert.DoesNotContain("CreatedAt", properties);
    }

    [Fact]
    public async Task Detalhe_de_lancamento_oculto_nao_vira_visao_do_cliente()
    {
        var oculto = await SeedLancamentoAsync(ObraId, visivel: false);
        var liberado = await SeedLancamentoAsync(ObraId, visivel: true);

        var ocultoResponse = await _service.GetByIdAsync(oculto.Id);
        var liberadoResponse = await _service.GetByIdAsync(liberado.Id);

        Assert.Null(_service.ToClienteView(ocultoResponse!));
        Assert.NotNull(_service.ToClienteView(liberadoResponse!));
    }

    [Fact]
    public async Task Admin_pode_liberar_e_ocultar_um_lancamento()
    {
        var lancamento = await SeedLancamentoAsync(ObraId, visivel: false);

        var liberado = await _service.SetVisibilidadeClienteAsync(lancamento.Id, true);
        Assert.True(liberado!.VisivelCliente);
        Assert.Single((await _service.GetPagedParaClienteByObraIdAsync(ObraId, 0, 20)).Items);

        var oculto = await _service.SetVisibilidadeClienteAsync(lancamento.Id, false);
        Assert.False(oculto!.VisivelCliente);
        Assert.Empty((await _service.GetPagedParaClienteByObraIdAsync(ObraId, 0, 20)).Items);
    }

    [Fact]
    public async Task Alterar_visibilidade_de_lancamento_inexistente_retorna_null()
    {
        Assert.Null(await _service.SetVisibilidadeClienteAsync(Guid.NewGuid(), true));
    }

    [Fact]
    public async Task Resolve_anexo_informa_obra_e_visibilidade_do_lancamento_dono()
    {
        var lancamento = await SeedLancamentoAsync(ObraId, visivel: true);
        var anexo = await FinanceiroRepository.AddAnexoAsync(new FinanceiroLancamentoAnexo
        {
            Id = Guid.NewGuid(),
            LancamentoId = lancamento.Id,
            NomeArquivo = "nf.pdf",
            StorageKey = "k",
            UploadedAt = DateTime.UtcNow
        });

        var owner = await _service.ResolveAnexoAsync(anexo.Id);

        Assert.NotNull(owner);
        Assert.Equal(ObraId, owner.Value.ObraId);
        Assert.True(owner.Value.VisivelCliente);
        Assert.Null(await _service.ResolveAnexoAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Cliente_de_outra_obra_nao_passa_no_acesso_ao_anexo()
    {
        await UserObraRepository.LinkAsync(ClientUserId, ObraId);
        var lancamento = await SeedLancamentoAsync(ObraId, visivel: true);
        var anexo = await FinanceiroRepository.AddAnexoAsync(new FinanceiroLancamentoAnexo
        {
            Id = Guid.NewGuid(),
            LancamentoId = lancamento.Id,
            NomeArquivo = "nf.pdf",
            StorageKey = "k",
            UploadedAt = DateTime.UtcNow
        });
        var owner = await _service.ResolveAnexoAsync(anexo.Id);

        await ObraAccessService.EnsureAccessAsync(Principal("Client", ClientUserId), owner!.Value.ObraId);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            ObraAccessService.EnsureAccessAsync(Principal("Client", AnotherClientUserId), owner.Value.ObraId));
    }
}
