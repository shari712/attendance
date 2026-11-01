from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import supabase, get_admin_client
from utils.dependencies import get_current_user, CurrentUser
from typing import Optional

router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    parent_name: Optional[str] = None
    parent_mobile: Optional[str] = None

@router.get("/")
def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    try:
        profile_res = supabase.table("profiles").select("*").eq("id", current_user.id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        data = profile_res.data[0]
        
        if current_user.role == "STUDENT":
            student_res = supabase.table("students").select("*").eq("profile_id", current_user.id).execute()
            if student_res.data:
                data.update(student_res.data[0])
        elif current_user.role in ["STAFF", "CLASS_ADVISOR"]:
            staff_res = supabase.table("staff").select("*").eq("profile_id", current_user.id).execute()
            if staff_res.data:
                data.update(staff_res.data[0])
                
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/")
def update_profile(updates: ProfileUpdate, current_user: CurrentUser = Depends(get_current_user)):
    try:
        admin_client = get_admin_client() or supabase
        clean_email = updates.email.strip().lower() if updates.email else None

        # 1. If email is being changed, update Supabase Auth user as well
        if clean_email and clean_email != current_user.email.lower():
            try:
                admin_client.auth.admin.update_user_by_id(current_user.id, {
                    "email": clean_email,
                    "email_confirm": True
                })
            except Exception as auth_err:
                print("Auth email update error:", auth_err)
                raise HTTPException(status_code=400, detail=f"Could not update authentication email: {auth_err}")

        # 2. Update public.profiles
        update_data = {}
        if updates.name: 
            update_data["name"] = updates.name.strip()
        if clean_email: 
            update_data["email"] = clean_email
        
        if update_data:
            admin_client.table("profiles").update(update_data).eq("id", current_user.id).execute()
            
        # 3. Update role-specific table
        if current_user.role == "STUDENT":
            student_updates = {}
            if updates.name: 
                student_updates["name"] = updates.name.strip()
            if clean_email: 
                student_updates["email"] = clean_email
            if updates.parent_name is not None: 
                student_updates["parent_name"] = updates.parent_name
            if updates.parent_mobile is not None: 
                student_updates["parent_mobile"] = updates.parent_mobile
            
            if student_updates:
                admin_client.table("students").update(student_updates).eq("profile_id", current_user.id).execute()
        
        elif current_user.role in ["STAFF", "CLASS_ADVISOR"]:
            staff_updates = {}
            if updates.name: 
                staff_updates["name"] = updates.name.strip()
            if staff_updates:
                admin_client.table("staff").update(staff_updates).eq("profile_id", current_user.id).execute()
                
        return {
            "message": "Profile updated successfully",
            "email": clean_email or current_user.email,
            "name": updates.name
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
