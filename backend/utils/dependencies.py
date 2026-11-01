from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase
from pydantic import BaseModel
from typing import Optional

security = HTTPBearer()

class CurrentUser(BaseModel):
    id: str
    email: str
    role: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    token = credentials.credentials
    try:
        # Verify the token and get the user from Supabase GoTrue
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = user_response.user.id
        email = user_response.user.email

        # Fetch the role from the profiles table
        profile_response = supabase.table("profiles").select("role").eq("id", user_id).execute()
        
        if not profile_response.data or len(profile_response.data) == 0:
            raise HTTPException(status_code=403, detail="Profile not found")
            
        role = profile_response.data[0].get("role", "STUDENT")

        return CurrentUser(id=user_id, email=email, role=role)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(allowed_roles: list[str]):
    def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def get_current_staff_or_advisor(current_user: CurrentUser = Depends(require_role(["STAFF", "CLASS_ADVISOR"]))):
    return current_user

def get_current_advisor(current_user: CurrentUser = Depends(require_role(["CLASS_ADVISOR"]))):
    return current_user
