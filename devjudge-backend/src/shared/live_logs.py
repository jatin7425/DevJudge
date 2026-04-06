import os
import json
import requests
import logging


SIGNALR_ENDPOINT = os.getenv("SIGNALR_ENDPOINT")
SIGNALR_KEY = os.getenv("SIGNALR_KEY")


def send_log(job_id: str, message: str):
    logging.info("[job:%s] %s", job_id, message)
    if not SIGNALR_ENDPOINT or not SIGNALR_KEY:
        return  # fail silently for now

    payload = {
        "target": "job-log",
        "arguments": [
            {
                "job_id": job_id,
                "message": message
            }
        ]
    }

    requests.post(
        SIGNALR_ENDPOINT,
        headers={
            "Content-Type": "application/json",
            "x-api-key": SIGNALR_KEY
        },
        data=json.dumps(payload)
    )