' Launches the Palu quake alerter hidden (no console window) at logon.
' A copy of this file lives in the Windows Startup folder. The app's own
' single-instance lock prevents duplicates if launched twice.
' Fly.io is the primary always-on runtime; this PC loop is a backup only.
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\dev\palu-quake-alert\start.cmd""", 0, False
