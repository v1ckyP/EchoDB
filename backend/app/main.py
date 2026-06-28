from fastapi import FastAPI
from .database import engine, Base
from .models import User
from fastapi import Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .schemas import UserCreate, UserUpdate
from sqlalchemy.orm import Session
from .utils import node_info
from .replication import replicate

app = FastAPI()

Base.metadata.create_all(bind=engine)

@app.get("/")
def home():
    return {
        "message": "Welcome to EchoDB",
        **node_info()
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        **node_info()
    }

@app.post("/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    new_user = User(
        name=user.name,
        email=user.email,
        city=user.city,
        age=user.age
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    replicate(user.model_dump())

    return {
        "message": "User created successfully",
        "id": new_user.id,
        **node_info()
    }

@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return {
    "served_by": node_info()["served_by"],
    "users": users
}

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        return {"message": "User not found"}

    return {
    "served_by": node_info()["served_by"],
    "user": user
}

@app.put("/users/{user_id}")
def update_user(user_id: int, updated_user: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        return {"message": "User not found"}

    user.name = updated_user.name
    user.email = updated_user.email
    user.city = updated_user.city
    user.age = updated_user.age

    db.commit()
    db.refresh(user)

    return {
    "message":"User updated successfully",
    "user":user,
    **node_info()
}

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        return {"message": "User not found"}

    db.delete(user)
    db.commit()

    return {
    "message":"User deleted successfully",
    **node_info()
}

@app.post("/replicate")
def replicate_user(user: UserCreate, db: Session = Depends(get_db)):
    new_user = User(
        name=user.name,
        email=user.email,
        city=user.city,
        age=user.age
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Replication successful",
        **node_info()
    }