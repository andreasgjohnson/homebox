#!/usr/bin/env python3
import argparse
import contextlib
import os
from pathlib import Path

import whisper


def fmt_time(seconds: float) -> str:
    millis = int(round(seconds * 1000))
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("output")
    parser.add_argument("--model", default="medium")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    os.environ["PATH"] = f"{root / '.venv-whisper' / 'bin'}:{os.environ.get('PATH', '')}"

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    progress = output.with_suffix(".progress.txt")

    model = whisper.load_model(args.model)
    with progress.open("w", encoding="utf-8") as progress_file:
        with contextlib.redirect_stdout(progress_file):
            result = model.transcribe(
                args.audio,
                language=args.language,
                fp16=False,
                verbose=True,
            )

    with output.open("w", encoding="utf-8") as transcript:
        for segment in result["segments"]:
            text = segment["text"].strip()
            if text:
                start = fmt_time(segment["start"])
                end = fmt_time(segment["end"])
                transcript.write(f"[{start} --> {end}] {text}\n")


if __name__ == "__main__":
    main()
