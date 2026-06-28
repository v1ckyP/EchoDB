import os

NODE_ID = os.getenv("NODE_ID", "Node1")

DATABASES = {
    "Node1": "sqlite:///./node1.db",
    "Node2": "sqlite:///./node2.db",
    "Node3": "sqlite:///./node3.db",
}