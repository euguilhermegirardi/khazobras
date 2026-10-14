using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Corpo JSON incompleto (campo de texto ausente = null) deve virar erro de validacao (400),
/// nunca NullReferenceException (500). Achado pelos testes HTTP: POST /financeiro/lancamentos com {}.
/// </summary>
public sealed class ValidatorNullSafetyTests
{
    [Fact]
    public async Task Lancamento_sem_categoria_e_invalido_sem_lancar_excecao()
    {
        var request = new CreateFinanceiroLancamentoRequest(
            Guid.NewGuid(), null!, "Descricao", 10m,
            DateOnly.FromDateTime(DateTime.UtcNow), DateOnly.FromDateTime(DateTime.UtcNow));

        var result = await new CreateFinanceiroLancamentoRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Categoria");
    }

    [Fact]
    public async Task Item_de_medicao_sem_tipo_e_invalido_sem_lancar_excecao()
    {
        var request = new CreateMedicaoRequest(
            Guid.NewGuid(), null, 1, DateOnly.FromDateTime(DateTime.UtcNow),
            [new CreateMedicaoItemRequest(null!, "Item", 1m, 10m)]);

        var result = await new CreateMedicaoRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Relatorio_fotografico_sem_tipo_e_invalido_sem_lancar_excecao()
    {
        var request = new CreateRelatorioFotograficoRequest(Guid.NewGuid(), null!, null, "Titulo", null);

        var result = await new CreateRelatorioFotograficoRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Tipo");
    }

    [Fact]
    public async Task Usuario_sem_role_e_invalido_sem_lancar_excecao()
    {
        var request = new CreateUserRequest("Nome", "a@example.com", "SenhaForte1", null!);

        var result = await new CreateUserRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Role");
    }
}
