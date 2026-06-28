import threading
import time
import requests

REPLICA_NODES = [
    "http://127.0.0.1:8002",
    "http://127.0.0.1:8003",
]

def replicate(data):
    threading.Thread(
        target=replicate_in_background,
        args=(data,),
        daemon=True
    ).start()

def replicate_in_background(data):
    time.sleep(2)

    for node in REPLICA_NODES:
        try:
            requests.post(
                f"{node}/replicate",
                json=data
            )
        except Exception as e:
            print(f"Replication failed for {node}: {e}")