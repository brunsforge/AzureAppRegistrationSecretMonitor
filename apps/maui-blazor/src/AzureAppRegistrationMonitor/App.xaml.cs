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

        // Intercept the Destroying event so closing the window hides it to tray
        // instead of terminating the process (OQ-043: system tray is MVP).
        _mainWindow.Destroying += OnWindowDestroying;

        _tray.Initialize(this);

        return _mainWindow;
    }

    private void OnWindowDestroying(object? sender, EventArgs e)
    {
        // User clicked X — hide the window but keep the process alive.
        // The tray icon stays active; the user can re-open via double-click or context menu.
        _mainWindow?.Hide();
    }

    public void ShowMainWindow()
    {
        if (_mainWindow is not null)
        {
            _mainWindow.Activate();
        }
    }

    public void ExitApplication()
    {
        _tray.Dispose();
        Quit();
    }
}
