namespace KhazObras.Application.Dtos.Notificacoes;

public sealed record CreateNotificacaoRequest(
    Guid ObraId,
    Guid UserId,
    List<string> Modulos,
    string Canal);