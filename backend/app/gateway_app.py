from fastapi import FastAPI
from .gateway import get_next_node
import requests
from .schemas import UserCreate
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EchoDB Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    node = get_next_node()

    return {
        "selected_node": node["id"]
    }
@app.get("/users")
def get_users():
    node = get_next_node()

    if node is None:
        return {"message": "No healthy nodes available"}

    try:
        response = requests.get(
            f"{node['url']}/users",
            timeout=1
        )

        return response.json()

    except Exception:
        # Node became unavailable after selection
        node = get_next_node()

        if node is None:
            return {"message": "No healthy nodes available"}

        response = requests.get(
            f"{node['url']}/users",
            timeout=1
        )

        return response.json()
    
@app.post("/users")
def create_user(user: UserCreate):
    node = get_next_node()

    if node is None:
        return {"message": "No healthy nodes available"}

    response = requests.post(
        f"{node['url']}/users",
        json=user.model_dump()
    )

    return response.json()

@app.delete("/users/{user_id}")
def delete_user(user_id: int):
    node = get_next_node()

    if node is None:
        return {"message": "No healthy nodes available"}

    response = requests.delete(
        f"{node['url']}/users/{user_id}"
    )

    return response.json()

@app.put("/users/{user_id}")
def update_user(user_id: int, user: UserCreate):
    node = get_next_node()

    if node is None:
        return {"message": "No healthy nodes available"}

    response = requests.put(
        f"{node['url']}/users/{user_id}",
        json=user.model_dump()
    )

    return response.json()

@app.get("/users/{user_id}")
def get_user(user_id: int):
    node = get_next_node()

    if node is None:
        return {"message": "No healthy nodes available"}

    response = requests.get(
        f"{node['url']}/users/{user_id}"
    )

    return response.json()

@app.get("/health")
def gateway_health():
    nodes = {}

    for i in range(1, 4):
        url = f"http://127.0.0.1:800{i}/health"

        try:
            response = requests.get(url, timeout=1)

            if response.status_code == 200:
                nodes[f"node{i}"] = {
                    "status": "healthy",
                    "user_count": len(
                        requests.get(
                            f"http://127.0.0.1:800{i}/users"
                        ).json()["users"]
                    )
                }
            else:
                nodes[f"node{i}"] = {
                    "status": "offline",
                    "user_count": 0
                }

        except:
            nodes[f"node{i}"] = {
                "status": "offline",
                "user_count": 0
            }

    return {
        "gateway_status": "online",
        "active_node": get_next_node()["id"],
        "nodes": nodes
    }