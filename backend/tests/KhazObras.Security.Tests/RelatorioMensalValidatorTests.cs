using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Services;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>Regras de entrada do relatorio mensal ao cliente: validators (criar e editar) e normalizacao da competencia.</summary>
public sealed class RelatorioMensalValidatorTests
{
    private static readonly DateOnly Hoje = new(2026, 10, 21);

    [Fact]
    public async Task Create_valido_passa()
    {
        var request = new CreateRelatorioMensalRequest(Guid.NewGuid(), Hoje, "Obra no prazo.\nSem pendencias.");

        Assert.True((await new CreateRelatorioMensalRequestValidator().ValidateAsync(request)).IsValid);
    }

    [Fact]
    public async Task Create_sem_obra_ou_com_conteudo_nulo_e_invalido_sem_lancar_excecao()
    {
        var request = new CreateRelatorioMensalRequest(Guid.Empty, default, null!);

        var result = await new CreateRelatorioMensalRequestValidator().ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ObraId");
        Assert.Contains(result.Errors, e => e.PropertyName == "Competencia");
        Assert.Contains(result.Errors, e => e.PropertyName == "Conteudo");
    }

    [Fact]
    public async Task Update_valido_passa_e_nulo_e_invalido_sem_lancar_excecao()
    {
        var validator = new UpdateRelatorioMensalRequestValidator();

        Assert.True((await validator.ValidateAsync(new UpdateRelatorioMensalRequest(Hoje, "Texto novo"))).IsValid);

        var nulo = await validator.ValidateAsync(new UpdateRelatorioMensalRequest(Hoje, null!));
        Assert.False(nulo.IsValid);
        Assert.Contains(nulo.Errors, e => e.PropertyName == "Conteudo");
    }

    [Theory]
    [InlineData(1999, false)]
    [InlineData(2000, true)]
    [InlineData(2100, true)]
    [InlineData(2101, false)]
    public async Task Competencia_so_vale_entre_2000_e_2100(int ano, bool valida)
    {
        var result = await new UpdateRelatorioMensalRequestValidator()
            .ValidateAsync(new UpdateRelatorioMensalRequest(new DateOnly(ano, 6, 1), "texto"));

        Assert.Equal(valida, result.IsValid);
    }

    [Fact]
    public async Task Conteudo_respeita_o_limite_de_tamanho()
    {
        var validator = new UpdateRelatorioMensalRequestValidator();
        var noLimite = new string('x', RelatorioMensalRegras.MaxConteudo);

        Assert.True((await validator.ValidateAsync(new UpdateRelatorioMensalRequest(Hoje, noLimite))).IsValid);
        Assert.False((await validator.ValidateAsync(new UpdateRelatorioMensalRequest(Hoje, noLimite + "x"))).IsValid);
    }

    [Theory]
    [InlineData("linha 1\nlinha 2\r\n\ttabulado", true)]
    [InlineData("acentuacao e emoji ok", true)]
    [InlineData("<b>html</b> vira texto, nao e recusado", true)]
    [InlineData("nulo\u0000no meio", false)]
    [InlineData("sino\u0007", false)]
    [InlineData("disfarce‮exe.pdf", false)]
    [InlineData("isolado⁦x", false)]
    public async Task Conteudo_recusa_controle_e_direcao_do_texto_mas_aceita_quebra_de_linha(string conteudo, bool valido)
    {
        var result = await new UpdateRelatorioMensalRequestValidator()
            .ValidateAsync(new UpdateRelatorioMensalRequest(Hoje, conteudo));

        Assert.Equal(valido, result.IsValid);
    }

    [Theory]
    [InlineData(2026, 10, 1)]
    [InlineData(2026, 10, 17)]
    [InlineData(2026, 10, 31)]
    public void Competencia_sempre_vira_o_dia_1_do_mes(int ano, int mes, int dia)
    {
        Assert.Equal(new DateOnly(ano, mes, 1), RelatorioMensalRegras.NormalizarCompetencia(new DateOnly(ano, mes, dia)));
    }
}
