using System.Runtime.InteropServices;
using System.Text;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Reads and writes credentials in the generic Windows Credential Manager
/// (advapi32 CredWriteW / CredReadW / CredDeleteW) using the same target-name
/// format as the aarm CLI's keytar store so that both apps share credentials.
///
/// keytar target-name format (keytar_win.cc):  "{service}/{account}"
/// Password encoding:                           UTF-16 LE (WCHAR)
/// Credential type:                             CRED_TYPE_GENERIC (1)
/// Persist:                                     CRED_PERSIST_LOCAL_MACHINE (2)
/// </summary>
public class CredentialRepository
{
    private const string ServiceName = "aarm";
    private const uint CredTypeGeneric = 1;
    private const uint CredPersistLocalMachine = 2;

    // ── Public API ────────────────────────────────────────────────────────────

    public void SetClientSecret(string tenantId, string clientId, string secret) =>
        Write(ClientAccount(tenantId, clientId), secret);

    public string? GetClientSecret(string tenantId, string clientId) =>
        Read(ClientAccount(tenantId, clientId));

    public void DeleteClientSecret(string tenantId, string clientId) =>
        Delete(ClientAccount(tenantId, clientId));

    public void SetUserPassword(string tenantId, string clientId, string username, string password) =>
        Write(UserAccount(tenantId, clientId, username), password);

    public string? GetUserPassword(string tenantId, string clientId, string username) =>
        Read(UserAccount(tenantId, clientId, username));

    public void DeleteUserPassword(string tenantId, string clientId, string username) =>
        Delete(UserAccount(tenantId, clientId, username));

    // ── Key helpers (must match CredentialStore.ts) ───────────────────────────

    private static string ClientAccount(string t, string c)          => $"{t}:{c}";
    private static string UserAccount(string t, string c, string u)  => $"{t}:{c}:upw:{u}";
    private static string TargetName(string account)                  => $"{ServiceName}/{account}";

    // ── Low-level Windows Credential Manager ─────────────────────────────────

    private static void Write(string account, string secret)
    {
        var target     = TargetName(account);
        var secretBytes = Encoding.Unicode.GetBytes(secret);
        var handle      = GCHandle.Alloc(secretBytes, GCHandleType.Pinned);
        var targetPtr   = Marshal.StringToCoTaskMemUni(target);
        var userPtr     = Marshal.StringToCoTaskMemUni(account);
        try
        {
            var cred = new NativeCredential
            {
                Flags              = 0,
                Type               = CredTypeGeneric,
                TargetName         = targetPtr,
                Comment            = IntPtr.Zero,
                CredentialBlobSize = (uint)secretBytes.Length,
                CredentialBlob     = handle.AddrOfPinnedObject(),
                Persist            = CredPersistLocalMachine,
                AttributeCount     = 0,
                Attributes         = IntPtr.Zero,
                TargetAlias        = IntPtr.Zero,
                UserName           = userPtr,
            };
            if (!CredWriteW(ref cred, 0))
                throw new InvalidOperationException(
                    $"CredWriteW failed (error {Marshal.GetLastWin32Error()})");
        }
        finally
        {
            handle.Free();
            Marshal.FreeCoTaskMem(targetPtr);
            Marshal.FreeCoTaskMem(userPtr);
        }
    }

    private static string? Read(string account)
    {
        if (!CredReadW(TargetName(account), CredTypeGeneric, 0, out var ptr)) return null;
        try
        {
            var cred = Marshal.PtrToStructure<NativeCredential>(ptr);
            if (cred.CredentialBlobSize == 0 || cred.CredentialBlob == IntPtr.Zero)
                return null;
            var bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, bytes.Length);
            return Encoding.Unicode.GetString(bytes);
        }
        finally { CredFree(ptr); }
    }

    private static void Delete(string account)
    {
        CredDeleteW(TargetName(account), CredTypeGeneric, 0); // ignore if not found
    }

    // ── P/Invoke declarations ─────────────────────────────────────────────────

    [DllImport("Advapi32.dll", EntryPoint = "CredWriteW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWriteW(ref NativeCredential cred, uint flags);

    [DllImport("Advapi32.dll", EntryPoint = "CredReadW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredReadW(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW",
        CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDeleteW(string target, uint type, uint flags);

    [DllImport("Advapi32.dll", EntryPoint = "CredFree", SetLastError = false)]
    private static extern void CredFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NativeCredential
    {
        public uint   Flags;
        public uint   Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public long   LastWritten;   // FILETIME (2× DWORD)
        public uint   CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint   Persist;
        public uint   AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }
}
