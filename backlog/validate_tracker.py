#!/usr/bin/env python3
"""Validate the cardstock tracker against its scheme.

The board lives here, in the app's own repo, but the engine it runs on is
shared with the Staffeto delivery boards and lives in that vault at
delivery/board-sync. Set $STAFFETO_VAULT if your checkout is elsewhere.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VAULT = Path(os.environ.get("STAFFETO_VAULT", r"D:\Developer\staffeto\git\wiki"))
ENGINE = VAULT / "delivery" / "board-sync"

if not ENGINE.is_dir():
    sys.exit(
        f"board-sync engine not found at {ENGINE}.\n"
        "Set STAFFETO_VAULT to the Staffeto wiki checkout."
    )
sys.path.insert(0, str(ENGINE))

from validate_tracker import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(["--board", HERE.name, "--delivery", str(HERE.parent), *sys.argv[1:]]))
