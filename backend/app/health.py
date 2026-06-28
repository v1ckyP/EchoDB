import requests

def is_node_alive(url):
    try:
        response = requests.get(f"{url}/health", timeout=1)
        return response.status_code == 200
    except:
        return False