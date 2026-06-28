from .config import NODE_ID

def node_info():
    return {
        "served_by": NODE_ID
    }