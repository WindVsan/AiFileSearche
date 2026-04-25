Add-Type -AssemblyName System.Windows.Forms

# 最前面に強制的に持ってくるためのWindows APIを定義
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class FocusHelper {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool BringWindowToTop(IntPtr hWnd);
    }
"@

[System.Windows.Forms.Application]::EnableVisualStyles()

# 文字化け対策（Unicode）
$desc = [char]0x691C + [char]0x7D22 + [char]0x5BFE + [char]0x8C61 + [char]0x306E + [char]0x30D5 + [char]0x30A9 + [char]0x30EB + [char]0x30C0 + [char]0x3092 + [char]0x9078 + [char]0x629E + [char]0x3057 + [char]0x3066 + [char]0x304F + [char]0x3060 + [char]0x3055 + [char]0x3044

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = $desc
$dialog.ShowNewFolderButton = $true

# ダイアログを引っ張り上げるための透明な「土台」ウィンドウを作成
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true       # 常に最前面
$form.Opacity = 0           # 完全透明
$form.ShowInTaskbar = $false # タスクバーに表示しない
$form.FormBorderStyle = "None"
$form.StartPosition = "CenterScreen"

# 土台を画面に表示（透明なので見えない）
$form.Show()

# Windows APIを使って、この土台ウィンドウを強制的にOSの一番手前に引きずり出す
[FocusHelper]::BringWindowToTop($form.Handle) | Out-Null
[FocusHelper]::SetForegroundWindow($form.Handle) | Out-Null

# さらに念押しでAltキーを空打ちしてフォーカス制限を解除
try { [System.Windows.Forms.SendKeys]::SendWait("%") } catch {}

# 土台ウィンドウを親としてダイアログを表示
$result = $dialog.ShowDialog($form)

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}

$form.Close()
