using H.NotifyIcon;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Manages the system tray icon and its context menu.
/// Tray integration is confirmed MVP scope (OQ-043).
/// Implemented using H.NotifyIcon.Maui.
/// </summary>
public class SystemTrayService : IDisposable
{
    private TaskbarIcon? _trayIcon;
    private bool _disposed;

    public void Initialize(App app)
    {
        _trayIcon = Application.Current?.Resources["TrayIcon"] as TaskbarIcon;

        if (_trayIcon is null)
        {
            // TrayIcon not found in resources — create programmatically
            _trayIcon = new TaskbarIcon
            {
                ToolTipText = "Azure App Registration Monitor",
            };
        }

        _trayIcon.TrayLeftMouseDoubleClick += (_, _) =>
            MainThread.BeginInvokeOnMainThread(app.ShowMainWindow);

        // Wire up menu commands via the App instance
        // Menu items are defined in App.xaml resources (TrayIcon resource key)
    }

    public void Dispose()
    {
        if (_disposed) return;
        _trayIcon?.Dispose();
        _disposed = true;
    }
}
