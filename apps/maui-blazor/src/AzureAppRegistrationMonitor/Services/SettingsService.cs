using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

public class SettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly string _settingsFile;

    public UiSettings Settings { get; private set; } = new();

    public SettingsService()
    {
        _settingsFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm", "ui-settings.json");
        _ = LoadAsync();
    }

    public async Task LoadAsync()
    {
        if (!File.Exists(_settingsFile)) return;
        try
        {
            var json = await File.ReadAllTextAsync(_settingsFile);
            Settings = JsonSerializer.Deserialize<UiSettings>(json, JsonOptions) ?? new();
        }
        catch { Settings = new(); }
    }

    public async Task SaveAsync()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_settingsFile)!);
        await File.WriteAllTextAsync(_settingsFile, JsonSerializer.Serialize(Settings, JsonOptions));
    }

    public async Task RecordScanAsync(string tenantDisplayName)
    {
        Settings.LastScannedTenant = tenantDisplayName;
        Settings.LastScanTime = DateTimeOffset.UtcNow;
        await SaveAsync();
    }

    public string StalenessText
    {
        get
        {
            if (Settings.LastScanTime is null) return "Never scanned";
            var age = DateTimeOffset.UtcNow - Settings.LastScanTime.Value;
            if (age.TotalMinutes < 1)  return "Just now";
            if (age.TotalMinutes < 60) return $"{(int)age.TotalMinutes}m ago";
            if (age.TotalHours < 24)   return $"{(int)age.TotalHours}h ago";
            return $"{(int)age.TotalDays}d ago";
        }
    }
}
