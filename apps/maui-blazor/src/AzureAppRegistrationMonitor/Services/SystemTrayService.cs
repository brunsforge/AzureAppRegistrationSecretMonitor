namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Stub tray service — H.NotifyIcon.Maui will be wired up once the base app builds.
/// OQ-043: system tray integration is confirmed MVP scope.
/// </summary>
public class SystemTrayService : IDisposable
{
    public void Initialize(App app)
    {
        // TODO: create TaskbarIcon via H.NotifyIcon.Maui once package is re-enabled
    }

    public void Dispose() { }
}
