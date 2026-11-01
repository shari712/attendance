import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
import json
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from database import supabase, get_admin_client
from utils.face_utils import get_face_encoding
from utils.dependencies import get_current_user, CurrentUser

router = APIRouter(
    prefix="/api/students",
    tags=["students"],
)

class StudentCreate(BaseModel):
    name: str
    register_number: str
    email: str
    department: Optional[str] = "Computer Science"
    year: Optional[int] = 3
    section: Optional[str] = "A"
    parent_name: Optional[str] = None
    parent_mobile: Optional[str] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    register_number: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None
    section: Optional[str] = None
    parent_name: Optional[str] = None
    parent_mobile: Optional[str] = None
    face_registration_status: Optional[bool] = None

@router.get("/options")
def get_student_options(current_user: CurrentUser = Depends(get_current_user)):
    try:
        classes = supabase.table("classes").select("*").execute().data
        departments = [
            "Computer Science",
            "Information Technology",
            "Electronics & Communication",
            "Mechanical Engineering",
            "Electrical Engineering",
            "Civil Engineering"
        ]
        years = [1, 2, 3, 4]
        sections = ["A", "B", "C", "D"]
        return {
            "classes": classes,
            "departments": departments,
            "years": years,
            "sections": sections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_students(current_user: CurrentUser = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        # Get face records to compute face_registration_status dynamically
        face_records_res = supabase.table("face_records").select("student_id").execute()
        registered_face_ids = set(r["student_id"] for r in (face_records_res.data or []))

        # STUDENT: Can only view their own student record
        if current_user.role == "STUDENT":
            res = supabase.table("students").select("*").eq("profile_id", current_user.id).execute()
            data = res.data or []
            for s in data:
                s["face_registration_status"] = s["id"] in registered_face_ids
            return data

        # CLASS_ADVISOR: View students belonging to their assigned class
        if current_user.role == "CLASS_ADVISOR":
            staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
            staff_id = staff_res.data[0]["id"] if staff_res.data else None
            
            if staff_id:
                classes_res = supabase.table("classes").select("*").eq("advisor_id", staff_id).execute()
                if classes_res.data:
                    c = classes_res.data[0]
                    query = supabase.table("students").select("*")
                    if c.get("department"):
                        query = query.eq("department", c["department"])
                    if c.get("year"):
                        query = query.eq("year", c["year"])
                    if c.get("section"):
                        query = query.eq("section", c["section"])
                    advisor_students = query.order("name").execute().data
                    if advisor_students:
                        for s in advisor_students:
                            s["face_registration_status"] = s["id"] in registered_face_ids
                        return advisor_students

        # Fallback for staff/admin or if no specific class assigned: return all students
        response = supabase.table("students").select("*").order("name").execute()
        all_students = response.data or []
        for s in all_students:
            s["face_registration_status"] = s["id"] in registered_face_ids
        return all_students
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_student(data: StudentCreate, current_user: CurrentUser = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # 1. PERMISSION CHECK: Only CLASS_ADVISOR or ADMIN can add students
    if current_user.role not in ["CLASS_ADVISOR", "ADMIN"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Only an authorized Class Advisor or Admin can enroll students."
        )

    name = data.name.strip()
    reg_no = data.register_number.strip().upper()
    email = data.email.strip().lower()

    if not name or not reg_no or not email:
        raise HTTPException(status_code=400, detail="Name, Register Number, and Email are required.")

    # 2. Check for duplicate register number in students table
    reg_check = supabase.table("students").select("id").ilike("register_number", reg_no).execute()
    if reg_check.data:
        raise HTTPException(status_code=400, detail=f"A student with register number '{reg_no}' already exists.")

    # 3. Check for duplicate email in students table
    email_check = supabase.table("students").select("id").ilike("email", email).execute()
    if email_check.data:
        raise HTTPException(status_code=400, detail=f"A student with email '{email}' is already enrolled.")

    # 4. Determine Advisor's assigned class for automatic association
    department = data.department or "Computer Science"
    year = data.year or 3
    section = data.section or "A"

    if current_user.role == "CLASS_ADVISOR":
        try:
            staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
            if staff_res.data:
                staff_id = staff_res.data[0]["id"]
                class_res = supabase.table("classes").select("*").eq("advisor_id", staff_id).execute()
                if class_res.data:
                    advisor_class = class_res.data[0]
                    department = advisor_class.get("department") or department
                    year = advisor_class.get("year") or year
                    section = advisor_class.get("section") or section
        except Exception as class_err:
            print("Class association lookup notice:", class_err)

    # 5. Read default initial password from environment variable
    default_student_pwd = os.getenv("DEFAULT_STUDENT_PASSWORD", "Student@123").strip()

    # 6. Create/Link student in Supabase Auth via clean admin client
    admin_client = get_admin_client() or supabase
    auth_user = None
    try:
        existing_users = admin_client.auth.admin.list_users()
        for u in existing_users:
            if u.email.lower() == email:
                auth_user = u
                break
    except Exception as list_err:
        print("list_users error:", list_err)

    if not auth_user:
        try:
            auth_res = admin_client.auth.admin.create_user({
                "email": email,
                "password": default_student_pwd,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": name,
                    "role": "STUDENT",
                    "status": "ACTIVE",
                    "register_number": reg_no,
                    "enrolled_by": current_user.id
                }
            })
            if auth_res and auth_res.user:
                auth_user = auth_res.user
        except Exception as create_auth_err:
            print("create_user error:", create_auth_err)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create student authentication account: {create_auth_err}"
            )
    else:
        # User already existed in Auth, ensure password is initialized and role is STUDENT
        try:
            admin_client.auth.admin.update_user_by_id(auth_user.id, {
                "password": default_student_pwd,
                "user_metadata": {
                    "full_name": name,
                    "role": "STUDENT",
                    "status": "ACTIVE",
                    "register_number": reg_no,
                    "enrolled_by": current_user.id
                }
            })
        except Exception as update_auth_err:
            print("update_user error:", update_auth_err)

    if not auth_user:
        raise HTTPException(status_code=500, detail="Could not establish Supabase Auth user.")

    # 7. Upsert profile in profiles table
    try:
        admin_client.table("profiles").upsert({
            "id": auth_user.id,
            "name": name,
            "email": email,
            "role": "STUDENT"
        }).execute()
    except Exception as prof_err:
        print("Profile upsert error:", prof_err)

    # 8. Insert into students table (Do NOT store plain-text password)
    try:
        payload = {
            "profile_id": auth_user.id,
            "name": name,
            "register_number": reg_no,
            "email": email,
            "department": department,
            "year": year,
            "section": section,
            "parent_name": data.parent_name or None,
            "parent_mobile": data.parent_mobile or None
        }
        res = admin_client.table("students").insert(payload).execute()
        created_data = res.data[0] if res.data else {"message": "Student created successfully"}
        if isinstance(created_data, dict):
            created_data["face_registration_status"] = False
        return created_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{student_id}")
def update_student(student_id: str, data: StudentUpdate, current_user: CurrentUser = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Only CLASS_ADVISOR or ADMIN can edit student records
    if current_user.role not in ["CLASS_ADVISOR", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify student records.")

    try:
        payload = {k: v for k, v in data.dict().items() if v is not None}
        admin_client = get_admin_client() or supabase
        res = admin_client.table("students").update(payload).eq("id", student_id).execute()
        return res.data[0] if res.data else {"message": "Student updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{student_id}")
def delete_student(student_id: str, current_user: CurrentUser = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Only CLASS_ADVISOR or ADMIN can delete student records
    if current_user.role not in ["CLASS_ADVISOR", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot delete student records.")

    try:
        admin_client = get_admin_client() or supabase
        # Fetch profile_id before deletion to clean up auth user
        stu_res = admin_client.table("students").select("profile_id").eq("id", student_id).execute()
        profile_id = stu_res.data[0]["profile_id"] if stu_res.data else None

        admin_client.table("students").delete().eq("id", student_id).execute()

        if profile_id:
            try:
                admin_client.auth.admin.delete_user(profile_id)
            except Exception as del_auth_err:
                print("Could not delete auth user:", del_auth_err)

        return {"message": "Student deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register-face")
async def register_face(
    student_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user)
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    # Only CLASS_ADVISOR or ADMIN can register biometric face data
    if current_user.role not in ["CLASS_ADVISOR", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Forbidden: Only an authorized Class Advisor can register face data.")

    try:
        # 1. Check if student exists
        student = supabase.table("students").select("id").eq("id", student_id).execute()
        if not student.data:
            raise HTTPException(status_code=404, detail="Student not found")
            
        # 2. Extract encoding
        contents = await file.read()
        encoding = get_face_encoding(contents)
        
        if encoding is None:
            raise HTTPException(status_code=400, detail="No face detected in the image")
            
        # 3. Save to face_records
        encoding_str = json.dumps(encoding)
        
        # Check if record already exists, then update or insert
        existing_record = supabase.table("face_records").select("id").eq("student_id", student_id).execute()
        
        if existing_record.data:
            supabase.table("face_records").update({"encoding_reference": encoding_str}).eq("student_id", student_id).execute()
        else:
            supabase.table("face_records").insert({"student_id": student_id, "encoding_reference": encoding_str}).execute()
            
        # 4. Update student status if column exists
        try:
            supabase.table("students").update({"face_registration_status": True}).eq("id", student_id).execute()
        except Exception:
            pass
        
        return {"message": "Face registered successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

