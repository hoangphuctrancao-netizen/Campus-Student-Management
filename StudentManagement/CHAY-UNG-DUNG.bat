@echo off
setlocal
cd /d "%~dp0"
where dotnet >nul 2>nul
if errorlevel 1 (
  echo.
  echo Chua tim thay .NET SDK. Cai .NET 10 SDK va Visual Studio 2026, sau do chay lai file nay.
  echo.
  pause
  exit /b 1
)

echo === Campus Student Management ===
echo Khoi dong ASP.NET Core tai http://localhost:5180

dotnet restore
if errorlevel 1 goto :error

dotnet run --launch-profile "Campus.StudentManagement"
exit /b 0

:error
echo.
echo Khong the restore package. Hay mo project bang Visual Studio 2026 va chon Restore NuGet Packages.
pause
exit /b 1
