from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from utils.dependencies import get_current_user, require_role, CurrentUser, get_current_advisor
from pydantic import BaseModel
from typing import Optional

router = APIRouter(
    prefix="/api/timetable",
    tags=["Timetable"]
)

class TimetableEntry(BaseModel):
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None
    day: str
    period_number: int
    start_time: str
    end_time: str
    room: Optional[str] = None

DEFAULT_PERIOD_TIMINGS = {
    1: {"start_time": "09:30", "end_time": "10:20"},
    2: {"start_time": "10:20", "end_time": "11:10"},
    3: {"start_time": "11:25", "end_time": "12:15"},
    4: {"start_time": "12:15", "end_time": "13:05"},
    5: {"start_time": "14:00", "end_time": "14:50"},
    6: {"start_time": "14:50", "end_time": "15:40"},
    7: {"start_time": "15:40", "end_time": "16:30"},
    8: {"start_time": "16:30", "end_time": "17:20"}
}

def normalize_timetable_entries(entries):
    if not entries:
        return []
    for entry in entries:
        if not entry.get("faculty_name"):
            stf = entry.get("staff")
            if isinstance(stf, dict) and stf.get("name"):
                entry["faculty_name"] = stf["name"]
        if not entry.get("faculty_name"):
            entry["faculty_name"] = "Assigned Faculty"
    return entries

def resolve_timetable_entry(entry: TimetableEntry, current_user: CurrentUser):
    # 1. Resolve Class
    if not entry.class_id and entry.class_name:
        c_name = entry.class_name.strip()
        c_res = supabase.table("classes").select("id").ilike("name", c_name).execute()
        if c_res.data:
            entry.class_id = c_res.data[0]["id"]
        else:
            new_c = supabase.table("classes").insert({"name": c_name}).execute()
            if new_c.data:
                entry.class_id = new_c.data[0]["id"]
    elif not entry.class_id:
        c_first = supabase.table("classes").select("id").limit(1).execute()
        if c_first.data:
            entry.class_id = c_first.data[0]["id"]

    # 2. Resolve Subject
    if not entry.subject_id and entry.subject_name:
        raw = entry.subject_name.strip()
        if " - " in raw:
            code_part, name_part = raw.split(" - ", 1)
        else:
            code_part, name_part = (raw[:5] + "101").upper().replace(" ", ""), raw
        s_res = supabase.table("subjects").select("id").or_(f"name.ilike.{name_part},code.ilike.{code_part}").execute()
        if s_res.data:
            entry.subject_id = s_res.data[0]["id"]
        else:
            try:
                new_s = supabase.table("subjects").insert({"code": code_part, "name": name_part}).execute()
                if new_s.data:
                    entry.subject_id = new_s.data[0]["id"]
            except Exception:
                import time
                new_s = supabase.table("subjects").insert({"code": f"SUB{int(time.time()) % 10000}", "name": name_part}).execute()
                if new_s.data:
                    entry.subject_id = new_s.data[0]["id"]
    elif not entry.subject_id:
        s_first = supabase.table("subjects").select("id").limit(1).execute()
        if s_first.data:
            entry.subject_id = s_first.data[0]["id"]

    # 3. Resolve Faculty
    if entry.faculty_name and not entry.faculty_id:
        f_name = entry.faculty_name.strip()
        f_res = supabase.table("staff").select("id, name").ilike("name", f_name).execute()
        if f_res.data:
            entry.faculty_id = f_res.data[0]["id"]
            entry.faculty_name = f_res.data[0]["name"]
        else:
            staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
            if staff_res.data:
                entry.faculty_id = staff_res.data[0]["id"]
            else:
                first_staff = supabase.table("staff").select("id").limit(1).execute()
                if first_staff.data:
                    entry.faculty_id = first_staff.data[0]["id"]
    elif entry.faculty_id and not entry.faculty_name:
        stf_res = supabase.table("staff").select("name").eq("id", entry.faculty_id).execute()
        if stf_res.data:
            entry.faculty_name = stf_res.data[0]["name"]
    elif not entry.faculty_id:
        first_staff = supabase.table("staff").select("id, name").limit(1).execute()
        if first_staff.data:
            entry.faculty_id = first_staff.data[0]["id"]
            if not entry.faculty_name:
                entry.faculty_name = first_staff.data[0]["name"]

@router.get("/options")
def get_timetable_options(current_user: CurrentUser = Depends(get_current_user)):
    try:
        classes = supabase.table("classes").select("*").execute().data or []
        subjects = supabase.table("subjects").select("*").execute().data or []
        staff = supabase.table("staff").select("*").execute().data or []

        return {
            "classes": classes,
            "subjects": subjects,
            "faculty": staff,
            "period_timings": DEFAULT_PERIOD_TIMINGS
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_timetable(current_user: CurrentUser = Depends(get_current_user)):
    try:
        if current_user.role == "STUDENT":
            student_res = supabase.table("students").select("class_id").eq("profile_id", current_user.id).execute()
            class_id = student_res.data[0].get("class_id") if student_res.data else None
            if not class_id:
                # Fallback: get all timetable entries
                tt_res = supabase.table("timetable").select("*, subjects(name, code), staff(name), classes(name)").execute()
                return normalize_timetable_entries(tt_res.data)
            tt_res = supabase.table("timetable").select("*, subjects(name, code), staff(name), classes(name)").eq("class_id", class_id).execute()
            return normalize_timetable_entries(tt_res.data)
            
        elif current_user.role == "CLASS_ADVISOR":
            staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
            staff_id = staff_res.data[0]["id"] if staff_res.data else None
            
            class_ids = []
            if staff_id:
                classes_res = supabase.table("classes").select("id").eq("advisor_id", staff_id).execute()
                class_ids = [c["id"] for c in classes_res.data]
            
            if not class_ids:
                # If advisor has no classes assigned specifically, return all timetable entries for management
                tt_res = supabase.table("timetable").select("*, subjects(name, code), staff(name), classes(name)").execute()
                return normalize_timetable_entries(tt_res.data)
                
            tt_res = supabase.table("timetable").select("*, subjects(name, code), staff(name), classes(name)").in_("class_id", class_ids).execute()
            return normalize_timetable_entries(tt_res.data)
            
        elif current_user.role == "STAFF":
            staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
            staff_id = staff_res.data[0]["id"] if staff_res.data else None
            if not staff_id:
                return []
            tt_res = supabase.table("timetable").select("*, subjects(name, code), classes(name), staff(name)").eq("faculty_id", staff_id).execute()
            return normalize_timetable_entries(tt_res.data)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def add_timetable_entry(entry: TimetableEntry, current_user: CurrentUser = Depends(get_current_advisor)):
    try:
        resolve_timetable_entry(entry, current_user)
        staff_res = supabase.table("staff").select("id").eq("profile_id", current_user.id).execute()
        staff_id = staff_res.data[0]["id"] if staff_res.data else None
        
        # Check if class exists
        class_res = supabase.table("classes").select("id, advisor_id").eq("id", entry.class_id).execute()
        if not class_res.data:
            raise HTTPException(status_code=404, detail="Selected target class does not exist.")

        # Check for duplicate timetable slot for the class on this day and period
        dup_check = supabase.table("timetable").select("id").eq("class_id", entry.class_id).eq("day", entry.day).eq("period_number", entry.period_number).execute()
        if dup_check.data:
            raise HTTPException(
                status_code=400,
                detail=f"A timetable slot already exists for this class on {entry.day}, Period {entry.period_number}."
            )

        # Ensure start_time and end_time match period standards if not already set correctly
        if entry.period_number in DEFAULT_PERIOD_TIMINGS:
            standard_timing = DEFAULT_PERIOD_TIMINGS[entry.period_number]
            if not entry.start_time:
                entry.start_time = standard_timing["start_time"]
            if not entry.end_time:
                entry.end_time = standard_timing["end_time"]
            
        # If class has no advisor set yet and current user is advisor, link them
        if class_res.data[0].get("advisor_id") is None and staff_id:
            supabase.table("classes").update({"advisor_id": staff_id}).eq("id", entry.class_id).execute()
            
        # Resilient insertion: support databases with or without faculty_name column
        entry_payload = entry.dict()
        entry_payload.pop("class_name", None)
        entry_payload.pop("subject_name", None)
        try:
            res = supabase.table("timetable").insert(entry_payload).execute()
        except Exception as insert_err:
            if "faculty_name" in str(insert_err):
                entry_payload.pop("faculty_name", None)
                res = supabase.table("timetable").insert(entry_payload).execute()
            else:
                raise insert_err

        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{entry_id}")
def update_timetable_entry(entry_id: str, entry: TimetableEntry, current_user: CurrentUser = Depends(get_current_advisor)):
    try:
        resolve_timetable_entry(entry, current_user)
        # Check if entry exists
        tt_res = supabase.table("timetable").select("id").eq("id", entry_id).execute()
        if not tt_res.data:
            raise HTTPException(status_code=404, detail="Timetable entry not found.")

        # Check for duplicate slot on the same day and period for this class (excluding this entry_id)
        dup_check = supabase.table("timetable").select("id").eq("class_id", entry.class_id).eq("day", entry.day).eq("period_number", entry.period_number).neq("id", entry_id).execute()
        if dup_check.data:
            raise HTTPException(
                status_code=400,
                detail=f"A timetable slot already exists for this class on {entry.day}, Period {entry.period_number}."
            )

        # Standardize period timings
        if entry.period_number in DEFAULT_PERIOD_TIMINGS:
            standard_timing = DEFAULT_PERIOD_TIMINGS[entry.period_number]
            if not entry.start_time:
                entry.start_time = standard_timing["start_time"]
            if not entry.end_time:
                entry.end_time = standard_timing["end_time"]

        entry_payload = entry.dict()
        entry_payload.pop("class_name", None)
        entry_payload.pop("subject_name", None)
        try:
            res = supabase.table("timetable").update(entry_payload).eq("id", entry_id).execute()
        except Exception as update_err:
            if "faculty_name" in str(update_err):
                entry_payload.pop("faculty_name", None)
                res = supabase.table("timetable").update(entry_payload).eq("id", entry_id).execute()
            else:
                raise update_err

        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{entry_id}")
def delete_timetable_entry(entry_id: str, current_user: CurrentUser = Depends(get_current_advisor)):
    try:
        tt_res = supabase.table("timetable").select("id").eq("id", entry_id).execute()
        if not tt_res.data:
            raise HTTPException(status_code=404, detail="Entry not found")
            
        supabase.table("timetable").delete().eq("id", entry_id).execute()
        return {"message": "Deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

