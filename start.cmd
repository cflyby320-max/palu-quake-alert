@echo off
REM Launches the alerter using the .env in this project folder.
cd /d "G:\My Drive\Personal\palu-quake-alert"
node --env-file=.env run.js >> quake_alert.log 2>&1
