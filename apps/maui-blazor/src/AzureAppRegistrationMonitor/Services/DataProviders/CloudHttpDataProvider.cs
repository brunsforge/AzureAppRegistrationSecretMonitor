using System.Net;
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
        await EnsureSuccessAsync(response);
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<TenantProfile>>(json, JsonOptions)
               ?? new List<TenantProfile>();
    }

    public async Task<ResultEnvelope<List<SecretSummary>>?> GetSecretsAsync(
        string tenantId, string? environmentName = null)
    {
        var nested = await GetAppsAsync(tenantId, environmentName);
        if (nested is null) return null;
        var flat = nested.Data.SelectMany(a => a.Secrets).ToList();
        return new ResultEnvelope<List<SecretSummary>>(
            nested.Success, nested.Metadata, flat, nested.Warnings, nested.Errors);
    }

    public async Task<ResultEnvelope<List<AppRegistrationSummary>>?> GetAppsAsync(
        string tenantId, string? environmentName = null)
        => await GetAsync<List<AppRegistrationSummary>>($"tenants/{tenantId}/secrets");

    public async Task<ResultEnvelope<PreflightResult>?> GetPreflightAsync(
        string tenantId, string? environmentName = null)
        => await GetAsync<PreflightResult>($"tenants/{tenantId}/preflight");

    public async Task<bool> TriggerScanAsync(string tenantId)
    {
        var response = await _http.PostAsync($"tenants/{tenantId}/scan", null);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new InvalidOperationException(
                $"Tenant {tenantId} is not configured in the Azure Function (no job in jobs.json). " +
                "Run setup-tenant.ps1 first.");
        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
            throw new InvalidOperationException("Function key invalid or expired. Check Settings.");
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"HTTP {(int)response.StatusCode}: {body}");
        }
        return response.StatusCode == HttpStatusCode.Accepted;
    }

    public async Task<TenantProfile?> AddTenantAsync(CloudTenantRequest request)
    {
        var content = Serialize(request);
        var response = await _http.PostAsync("tenants", content);
        await EnsureSuccessAsync(response);
        return JsonSerializer.Deserialize<TenantProfile>(
            await response.Content.ReadAsStringAsync(), JsonOptions);
    }

    public async Task<TenantProfile?> UpdateTenantAsync(string tenantId, CloudTenantRequest request)
    {
        var content = Serialize(request);
        var response = await _http.PutAsync($"tenants/{tenantId}", content);
        await EnsureSuccessAsync(response);
        return JsonSerializer.Deserialize<TenantProfile>(
            await response.Content.ReadAsStringAsync(), JsonOptions);
    }

    public async Task<bool> DeleteTenantAsync(string tenantId)
    {
        var response = await _http.DeleteAsync($"tenants/{tenantId}");
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<ScanHistoryEntry>> GetHistoryAsync(string tenantId, int maxEntries = 60)
    {
        var response = await _http.GetAsync($"tenants/{tenantId}/history?limit={maxEntries}");
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return Array.Empty<ScanHistoryEntry>();
        await EnsureSuccessAsync(response);
        var json = await response.Content.ReadAsStringAsync();
        var items = JsonSerializer.Deserialize<List<CloudHistorySummary>>(json, JsonOptions)
                    ?? new List<CloudHistorySummary>();
        return items.Select(x => new ScanHistoryEntry(
            TenantId:     tenantId,
            ScannedAt:    x.ScannedAt,
            AppCount:     x.AppCount,
            SecretCount:  x.SecretCount,
            ExpiredCount: x.ExpiredCount,
            ExpiringCount: x.ExpiringCount
        )).ToList();
    }

    public async Task<bool> SendTestMailAsync(string templateKey, string[] to, Dictionary<string, string> demoData)
    {
        var content = Serialize(new { channel = "mail", templateKey, to, demoData });
        var response = await _http.PostAsync("notifications/test", content);
        await EnsureSuccessAsync(response);
        return true;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<ResultEnvelope<T>?> GetAsync<T>(string relativeUrl)
    {
        var response = await _http.GetAsync(relativeUrl);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        await EnsureSuccessAsync(response);
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<ResultEnvelope<T>>(json, JsonOptions);
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync();
        var hint = response.StatusCode switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                => " — Function key invalid or expired.",
            HttpStatusCode.NotFound
                => " — Resource not found. Tenant may not be configured in the Function.",
            HttpStatusCode.InternalServerError
                => " — Azure Function error. Check App Insights for details.",
            _ => string.Empty,
        };

        // Try to extract the error field from JSON body
        string message = $"HTTP {(int)response.StatusCode}{hint}";
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err))
                message = $"{err.GetString()}{hint}";
        }
        catch { /* body wasn't JSON */ }

        throw new InvalidOperationException(message);
    }

    private static StringContent Serialize<T>(T obj) =>
        new(JsonSerializer.Serialize(obj, JsonOptions),
            System.Text.Encoding.UTF8, "application/json");
}

file sealed class CloudHistorySummary
{
    [System.Text.Json.Serialization.JsonPropertyName("scannedAt")]
    public string ScannedAt { get; init; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("appCount")]
    public int AppCount { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("secretCount")]
    public int SecretCount { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("expiredCount")]
    public int ExpiredCount { get; init; }
    [System.Text.Json.Serialization.JsonPropertyName("expiringCount")]
    public int ExpiringCount { get; init; }
}
