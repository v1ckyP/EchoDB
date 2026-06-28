from .health import is_node_alive

NODES = [
    {
        "id": "Node1",
        "url": "http://127.0.0.1:8001",
        "status": "healthy"
    },
    {
        "id": "Node2",
        "url": "http://127.0.0.1:8002",
        "status": "healthy"
    },
    {
        "id": "Node3",
        "url": "http://127.0.0.1:8003",
        "status": "healthy"
    }
]

current_index = 0

def get_next_node():
    global current_index

    for _ in range(len(NODES)):
        node = NODES[current_index]
        current_index = (current_index + 1) % len(NODES)

        if is_node_alive(node["url"]):
            return node

    return None