using KhazObras.Application.Dtos.Notificacoes;
using KhazObras.Application.Dtos.Auditoria;
using KhazObras.Application.Dtos.Fornecedores;
using KhazObras.Application.Dtos.Prestadores;
using KhazObras.Application.Dtos.Estoque;
using KhazObras.Application.Dtos.Pipelines;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Dtos.Etapas;
using KhazObras.Infrastructure.Storage;
using FluentValidation;
using KhazObras.Application.Dtos.Obras;
using KhazObras.Infrastructure.Repositories;
using KhazObras.Application.Validators;
using System.Security.Claims;
using System.Text;
using Dapper;
using KhazObras.Api.Middlewares;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auth;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Services;
using KhazObras.Infrastructure.Persistence;
using KhazObras.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Persistencia
builder.Services.AddSingleton<IDbConnectionFactory, NpgsqlConnectionFactory>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// Seguranca
builder.Services.AddScoped<IPasswordHasher, PasswordHasherAdapter>();
builder.Services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
builder.Services.AddSingleton<IStorageService, R2StorageService>();

// Application services
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<IObraRepository, ObraRepository>();
builder.Services.AddScoped<ObraService>();
builder.Services.AddScoped<IEtapaRepository, EtapaRepository>();
builder.Services.AddScoped<EtapaService>();
builder.Services.AddScoped<IMedicaoRepository, MedicaoRepository>();
builder.Services.AddScoped<MedicaoService>();
builder.Services.AddScoped<IFinanceiroLancamentoRepository, FinanceiroLancamentoRepository>();
builder.Services.AddScoped<FinanceiroService>();
builder.Services.AddScoped<IRelatorioFotograficoRepository, RelatorioFotograficoRepository>();
builder.Services.AddScoped<RelatorioFotograficoService>();
builder.Services.AddScoped<IRelatorioMensalRepository, RelatorioMensalRepository>();
builder.Services.AddScoped<RelatorioMensalService>();
builder.Services.AddScoped<IProjetoDocumentoRepository, ProjetoDocumentoRepository>();
builder.Services.AddScoped<ProjetoDocumentoService>();
builder.Services.AddScoped<IFornecedorRepository, FornecedorRepository>();
builder.Services.AddScoped<FornecedorService>();
builder.Services.AddScoped<IPrestadorRepository, PrestadorRepository>();
builder.Services.AddScoped<PrestadorService>();
builder.Services.AddScoped<IEstoqueRepository, EstoqueRepository>();
builder.Services.AddScoped<EstoqueService>();
builder.Services.AddScoped<IPipelineRepository, PipelineRepository>();
builder.Services.AddScoped<PipelineService>();
builder.Services.AddScoped<INotificacaoRepository, NotificacaoRepository>();
builder.Services.AddScoped<NotificacaoService>();
builder.Services.AddScoped<ILogAuditoriaRepository, LogAuditoriaRepository>();
builder.Services.AddScoped<LogAuditoriaService>();
builder.Services.AddScoped<IUserObraRepository, UserObraRepository>();
builder.Services.AddScoped<ObraAccessService>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateObraRequestValidator>();

// Erro global
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Autenticacao JWT
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("MasterOnly", policy => policy.RequireRole("Master"));
    options.AddPolicy("AdminOrMaster", policy => policy.RequireRole("Admin", "Master"));
    // Aprovacao de medicao e ato do cliente (SPEC secao 5 item 4 e secao 8). Admin/Master nao aprovam no lugar dele.
    options.AddPolicy("ClientOnly", policy => policy.RequireRole("Client"));
});

// CORS: libera SOMENTE a(s) origem(ns) exata(s) do frontend. Nunca AllowAnyOrigin.
// Producao: Cors__AllowedOrigins__0=https://app.exemplo.com.br (variavel de ambiente).
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
{
    allowedOrigins = ["http://localhost:5173"];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .WithExposedHeaders("Content-Disposition"));
});

var app = builder.Build();

app.UseExceptionHandler();

app.MapOpenApi();

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthcheck", async (IDbConnectionFactory dbFactory, ILogger<Program> logger) =>
{
    try
    {
        using var connection = dbFactory.CreateConnection();
        await connection.ExecuteScalarAsync<int>("SELECT 1");
        return Results.Ok(new { status = "healthy", database = "connected" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Healthcheck falhou - banco de dados indisponivel");
        return Results.Problem(
            detail: "Banco de dados indisponivel.",
            statusCode: 500,
            title: "Servico indisponivel");
    }
})
.WithName("HealthCheck")
.WithDescription("Verifica a saúde da API e conectividade com o banco de dados");

app.MapPost("/auth/login", async (LoginRequest request, AuthService authService) =>
{
    var result = await authService.LoginAsync(request);
    return result is null ? Results.Unauthorized() : Results.Ok(result);
})
.WithName("Login")
.WithDescription("Autentica usuário e retorna JWT token com 8h de expiração");

app.MapPost("/users", async (CreateUserRequest request, IValidator<CreateUserRequest> validator, UserService userService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var createdByUserId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await userService.CreateAsync(request, createdByUserId);
    return Results.Created($"/users/{result.Id}", result);
})
.RequireAuthorization("MasterOnly")
.WithName("CreateUser")
.WithDescription("Cria novo usuário (somente Master). Roles: Master, Admin, Client");

app.MapGet("/users/me", async (ClaimsPrincipal principal, IUserRepository userRepository) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await userRepository.GetByIdAsync(userId);

    return user is null
        ? Results.NotFound()
        : Results.Ok(new UserResponse(user.Id, user.Name, user.Email, user.Role.ToString(), user.IsActive, user.CreatedAt));
})
.RequireAuthorization()
.WithName("GetMe")
.WithDescription("Retorna dados do usuário autenticado");

app.MapPost("/obras", async (CreateObraRequest request, IValidator<CreateObraRequest> validator, ObraService obraService) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var result = await obraService.CreateAsync(request);
    return Results.Created($"/obras/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateObra")
.WithDescription("Cria nova obra. Cliente vê apenas obras vinculadas ao seu login");

app.MapGet("/obras/{id:guid}", async (Guid id, ObraService obraService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, id);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await obraService.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObraById")
.WithDescription("Retorna detalhes de uma obra específica (acesso restrito por obra)");

app.MapGet("/obras", async (ObraService obraService, ObraAccessService accessService, IUserObraRepository userObraRepository, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20) =>
{
    if (!accessService.IsAdminOrMaster(principal))
    {
        var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var obraIds = await userObraRepository.GetObraIdsForUserAsync(userId);
        var obras = new List<KhazObras.Application.Dtos.Obras.ObraResponse>();

        foreach (var id in obraIds)
        {
            var obra = await obraService.GetByIdAsync(id);
            if (obra is not null)
            {
                obras.Add(obra);
            }
        }

        return Results.Ok(new { totalItems = obras.Count, pageIndex = 0, pageSize = obras.Count, items = obras });
    }

    var result = await obraService.GetPagedAsync(pageIndex, pageSize);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObras")
.WithDescription("Lista todas as obras (paginado). Clientes veem apenas suas obras");

app.MapPost("/etapas", async (CreateEtapaRequest request, IValidator<CreateEtapaRequest> validator, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.CreateAsync(request);
    return Results.Created($"/etapas/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateEtapa")
.WithDescription("Cria etapa (fase) em uma obra");

app.MapGet("/etapas/{id:guid}", async (Guid id, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await etapaService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapaById")
.WithDescription("Retorna detalhes de uma etapa específica");

app.MapGet("/obras/{obraId:guid}/etapas", async (Guid obraId, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapasByObra")
.WithDescription("Lista todas as etapas de uma obra");

app.MapPost("/medicoes", async (CreateMedicaoRequest request, IValidator<CreateMedicaoRequest> validator, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.CreateAsync(request);
    return Results.Created($"/medicoes/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateMedicao")
.WithDescription("Cria medição para uma obra. Estados: pending_approval → approved → invoice_issued");

app.MapGet("/medicoes/{id:guid}", async (Guid id, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await medicaoService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMedicaoById")
.WithDescription("Retorna detalhes de uma medição específica");

app.MapGet("/obras/{obraId:guid}/medicoes", async (Guid obraId, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMedicoesByObra")
.WithDescription("Lista todas as medições de uma obra");

app.MapPost("/medicoes/{id:guid}/approve", async (Guid id, ClaimsPrincipal principal, MedicaoService medicaoService, ObraAccessService accessService) =>
{
    var existing = await medicaoService.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, existing.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        var result = await medicaoService.ApproveAsync(id, userId);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization("ClientOnly")
.WithName("ApproveMedicao")
.WithDescription("Aprova medição (transição: pending_approval → approved). Somente o cliente da obra; Admin/Master recebem 403");

app.MapPost("/medicoes/{id:guid}/issue-invoice", async (Guid id, IssueInvoiceRequest request, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var existing = await medicaoService.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    try
    {
        var result = await medicaoService.IssueInvoiceAsync(id, request.NfNumber);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("IssueMedicaoInvoice")
.WithDescription("Emite nota fiscal para medição (transição: approved → invoice_issued). Somente Admin/Master");

app.MapPost("/financeiro/lancamentos", async (CreateFinanceiroLancamentoRequest request, IValidator<CreateFinanceiroLancamentoRequest> validator, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.CreateAsync(request, userId);
    return Results.Created($"/financeiro/lancamentos/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateFinanceiroLancamento")
.WithDescription("Cria lançamento financeiro (receita/despesa) em uma obra");

app.MapGet("/financeiro/lancamentos/{id:guid}", async (Guid id, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await financeiroService.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (accessService.IsAdminOrMaster(principal))
    {
        return Results.Ok(result);
    }

    // Cliente: so enxerga lancamentos liberados pelo admin, em DTO sem campos internos.
    var clienteView = financeiroService.ToClienteView(result);
    return clienteView is null ? Results.NotFound() : Results.Ok(clienteView);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentoById")
.WithDescription("Retorna um lançamento financeiro (cliente: somente os liberados, em visão reduzida)");

app.MapGet("/obras/{obraId:guid}/financeiro/lancamentos", async (Guid obraId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (accessService.IsAdminOrMaster(principal))
    {
        var adminResult = await financeiroService.GetPagedByObraIdAsync(obraId, pageIndex, pageSize);
        return Results.Ok(adminResult);
    }

    // Cliente: filtro por visibilidade aplicado no SQL; DTO sem campos internos.
    var clienteResult = await financeiroService.GetPagedParaClienteByObraIdAsync(obraId, pageIndex, pageSize);
    return Results.Ok(clienteResult);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentosByObra")
.WithDescription("Lista lançamentos financeiros de uma obra (paginado). Cliente: somente os liberados, em visão reduzida");

app.MapPatch("/financeiro/lancamentos/{id:guid}/visibilidade", async (Guid id, UpdateVisibilidadeLancamentoRequest request, FinanceiroService financeiroService) =>
{
    var result = await financeiroService.SetVisibilidadeClienteAsync(id, request.VisivelCliente);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateFinanceiroLancamentoVisibilidade")
.WithDescription("Libera ou oculta um lançamento financeiro para o cliente da obra (Admin/Master)");

app.MapPost("/financeiro/lancamentos/{id:guid}/anexos", async (Guid id, IFormFile file, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var lancamento = await financeiroService.GetByIdAsync(id);
    if (lancamento is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, lancamento.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await financeiroService.UploadAnexoAsync(id, stream, file.FileName, file.ContentType, file.Length);
    return Results.Created($"/financeiro/anexos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadFinanceiroAnexo")
.WithDescription("Anexa arquivo a um lançamento financeiro (máx 10MB, validado por magic bytes)");

app.MapGet("/financeiro/anexos/{anexoId:guid}/download", async (Guid anexoId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var owner = await financeiroService.ResolveAnexoAsync(anexoId);
    if (owner is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, owner.Value.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    // Cliente so baixa comprovante de lancamento que o admin liberou.
    if (!accessService.IsAdminOrMaster(principal) && !owner.Value.VisivelCliente)
    {
        return Results.NotFound();
    }

    var result = await financeiroService.DownloadAnexoAsync(anexoId);
    if (result is null)
    {
        return Results.NotFound();
    }

    var (content, fileName, contentType) = result.Value;
    return Results.File(content, contentType ?? "application/octet-stream", fileName);
})
.RequireAuthorization()
.WithName("DownloadFinanceiroAnexo")
.WithDescription("Baixa anexo de um lançamento financeiro (cliente: somente de lançamentos liberados da própria obra)");

app.MapGet("/relatorios-fotograficos/{id:guid}", async (Guid id, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioFotograficoById")
.WithDescription("Retorna detalhes de um relatório fotográfico");

app.MapPost("/relatorios-fotograficos", async (CreateRelatorioFotograficoRequest request, IValidator<CreateRelatorioFotograficoRequest> validator, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.CreateAsync(request);
    return Results.Created($"/relatorios-fotograficos/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateRelatorioFotografico")
.WithDescription("Cria novo relatório fotográfico para uma obra");

app.MapGet("/obras/{obraId:guid}/relatorios-fotograficos", async (Guid obraId, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosFotograficosByObra")
.WithDescription("Lista relatórios fotográficos de uma obra");

app.MapPost("/relatorios-fotograficos/{id:guid}/fotos", async (Guid id, IFormFile file, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, DateOnly? dataFoto, string? descricao, int ordem = 0) =>
{
    var relatorio = await service.GetByIdAsync(id);
    if (relatorio is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadFotoAsync(id, stream, file.FileName, file.ContentType, dataFoto, descricao, ordem);
    return Results.Created($"/fotos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadFoto")
.WithDescription("Adiciona foto a um relatório fotográfico (máx 10MB, validado por magic bytes)");

app.MapPost("/relatorios-mensais", async (CreateRelatorioMensalRequest request, IValidator<CreateRelatorioMensalRequest> validator, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.CreateAsync(request, userId);
    return Results.Created($"/relatorios-mensais/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateRelatorioMensal")
.WithDescription("Cria relatório mensal para uma obra. Estados: draft → published");

app.MapGet("/relatorios-mensais/{id:guid}", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        // Cliente: só publicados e sem ids internos (rascunho = 404).
        var visaoCliente = await service.GetPublishedByIdForClientAsync(id);
        return visaoCliente is null ? Results.NotFound() : Results.Ok(visaoCliente);
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioMensalById")
.WithDescription("Retorna detalhes de um relatório mensal");

app.MapGet("/obras/{obraId:guid}/relatorios-mensais", async (Guid obraId, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal, bool onlyPublished = false) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        // Cliente: ignora onlyPublished, sempre só publicados e sem ids internos.
        return Results.Ok(await service.GetPublishedByObraIdForClientAsync(obraId));
    }

    var result = await service.GetByObraIdAsync(obraId, onlyPublished);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosMensaisByObra")
.WithDescription("Lista relatórios mensais de uma obra (filtrável por status published)");

app.MapPost("/relatorios-mensais/{id:guid}/publish", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var existing = await service.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    try
    {
        var result = await service.PublishAsync(id);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("PublishRelatorioMensal")
.WithDescription("Publica relatório mensal (transição: draft → published). Somente Admin/Master");

app.MapPost("/obras/{obraId:guid}/projetos", async (Guid obraId, IFormFile file, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal, Guid? etapaId, string? tipoDocumento) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadAsync(obraId, etapaId, stream, file.FileName, file.ContentType, tipoDocumento);
    return Results.Created($"/projetos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadProjetoDocumento")
.WithDescription("Anexa documento/projeto a uma obra (máx 10MB, validado por magic bytes)");

app.MapGet("/projetos/{id:guid}/download", async (Guid id, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.DownloadAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    // Mesma limitacao do anexo financeiro: DownloadAsync ainda nao expoe ObraId.
    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    var (content, fileName, contentType) = result.Value;
    return Results.File(content, contentType ?? "application/octet-stream", fileName);
})
.RequireAuthorization()
.WithName("DownloadProjetoDocumento")
.WithDescription("Baixa documento/projeto (somente Admin/Master)");

app.MapGet("/obras/{obraId:guid}/projetos", async (Guid obraId, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetProjetosByObra")
.WithDescription("Lista documentos/projetos de uma obra");

app.MapPost("/fornecedores", async (CreateFornecedorRequest request, FornecedorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/fornecedores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateFornecedor")
.WithDescription("Cria fornecedor (módulo interno, sem escopo de obra)");

app.MapGet("/fornecedores/{id:guid}", async (Guid id, FornecedorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedorById")
.WithDescription("Retorna detalhes de um fornecedor");

app.MapGet("/fornecedores", async (FornecedorService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedores")
.WithDescription("Lista todos os fornecedores");

app.MapPost("/prestadores", async (CreatePrestadorRequest request, PrestadorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/prestadores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePrestador")
.WithDescription("Cria prestador de serviço (módulo interno, sem escopo de obra)");

app.MapGet("/prestadores/{id:guid}", async (Guid id, PrestadorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadorById")
.WithDescription("Retorna detalhes de um prestador");

app.MapGet("/obras/{obraId:guid}/prestadores", async (Guid obraId, PrestadorService service) =>
{
    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadoresByObra")
.WithDescription("Lista prestadores vinculados a uma obra");

app.MapPost("/estoque/itens", async (CreateEstoqueItemRequest request, EstoqueService service) =>
{
    var result = await service.CreateItemAsync(request);
    return Results.Created($"/estoque/itens/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateEstoqueItem")
.WithDescription("Cria item de estoque para uma obra");

app.MapGet("/obras/{obraId:guid}/estoque/itens", async (Guid obraId, EstoqueService service) =>
{
    var result = await service.GetItensByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetEstoqueItensByObra")
.WithDescription("Lista itens de estoque de uma obra");

app.MapPost("/estoque/itens/{itemId:guid}/movimentacoes", async (Guid itemId, CreateMovimentacaoRequest request, EstoqueService service) =>
{
    try
    {
        var result = await service.AddMovimentacaoAsync(itemId, request);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
})
.RequireAuthorization("AdminOrMaster")
.WithName("AddEstoqueMovimentacao")
.WithDescription("Registra movimentação (entrada/saída) de estoque");

app.MapPost("/pipeline", async (CreatePipelineRequest request, PipelineService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/pipeline/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePipeline")
.WithDescription("Cria etapa de pipeline para gestão de processos internos");

app.MapGet("/pipeline", async (PipelineService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPipeline")
.WithDescription("Lista todos os itens de pipeline");

app.MapPost("/notificacoes", async (CreateNotificacaoRequest request, NotificacaoService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/notificacoes/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateNotificacao")
.WithDescription("Cria notificação para módulo específico (email/WhatsApp - apenas base criada)");

app.MapGet("/notificacoes/minhas", async (ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var result = await service.GetByUserIdAsync(userId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMinhasNotificacoes")
.WithDescription("Lista notificações do usuário autenticado");

app.MapPost("/notificacoes/{id:guid}/marcar-lida", async (Guid id, ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        await service.MarkAsReadAsync(id, userId);
        return Results.NoContent();
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }
    catch (InvalidOperationException)
    {
        return Results.NotFound();
    }
})
.RequireAuthorization()
.WithName("MarkNotificacaoAsRead")
.WithDescription("Marca notificação como lida (IDOR prevention)");

app.MapGet("/auditoria/{entidade}/{entidadeId:guid}", async (string entidade, Guid entidadeId, LogAuditoriaService service) =>
{
    var result = await service.GetByEntidadeAsync(entidade, entidadeId);
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetAuditoriaByEntidade")
.WithDescription("Consulta log de auditoria por entidade (somente Master)");

app.MapPost("/users/{userId:guid}/obras/{obraId:guid}", async (Guid userId, Guid obraId, IUserObraRepository userObraRepository) =>
{
    await userObraRepository.LinkAsync(userId, obraId);
    return Results.NoContent();
})
.RequireAuthorization("MasterOnly")
.WithName("LinkUserToObra")
.WithDescription("Vincula usuário a uma obra (somente Master)");

app.MapGet("/users", async (IUserRepository userRepository) =>
{
    var users = await userRepository.GetAllAsync();
    var result = users.Select(u => new UserResponse(u.Id, u.Name, u.Email, u.Role.ToString(), u.IsActive, u.CreatedAt)).ToList();
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetUsers")
.WithDescription("Lista todos os usuários (somente Master)");

app.Run();

// Necessario para WebApplicationFactory<Program> nos testes de integracao HTTP.
public partial class Program { }
