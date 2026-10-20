namespace KhazObras.Application.Dtos.Medicoes;

/// <summary>
/// Visao do CLIENTE. Igual a <see cref="MedicaoResponse"/> sem <c>ApprovedByUserId</c> (id interno de usuario).
/// Os valores dos itens sao os medidos/contratados cobrados do cliente; custo real e margem nao existem
/// nas tabelas de medicao e nunca devem ser acrescentados aqui.
/// </summary>
public sealed record MedicaoClienteResponse(
    Guid Id,
    Guid ObraId,
    Guid? EtapaId,
    int Numero,
    DateOnly Competencia,
    decimal ValorTotal,
    string Status,
    DateTime? ApprovedAt,
    string? NfNumber,
    DateTime? NfIssuedAt,
    DateTime CreatedAt,
    List<MedicaoItemResponse> Itens);
