from __future__ import annotations

import argparse
import os
import threading
import webbrowser
from pathlib import Path

from .desktop_server import create_server
from .desktop_service import DesktopService


def _default_data_dir() -> Path:
    if os.name == "nt" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "CompatibilizaBIM" / "projects"
    return Path.home() / ".compatibilizabim" / "projects"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="compatibilizabim-desktop", description="Inicia o workspace desktop local do CompatibilizaBIM.")
    parser.add_argument("--data-dir", type=Path, default=_default_data_dir(), help="Pasta local dos projetos")
    parser.add_argument("--host", default="127.0.0.1", choices=("127.0.0.1", "localhost"))
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--no-browser", action="store_true", help="Não abre o navegador automaticamente")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    service = DesktopService(args.data_dir)
    server = create_server(service, host=args.host, port=args.port)
    url = f"http://{args.host}:{server.server_port}/"
    print(f"CompatibilizaBIM Desktop: {url}")
    print(f"Projetos: {Path(args.data_dir).expanduser().resolve()}")
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
