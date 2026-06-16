' Launches the Palu quake alerter hidden (no console window) at logon.
' Secrets (.env) live OFF Google Drive in %LOCALAPPDATA%\PaluQuakeAlert.
' A copy of this file lives in the Windows Startup folder. The app's own
' single-instance lock prevents duplicates if launched twice.
Set sh = CreateObject("WScript.Shell")
sh.Run """G:\My Drive\Personal\palu-quake-alert\start.cmd""", 0, False
