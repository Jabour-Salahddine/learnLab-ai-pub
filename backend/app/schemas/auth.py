"""Pydantic v2 schemas for authentication endpoints."""

import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterStudentRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    formation: str | None = None
    filiere: str | None = None
    year_of_study: int | None = Field(default=None, ge=1, le=10)
    invitation_code: str = Field(min_length=3, max_length=50)


class RegisterTeacherRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    first_name: str
    last_name: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str
