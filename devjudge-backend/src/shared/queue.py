from __future__ import annotations

import os
import logging
from azure.storage.queue import QueueClient


QUEUE_NAME = "analysis-queue"
DEFAULT_QUEUE_API_VERSION = "2021-12-02"


_queue_client: QueueClient | None = None


def get_analysis_queue() -> QueueClient:
    global _queue_client

    if _queue_client:
        return _queue_client

    connection_string = os.getenv("AzureWebJobsStorage")

    if not connection_string:
        raise RuntimeError("AzureWebJobsStorage is not configured")

    queue = QueueClient.from_connection_string(
        conn_str=connection_string,
        queue_name=QUEUE_NAME,
        api_version=os.getenv("AZURE_QUEUE_API_VERSION", DEFAULT_QUEUE_API_VERSION),
    )

    try:
        queue.create_queue()
    except Exception as error:
        # Queue may already exist, or the local emulator may reject a version/header mismatch.
        logging.warning("Queue create skipped for '%s': %s", QUEUE_NAME, error)

    _queue_client = queue
    return queue
