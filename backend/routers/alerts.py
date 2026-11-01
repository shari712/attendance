from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import supabase
from utils.dependencies import get_current_user, CurrentUser

router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"]
)

class AlertCreate(BaseModel):
    title: str
    description: Optional[str] = None
    user_id: Optional[str] = None

@router.get("/")
def get_alerts(current_user: CurrentUser = Depends(get_current_user)):
    try:
        res = supabase.table("alerts").select("*").eq("user_id", current_user.id).order("created_at", desc=True).execute()
        
        # If user has no alerts yet, seed a couple of helpful system alerts
        if not res.data:
            demo_alerts = [
                {
                    "user_id": current_user.id,
                    "title": "Welcome to Smart Attendance System",
                    "description": "Biometric face verification and automated period tracking are active for your account.",
                    "is_read": False
                },
                {
                    "user_id": current_user.id,
                    "title": "Attendance Policy Reminder",
                    "description": "Minimum 75% classroom attendance is required to avoid examination defaulter notice.",
                    "is_read": False
                }
            ]
            supabase.table("alerts").insert(demo_alerts).execute()
            res = supabase.table("alerts").select("*").eq("user_id", current_user.id).order("created_at", desc=True).execute()
            
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_alert(alert: AlertCreate, current_user: CurrentUser = Depends(get_current_user)):
    try:
        target_user_id = alert.user_id or current_user.id
        res = supabase.table("alerts").insert({
            "user_id": target_user_id,
            "title": alert.title,
            "description": alert.description,
            "is_read": False
        }).execute()
        return res.data[0] if res.data else {"message": "Alert created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{alert_id}/read")
def mark_alert_read(alert_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        res = supabase.table("alerts").update({"is_read": True}).eq("id", alert_id).eq("user_id", current_user.id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"message": "Alert marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{alert_id}")
def delete_alert(alert_id: str, current_user: CurrentUser = Depends(get_current_user)):
    try:
        supabase.table("alerts").delete().eq("id", alert_id).eq("user_id", current_user.id).execute()
        return {"message": "Alert deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
