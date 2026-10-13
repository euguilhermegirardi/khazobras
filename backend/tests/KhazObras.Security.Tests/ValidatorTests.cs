using FluentValidation;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Dtos.Obras;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Dtos.Etapas;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// Tests for FluentValidation rules across all key DTOs.
/// </summary>
public sealed class ValidatorTests
{
    #region CreateUserRequestValidator Tests

    private readonly CreateUserRequestValidator _userValidator = new();

    [Fact]
    public void CreateUserValidator_WithValidData_ShouldPass()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "john@example.com",
            Password: "SecurePass123",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateUserValidator_WithInvalidEmail_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "invalid-email",
            Password: "SecurePass123",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Email");
    }

    [Fact]
    public void CreateUserValidator_WithShortPassword_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "john@example.com",
            Password: "Short1",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Password");
    }

    [Fact]
    public void CreateUserValidator_WithPasswordMissingUppercase_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "john@example.com",
            Password: "lowercase1",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Password");
    }

    [Fact]
    public void CreateUserValidator_WithPasswordMissingNumber_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "john@example.com",
            Password: "NoNumber",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Password");
    }

    [Fact]
    public void CreateUserValidator_WithInvalidRole_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "John Doe",
            Email: "john@example.com",
            Password: "SecurePass123",
            Role: "invalid_role"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Role");
    }

    [Fact]
    public void CreateUserValidator_WithEmptyName_ShouldFail()
    {
        // Arrange
        var request = new CreateUserRequest(
            Name: "",
            Email: "john@example.com",
            Password: "SecurePass123",
            Role: "admin"
        );

        // Act
        var result = _userValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion

    #region CreateObraRequestValidator Tests

    private readonly CreateObraRequestValidator _obraValidator = new();

    [Fact]
    public void CreateObraValidator_WithValidData_ShouldPass()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateObraRequest(
            Nome: "Obra Test",
            Endereco: "Rua Test, 123",
            ValorContratado: 100000m,
            DataInicio: today,
            DataPrevisaoTermino: today.AddMonths(6)
        );

        // Act
        var result = _obraValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateObraValidator_WithEndDateBeforeStartDate_ShouldFail()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateObraRequest(
            Nome: "Obra Test",
            Endereco: "Rua Test, 123",
            ValorContratado: 100000m,
            DataInicio: today.AddMonths(6),
            DataPrevisaoTermino: today
        );

        // Act
        var result = _obraValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    [Fact]
    public void CreateObraValidator_WithNegativeValue_ShouldFail()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateObraRequest(
            Nome: "Obra Test",
            Endereco: "Rua Test, 123",
            ValorContratado: -100m,
            DataInicio: today,
            DataPrevisaoTermino: today.AddMonths(6)
        );

        // Act
        var result = _obraValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    [Fact]
    public void CreateObraValidator_WithEmptyNome_ShouldFail()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateObraRequest(
            Nome: "",
            Endereco: "Rua Test, 123",
            ValorContratado: 100000m,
            DataInicio: today,
            DataPrevisaoTermino: today.AddMonths(6)
        );

        // Act
        var result = _obraValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion

    #region CreateMedicaoRequestValidator Tests

    private readonly CreateMedicaoRequestValidator _medicaoValidator = new();

    [Fact]
    public void CreateMedicaoValidator_WithValidData_ShouldPass()
    {
        // Arrange
        var request = new CreateMedicaoRequest(
            ObraId: Guid.NewGuid(),
            EtapaId: Guid.NewGuid(),
            Numero: 1,
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Itens: new List<CreateMedicaoItemRequest>
            {
                new CreateMedicaoItemRequest(
                    Tipo: "mao_de_obra",
                    Descricao: "Mão de obra",
                    Quantidade: 10,
                    ValorUnitario: 500m
                )
            }
        );

        // Act
        var result = _medicaoValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateMedicaoValidator_WithEmptyItens_ShouldFail()
    {
        // Arrange
        var request = new CreateMedicaoRequest(
            ObraId: Guid.NewGuid(),
            EtapaId: Guid.NewGuid(),
            Numero: 1,
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Itens: new List<CreateMedicaoItemRequest>()
        );

        // Act
        var result = _medicaoValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    [Fact]
    public void CreateMedicaoValidator_WithNegativeValorUnitario_ShouldFail()
    {
        // Arrange
        var request = new CreateMedicaoRequest(
            ObraId: Guid.NewGuid(),
            EtapaId: Guid.NewGuid(),
            Numero: 1,
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Itens: new List<CreateMedicaoItemRequest>
            {
                new CreateMedicaoItemRequest(
                    Tipo: "mao_de_obra",
                    Descricao: "Mão de obra",
                    Quantidade: 10,
                    ValorUnitario: -500m
                )
            }
        );

        // Act
        var result = _medicaoValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    [Fact]
    public void CreateMedicaoValidator_WithZeroQuantidade_ShouldFail()
    {
        // Arrange
        var request = new CreateMedicaoRequest(
            ObraId: Guid.NewGuid(),
            EtapaId: Guid.NewGuid(),
            Numero: 1,
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Itens: new List<CreateMedicaoItemRequest>
            {
                new CreateMedicaoItemRequest(
                    Tipo: "mao_de_obra",
                    Descricao: "Mão de obra",
                    Quantidade: 0,
                    ValorUnitario: 500m
                )
            }
        );

        // Act
        var result = _medicaoValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion

    #region CreateFinanceiroLancamentoRequestValidator Tests

    private readonly CreateFinanceiroLancamentoRequestValidator _financeiroValidator = new();

    [Fact]
    public void CreateFinanceiroValidator_WithValidReceitaData_ShouldPass()
    {
        // Arrange
        var request = new CreateFinanceiroLancamentoRequest(
            ObraId: Guid.NewGuid(),
            Categoria: "material",
            Descricao: "Recebimento",
            Valor: 5000m,
            DataLancamento: DateOnly.FromDateTime(DateTime.UtcNow),
            MesCompetencia: DateOnly.FromDateTime(DateTime.UtcNow)
        );

        // Act
        var result = _financeiroValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateFinanceiroValidator_WithValidDespesaData_ShouldPass()
    {
        // Arrange
        var request = new CreateFinanceiroLancamentoRequest(
            ObraId: Guid.NewGuid(),
            Categoria: "mao_de_obra",
            Descricao: "Pagamento",
            Valor: 2000m,
            DataLancamento: DateOnly.FromDateTime(DateTime.UtcNow),
            MesCompetencia: DateOnly.FromDateTime(DateTime.UtcNow)
        );

        // Act
        var result = _financeiroValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateFinanceiroValidator_WithNegativeValor_ShouldFail()
    {
        // Arrange
        var request = new CreateFinanceiroLancamentoRequest(
            ObraId: Guid.NewGuid(),
            Categoria: "material",
            Descricao: "Recebimento",
            Valor: -5000m,
            DataLancamento: DateOnly.FromDateTime(DateTime.UtcNow),
            MesCompetencia: DateOnly.FromDateTime(DateTime.UtcNow)
        );

        // Act
        var result = _financeiroValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion

    #region CreateRelatorioMensalRequestValidator Tests

    private readonly CreateRelatorioMensalRequestValidator _relatorioMensalValidator = new();

    [Fact]
    public void CreateRelatorioMensalValidator_WithValidData_ShouldPass()
    {
        // Arrange
        var request = new CreateRelatorioMensalRequest(
            ObraId: Guid.NewGuid(),
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo: "Relatório de outubro"
        );

        // Act
        var result = _relatorioMensalValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateRelatorioMensalValidator_WithEmptyConteudo_ShouldFail()
    {
        // Arrange
        var request = new CreateRelatorioMensalRequest(
            ObraId: Guid.NewGuid(),
            Competencia: DateOnly.FromDateTime(DateTime.UtcNow),
            Conteudo: ""
        );

        // Act
        var result = _relatorioMensalValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion

    #region CreateEtapaRequestValidator Tests

    private readonly CreateEtapaRequestValidator _etapaValidator = new();

    [Fact]
    public void CreateEtapaValidator_WithValidData_ShouldPass()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateEtapaRequest(
            ObraId: Guid.NewGuid(),
            Nome: "Fundação",
            Ordem: 1,
            PercentualPeso: 25m,
            DataInicioPrevista: today,
            DataFimPrevista: today.AddDays(28)
        );

        // Act
        var result = _etapaValidator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateEtapaValidator_WithEndDateBeforeStartDate_ShouldFail()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateEtapaRequest(
            ObraId: Guid.NewGuid(),
            Nome: "Fundação",
            Ordem: 1,
            PercentualPeso: 25m,
            DataInicioPrevista: today.AddDays(28),
            DataFimPrevista: today
        );

        // Act
        var result = _etapaValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    [Fact]
    public void CreateEtapaValidator_WithEmptyNome_ShouldFail()
    {
        // Arrange
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = new CreateEtapaRequest(
            ObraId: Guid.NewGuid(),
            Nome: "",
            Ordem: 1,
            PercentualPeso: 25m,
            DataInicioPrevista: today,
            DataFimPrevista: today.AddDays(28)
        );

        // Act
        var result = _etapaValidator.Validate(request);

        // Assert
        Assert.False(result.IsValid);
    }

    #endregion
}
