namespace KhazObras.Application.Dtos.Notificacoes;

public sealed record NotificacaoResponse(
    Guid Id,
    Guid ObraId,
    Guid UserId,
    List<string> Modulos,
    string Canal,
    DateTime EnviadoAt,
    DateTime? LidaAt);