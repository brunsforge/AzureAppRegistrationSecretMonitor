using System.Net.Http;
using System.Text;
using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Posts secret status messages to a Teams incoming webhook URL.
/// Uses the legacy MessageCard format which works with both classic
/// connectors and the newer Workflow-based webhooks.
/// </summary>
public class TeamsNotificationService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly SettingsService _settings;

    public TeamsNotificationService(SettingsService settings) => _settings = settings;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.Settings.TeamsWebhookUrl);

    /// <summary>Send a summary of all secrets for a tenant.</summary>
    public async Task SendSecretsReportAsync(
        IReadOnlyList<SecretSummary> secrets,
        string tenantDisplayName)
    {
        var url = _settings.Settings.TeamsWebhookUrl;
        if (string.IsNullOrWhiteSpace(url)) return;

        var expired  = secrets.Count(s => s.Status == "Expired");
        var expiring = secrets.Count(s => s.Status == "ExpiringSoon");

        var facts = secrets
            .Where(s => s.Status is "Expired" or "ExpiringSoon")
            .OrderBy(s => s.DaysUntilExpiry ?? int.MaxValue)
            .Take(15)
            .Select(s =>
            {
                var days = s.DaysUntilExpiry is int d
                    ? (d < 0 ? $"expired {Math.Abs(d)}d ago" : $"{d}d left")
                    : "unknown";
                return new { name = $"{s.AppDisplayName} / {s.DisplayName ?? s.KeyId[..8]}", value = $"{s.RiskLevel} — {days}" };
            })
            .ToArray();

        var card = new
        {
            type    = "MessageCard",
            context = "http://schema.org/extensions",
            themeColor = expired > 0 ? "D13438" : expiring > 0 ? "FFB900" : "107C10",
            summary = $"AARM — {tenantDisplayName}: {expired} expired, {expiring} expiring",
            sections = new[]
            {
                new
                {
                    activityTitle    = $"Secret Report — {tenantDisplayName}",
                    activitySubtitle = $"Generated {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm} UTC",
                    activityText     = $"Total: {secrets.Count} | Expired: **{expired}** | Expiring soon: **{expiring}**",
                    facts,
                },
            },
        };

        await PostAsync(url, card);
    }

    /// <summary>Send the status of a single secret.</summary>
    public async Task SendSecretStatusAsync(SecretSummary secret, string tenantDisplayName)
    {
        var url = _settings.Settings.TeamsWebhookUrl;
        if (string.IsNullOrWhiteSpace(url)) return;

        var days = secret.DaysUntilExpiry is int d
            ? (d < 0 ? $"expired {Math.Abs(d)}d ago" : $"{d} days remaining")
            : "unknown";

        var color = secret.RiskLevel switch
        {
            "Critical" => "D13438",
            "High"     => "DA3B01",
            "Medium"   => "FFB900",
            _          => "107C10",
        };

        var card = new
        {
            type    = "MessageCard",
            context = "http://schema.org/extensions",
            themeColor = color,
            summary = $"AARM — {secret.AppDisplayName}: {secret.RiskLevel}",
            sections = new[]
            {
                new
                {
                    activityTitle    = $"{secret.AppDisplayName} — {secret.DisplayName ?? secret.KeyId[..8]}",
                    activitySubtitle = $"Tenant: {tenantDisplayName}",
                    facts = new[]
                    {
                        new { name = "Risk",    value = secret.RiskLevel },
                        new { name = "Status",  value = secret.Status },
                        new { name = "Expiry",  value = days },
                        new { name = "Key ID",  value = secret.KeyId },
                    },
                },
            },
        };

        await PostAsync(url, card);
    }

    /// <summary>Posts a raw JSON string to a Teams incoming webhook and throws on non-success.</summary>
    public async Task SendRawAsync(string webhookUrl, string json)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var body = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await http.PostAsync(webhookUrl, body);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Teams webhook returned HTTP {(int)resp.StatusCode}: {err}");
        }
    }

    private static async Task PostAsync(string url, object payload)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var body = new StringContent(JsonSerializer.Serialize(payload, JsonOpts), Encoding.UTF8, "application/json");
        await http.PostAsync(url, body);
    }
}
