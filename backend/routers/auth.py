from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from database import supabase, get_admin_client
from utils.dependencies import get_current_user, CurrentUser

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

from typing import Optional

class LoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str
    redirect_to: Optional[str] = "http://localhost:5173/reset-password"

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    email = request.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    admin_client = get_admin_client() or supabase

    # 1. Check if user exists in auth.users
    user_match = None
    try:
        users = admin_client.auth.admin.list_users()
        for u in users:
            if u.email.lower() == email:
                user_match = u
                break
    except Exception as e:
        print("List users error:", e)


    # 1b. If not in auth.users, check if the email belongs to an enrolled student or staff profile
    if not user_match:
        try:
            # Check students table
            student_res = supabase.table("students").select("*").ilike("email", email).execute()
            if student_res.data:
                stu = student_res.data[0]
                create_res = admin_client.auth.admin.create_user({
                    "email": email,
                    "password": "Password!12345",
                    "email_confirm": True,
                    "user_metadata": {"full_name": stu.get("name", "Student")}
                })
                if create_res and create_res.user:
                    user_match = create_res.user
                    # Update students and profiles
                    supabase.table("students").update({"profile_id": user_match.id}).eq("id", stu["id"]).execute()
                    supabase.table("profiles").upsert({
                        "id": user_match.id,
                        "name": stu.get("name", "Student"),
                        "email": email,
                        "role": "STUDENT"
                    }).execute()
            else:
                # Check profiles table (for staff or advisors)
                prof_res = supabase.table("profiles").select("*").ilike("email", email).execute()
                if prof_res.data:
                    prof = prof_res.data[0]
                    create_res = admin_client.auth.admin.create_user({
                        "email": email,
                        "password": "Password!12345",
                        "email_confirm": True,
                        "user_metadata": {"full_name": prof.get("name", "Staff")}
                    })
                    if create_res and create_res.user:
                        user_match = create_res.user
                        supabase.table("profiles").update({"id": user_match.id}).eq("email", email).execute()
        except Exception as prov_err:
            print("Student/Staff auto-provisioning error:", prov_err)

    # 2. If user exists, generate the recovery link directly via Supabase Auth Admin
    action_link = None
    email_dispatched = False
    smtp_sent = False
    smtp_status = None
    
    if user_match:
        try:
            # Generate the official recovery link from Supabase Auth
            link_res = admin_client.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": request.redirect_to or "http://localhost:5173/reset-password"}
            })
            if link_res and hasattr(link_res, "properties") and link_res.properties:
                action_link = link_res.properties.action_link
        except Exception as gen_err:
            print("Generate link error:", gen_err)

        # 3. Direct SMTP dispatch (Gmail, Resend, Brevo, custom SMTP)
        if action_link:
            from utils.mailer import send_password_reset_email
            smtp_sent, smtp_status = send_password_reset_email(email, action_link)
            if smtp_sent:
                email_dispatched = True

        # Also attempt sending email through Supabase built-in mailer
        if not email_dispatched:
            try:
                supabase.auth.reset_password_for_email(email, {"redirect_to": request.redirect_to})
                email_dispatched = True
            except Exception as mail_err:
                print("Supabase mailer error (e.g. rate limit or dummy domain):", mail_err)

    return {
        "success": True,
        "exists": bool(user_match),
        "email_dispatched": email_dispatched,
        "smtp_sent": smtp_sent,
        "smtp_status": smtp_status,
        "reset_link": action_link,
        "email": email,
        "message": "If an account exists for this email address, a password reset link has been dispatched."
    }

@router.post("/login")
def login(request: LoginRequest):
    try:
        # Authenticate with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        user_id = auth_response.user.id
        
        # Get role
        profile_res = supabase.table("profiles").select("role, name").eq("id", user_id).execute()
        role = profile_res.data[0].get("role", "STUDENT") if profile_res.data else "STUDENT"
        name = profile_res.data[0].get("name", "") if profile_res.data else ""

        # Validate matching role selection if specified
        if request.role and request.role != role:
            raise HTTPException(
                status_code=403,
                detail=f"Invalid role selection. This account is registered as {role.replace('_', ' ')}."
            )

        # STRICT STUDENT LOGIN RULE:
        # Student MUST be enrolled by an authorized Class Advisor (must exist in students table)
        if role == "STUDENT":
            clean_email = request.email.strip().lower()
            student_res = supabase.table("students").select("*").or_(f"profile_id.eq.{user_id},email.eq.{clean_email}").execute()
            if not student_res.data:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied. Your student account is not enrolled by an authorized Class Advisor."
                )
            
            stu = student_res.data[0]
            # Link profile_id if not yet linked
            if stu.get("profile_id") != user_id:
                try:
                    supabase.table("students").update({"profile_id": user_id}).eq("id", stu["id"]).execute()
                except Exception as link_err:
                    print("Error linking profile_id:", link_err)

        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "user": {
                "id": user_id,
                "email": request.email,
                "name": name,
                "role": role
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me")
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    # Fetch additional profile details based on role
    profile_data = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }
    
    try:
        profile_res = supabase.table("profiles").select("name").eq("id", current_user.id).execute()
        if profile_res.data:
            profile_data["name"] = profile_res.data[0].get("name", "")
            
        if current_user.role == "STUDENT":
            student_res = supabase.table("students").select("id, register_number, department, year, section, name, photo_url, face_registration_status").eq("profile_id", current_user.id).execute()
            if student_res.data:
                profile_data.update(student_res.data[0])
                
    except Exception as e:
        print("get_me student info fetch error:", e)
        
    return profile_data

