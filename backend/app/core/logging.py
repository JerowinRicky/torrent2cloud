import logging
import sys
from app.config import settings

def setup_logging():
    log_level = logging.DEBUG if settings.APP_DEBUG else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

logger = logging.getLogger("cloudtorrent")
