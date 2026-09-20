using System.Security.Claims;
using System.Text;
using Dapper;
using KhazObras.Api.Middlewares;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auth;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Services;
using KhazObras.Infrastructure.Persistence;
using KhazObras.Infrastructure.Repositories;
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

// Application services
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();

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
});

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthcheck", async (IDbConnectionFactory dbFactory) =>
{
    try
    {
        using var connection = dbFactory.CreateConnection();
        await connection.ExecuteScalarAsync<int>("SELECT 1");
        return Results.Ok(new { status = "healthy", database = "connected" });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500,
            title: "Banco de dados indisponível");
    }
})
.WithName("HealthCheck");

app.MapPost("/auth/login", async (LoginRequest request, AuthService authService) =>
{
    var result = await authService.LoginAsync(request);
    return result is null ? Results.Unauthorized() : Results.Ok(result);
})
.WithName("Login");

app.MapPost("/users", async (CreateUserRequest request, UserService userService, ClaimsPrincipal principal) =>
{
    var createdByUserId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var result = await userService.CreateAsync(request, createdByUserId);
    return Results.Created($"/users/{result.Id}", result);
})
.RequireAuthorization("MasterOnly")
.WithName("CreateUser");

app.MapGet("/users/me", async (ClaimsPrincipal principal, IUserRepository userRepository) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await userRepository.GetByIdAsync(userId);

    return user is null
        ? Results.NotFound()
        : Results.Ok(new UserResponse(user.Id, user.Name, user.Email, user.Role.ToString(), user.IsActive, user.CreatedAt));
})
.RequireAuthorization()
.WithName("GetMe");

app.MapPost("/dev/hash-password", (string password, IPasswordHasher hasher) =>
{
    return Results.Ok(new { hash = hasher.Hash(password) });
})
.WithName("DevHashPassword");

app.Run();