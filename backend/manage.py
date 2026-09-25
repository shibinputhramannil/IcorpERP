#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        venv_python = os.path.join(base_dir, 'venv', 'Scripts', 'python.exe')
        if os.path.isfile(venv_python) and os.path.abspath(sys.executable).lower() != os.path.abspath(venv_python).lower():
            import subprocess
            cmd = [venv_python, os.path.abspath(__file__)] + sys.argv[1:]
            sys.exit(subprocess.call(cmd))
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
