from __future__ import annotations

import os
from azure.storage.queue import QueueClient


QUEUE_NAME = "analysis-queue"


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
        queue_name=QUEUE_NAME
    )

    try:
        queue.create_queue()
    except Exception:
        pass

    _queue_client = queue
    return queue