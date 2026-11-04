@echo off
echo ===================================================================
echo  NASA TechRise World 24 (N141WV) - Local Showcase Website Server
echo  Opening http://localhost:8080 in your default browser...
echo  (Press Ctrl+C in this window when finished)
echo ===================================================================
cd /d "%~dp0"
start "" "http://localhost:8080"
python -m http.server 8080
