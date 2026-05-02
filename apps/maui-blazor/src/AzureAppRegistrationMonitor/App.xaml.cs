using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor;

public partial class App : Application
{
    private readonly SystemTrayService _tray;
    private Window? _mainWindow;

    public App(SystemTrayService tray)
    {
        InitializeComponent();
        _tray = tray;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        _mainWindow = new Window(new MainPage())
        {
            Title = "Azure App Registration Monitor",
            MinimumWidth = 1024,
            MinimumHeight = 640,
        };

        _mainWindow.Destroying += OnWindowDestroying;

        _tray.Initialize(this);

        return _mainWindow;
    }

    private void OnWindowDestroying(object? sender, EventArgs e)
    {
        // OQ-043: minimize to tray is confirmed MVP scope.
        // Full Windows platform implementation (WinUI WM_CLOSE intercept) is in Platforms/Windows/.
        // For now the window closes normally — the tray icon stays visible.
    }

    public void ShowMainWindow()
    {
        if (_mainWindow is not null && Application.Current is not null)
        {
            // Re-open the window if it was closed, or bring it to front via platform handler
            Application.Current.OpenWindow(_mainWindow);
        }
    }

    public void ExitApplication()
    {
        _tray.Dispose();
        Quit();
    }
}
