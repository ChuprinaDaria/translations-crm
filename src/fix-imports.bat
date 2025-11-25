@echo off
REM Script to fix all versioned imports in shadcn/ui components

echo.
echo Fixing all versioned package imports...
echo.

echo Fixing imports in shadcn components...

REM Fix each component file
for %%f in (components\ui\*.tsx) do (
    echo Processing %%f...
    
    REM This uses PowerShell to do the replacements
    powershell -Command "(Get-Content '%%f') -replace '@radix-ui/react-([a-z-]+)@[\d.]+', '@radix-ui/react-$1' | Set-Content '%%f'"
    powershell -Command "(Get-Content '%%f') -replace 'lucide-react@[\d.]+', 'lucide-react' | Set-Content '%%f'"
    powershell -Command "(Get-Content '%%f') -replace 'class-variance-authority@[\d.]+', 'class-variance-authority' | Set-Content '%%f'"
    powershell -Command "(Get-Content '%%f') -replace 'react-hook-form@[\d.]+', 'react-hook-form' | Set-Content '%%f'"
)

echo.
echo Done! All imports fixed.
echo.
echo Run these commands to complete the fix:
echo.
echo   rmdir /s /q node_modules
echo   del package-lock.json
echo   npm install
echo   npm run dev
echo.

pause
