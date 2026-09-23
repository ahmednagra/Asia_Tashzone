"""Structured one-line JSON logs. Pass context through `extra`; never log tokens, secrets, IPs or message text."""
import json
import logging
import sys


class JsonFormatter(logging.Formatter):
    RESERVED = set(vars(logging.makeLogRecord({}))) | {"message"}

    def format(self, record: logging.LogRecord) -> str:
        out = {"level": record.levelname.lower(), "msg": record.getMessage()}
        out.update({k: v for k, v in vars(record).items() if k not in self.RESERVED})
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, default=str)


def configure_logging() -> None:
    log = logging.getLogger("tashzone")
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(JsonFormatter())
        log.addHandler(h)
        log.setLevel(logging.INFO)
        log.propagate = False


configure_logging()
logger = logging.getLogger("tashzone")
