@echo off
if exist "%~dp0venv\Scripts\activate.bat" (
    call "%~dp0venv\Scripts\activate.bat"
    echo ICORP ERP Backend virtual environment activated.
) else (
    echo Virtual environment not found at %~dp0venv\Scripts\activate.bat
)
