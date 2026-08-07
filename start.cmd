@echo off
REM Launches the alerter using the .env in this project folder.
cd /d "C:\Users\User\MaybeViki\projects\palu-quake-alert"
node --env-file=.env run.js >> quake_alert.log 2>&1
