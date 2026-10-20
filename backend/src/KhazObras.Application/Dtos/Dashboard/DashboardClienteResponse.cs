namespace KhazObras.Application.Dtos.Dashboard;

/// <summary>
/// Dashboard do CLIENTE (SPEC secao 5, item 2). DTO unico para qualquer papel com acesso a obra: so valores
/// contratados e medicoes aprovadas (regra 7 do CLAUDE.md). Sem custo real, margem, peso das etapas, lancamentos
/// do financeiro, chaves de storage nem ids de usuario.
/// </summary>
public sealed record DashboardClienteResponse(
    DashboardObraResponse Obra,
    decimal AvancoFisicoPercentual,
    DashboardPrazoResponse Prazo,
    DashboardValoresResponse Valores,
    IReadOnlyList<DashboardEtapaResponse> AvancoPorEtapa,
    IReadOnlyList<DashboardMedidoMesResponse> MedidoPorMes);

public sealed record DashboardObraResponse(
    Guid Id,
    string Nome,
    DateOnly? DataInicio,
    DateOnly? DataPrevisaoTermino,
    string Status);

/// <summary>DiasRestantes negativo = atrasado; null quando a obra nao tem data de previsao de termino.</summary>
public sealed record DashboardPrazoResponse(int? DiasRestantes, DateOnly? DataPrevisaoTermino);

/// <summary>
/// ValorMedidoAcumulado = soma das medicoes approved/invoice_issued (o que o cliente ja aprovou; e o "Custo acumulado"
/// da tela do cliente). ValorRestante = ValorContratado - ValorMedidoAcumulado e pode ser negativo.
/// </summary>
public sealed record DashboardValoresResponse(
    decimal ValorContratado,
    decimal ValorMedidoAcumulado,
    decimal ValorRestante,
    decimal TotalPago);

public sealed record DashboardEtapaResponse(
    Guid EtapaId,
    string Nome,
    int Ordem,
    decimal PercentualConcluido,
    string Status,
    DateOnly? DataInicioPrevista,
    DateOnly? DataFimPrevista);

/// <summary>Competencia = primeiro dia do mes. So meses com medicao aprovada; acumulado corrido ate o mes.</summary>
public sealed record DashboardMedidoMesResponse(
    DateOnly Competencia,
    decimal ValorMedido,
    decimal ValorMedidoAcumulado);
