"""Room maintenance worker (v1 `expire_rooms --loop`): expires stale rooms and Quick Match tickets and applies every
retention rule in bounded batches. Nothing correctness-critical depends on it running promptly: every read already
compares against the same deadlines (sanction expiry is a read-time rule).

    python -m app.Workers.expire_rooms            # one pass
    python -m app.Workers.expire_rooms --loop     # every EXPIRY_INTERVAL_SECONDS (docker service room-maintenance)
"""
import argparse
import signal
import time

from app.Services import AccountService, ModerationService, SanctionService, SessionService
from app.Services import FeedbackService as feedback
from app.Services import MatchmakingService as matchmaking
from app.Services import RoomService as rooms
from app.Utils.Logger import logger
from config.database import get_db
from config.settings import get_settings

_stop = False


def run_once() -> dict[str, int]:
    settings = get_settings()
    counts: dict[str, int] = {}
    db = next(get_db())
    try:
        for name, fn in (
            ("rooms_expired", lambda: rooms.expire_old(db, settings)),
            ("rooms_purged", lambda: rooms.purge_expired(db, settings)),
            ("tickets_expired", lambda: matchmaking.expire_tickets(db)),
            ("tickets_purged", lambda: matchmaking.purge_tickets(db, settings)),
            ("feedback_purged", lambda: feedback.purge_old(db, settings)),
            ("reports_purged", lambda: ModerationService.purge_reports(db, settings)),
            ("evidence_purged", lambda: ModerationService.purge_evidence(db, settings)),
            ("sanctions_purged", lambda: SanctionService.purge_sanctions(db, settings)),
            ("auth_codes_purged", lambda: AccountService.purge_codes(db, settings)),
            ("sessions_purged", lambda: SessionService.purge(db, settings)),
        ):
            total = 0
            for _ in range(20):  # bounded: at most 20 batches per rule per pass
                n = fn()
                total += n
                if n < 500:
                    break
            counts[name] = total
    finally:
        db.close()
    logger.info("maintenance_pass", extra=counts)
    return counts


def main() -> None:
    global _stop
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    if not args.loop:
        run_once()
        return
    def stop(*_: object) -> None:
        global _stop
        _stop = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    interval = get_settings().expiry_interval_seconds
    while not _stop:
        try:
            run_once()
        except Exception:  # keep looping; the next pass retries
            logger.exception("maintenance_failed")
        for _ in range(interval):
            if _stop:
                break
            time.sleep(1)


if __name__ == "__main__":
    main()
