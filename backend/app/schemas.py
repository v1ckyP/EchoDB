from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    city: str
    age: int


class UserUpdate(BaseModel):
    name: str
    email: str
    city: str
    age: int