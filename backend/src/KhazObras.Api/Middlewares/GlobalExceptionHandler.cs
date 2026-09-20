using Microsoft.AspNetCore.Diagnostics;

namespace KhazObras.Api.Middlewares;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var requestId = httpContext.TraceIdentifier;

        _logger.LogError(
            exception,
            "Erro nao tratado. RequestId: {RequestId}, Path: {Path}",
            requestId,
            httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/json";

        await httpContext.Response.WriteAsJsonAsync(
            new
            {
                requestId,
                message = "Erro inesperado. Consulte os logs com o requestId informado."
            },
            cancellationToken);

        return true;
    }
}