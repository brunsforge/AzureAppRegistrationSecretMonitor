using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services.DataProviders;

/// <summary>
/// Routes data requests to the AARM Azure Function REST endpoints.
/// Authenticated via Function Key stored in Windows Credential Manager.
/// </summary>
public class CloudHttpDataProvider : IDataProvider
{
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // Cloud HTTP calls produce no device-code prompts; event is a no-op.
    public event Action<string>? ProgressMessage { add { } remove { } }
    public bool IsCloudMode => true;

    public CloudHttpDataProvider(string baseUri, string functionKey)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(baseUri.TrimEnd('/') + "/api/"),
            Timeout = TimeSpan.FromSeconds(30),
        };
        _http.DefaultRequestHeaders.Add("x-functions-key", functionKey);
    }

    public async Task<IReadOnlyList<TenantProfile>> GetTenantsAsync()
    {
        var response = await _http.GetAsync("tenants");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        // Unknown fields (e.g. "environments") are silently ignored by System.Text.Json.
        return JsonSerializer.Deserialize<List<TenantProfile>>(json, JsonOptions)
               ?? new List<TenantProfile>();
    }

    public async Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null)
    {
        // Function returns AppRegistrationSummary[]; flatten to SecretSummary[] for the list page.
        var nested = await GetAppsAsync(tenantId, environmentName);
        if (nested is null) return null;
        var flat = nested.Data.SelectMany(a => a.Secrets).ToList();
        return new ResultEnvelope<List<SecretSummary>>(
            nested.Success, nested.Metadata, flat, nested.Warnings, nested.Errors);
    }

    public async Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null)
    {
        var env = environmentName ?? "default";
        return await GetAsync<List<AppRegistrationSummary>>(
            $"tenants/{tenantId}/environments/{env}/secrets");
    }

    public async Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null)
    {
        var env = environmentName ?? "default";
        return await GetAsync<PreflightResult>(
            $"tenants/{tenantId}/environments/{env}/preflight");
    }

    private async Task<ResultEnvelope<T>?> GetAsync<T>(string relativeUrl)
    {
        var response = await _http.GetAsync(relativeUrl);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<ResultEnvelope<T>>(json, JsonOptions);
    }
}
