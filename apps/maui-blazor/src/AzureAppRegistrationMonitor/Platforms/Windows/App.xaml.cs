using Microsoft.UI.Xaml;

namespace AzureAppRegistrationMonitor.WinUI;

/// <summary>
/// Windows entry point for the MAUI Blazor Hybrid application.
/// Provides application-specific behavior to supplement the default WinUI Application class.
/// </summary>
public partial class App : MauiWinUIApplication
{
    public App()
    {
        this.InitializeComponent();
    }

    protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();
}
