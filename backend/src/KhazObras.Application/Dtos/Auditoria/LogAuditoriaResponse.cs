namespace KhazObras.Application.Dtos.Auditoria;

public sealed record LogAuditoriaResponse(
    Guid Id,
    Guid? UserId,
    string Acao,
    string Entidade,
    Guid? EntidadeId,
    string? Detalhes,
    DateTime CreatedAt);