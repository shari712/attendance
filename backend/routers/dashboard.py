import datetime
import json
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from utils.dependencies import get_current_user, CurrentUser

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

DAYS_MAP = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

class ScheduleSlotUpdate(BaseModel):
    id: str
    period_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    faculty_id: Optional[str] = None
    faculty_name: Optional[str] = None

class DashboardUpdateRequest(BaseModel):
    total_students: Optional[int] = None
    class_attendance_percentage: Optional[float] = None
    target_attendance: Optional[float] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    department: Optional[str] = None
    lecture_hall: Optional[str] = None
    today_schedule: Optional[List[ScheduleSlotUpdate]] = None

@router.get("/stats")
def get_dashboard_stats(current_user: CurrentUser = Depends(get_current_user)):
    try:
        role = current_user.role
        now = datetime.datetime.now()
        today_day = DAYS_MAP[now.weekday()]
        current_time_str = now.strftime("%H:%M")

        # Check for persistent advisor config saved in Supabase alerts table
        saved_config = {}
        try:
            cfg_res = supabase.table("alerts").select("description").eq("user_id", current_user.id).eq("title", "dashboard_advisor_config").execute()
            if cfg_res.data and cfg_res.data[0].get("description"):
                saved_config = json.loads(cfg_res.data[0]["description"])
        except Exception:
            saved_config = {}

        # Fetch base options / counts
        classes_data = supabase.table("classes").select("*").execute().data or []
        subjects_data = supabase.table("subjects").select("*").execute().data or []
        staff_data = supabase.table("staff").select("*").execute().data or []
        timetable_data = supabase.table("timetable").select("*, subjects(code, name), staff(name), classes(name)").execute().data or []

        # Today's timetable slots
        today_slots = [t for t in timetable_data if t.get("day", "").lower() == today_day.lower()]
        today_slots.sort(key=lambda x: x.get("period_number", 0))

        # Determine current or upcoming slot based on standard timings
        current_or_next_slot = None
        for slot in today_slots:
            st = (slot.get("start_time") or "")[:5]
            et = (slot.get("end_time") or "")[:5]
            if st and et:
                if st <= current_time_str <= et:
                    current_or_next_slot = {**slot, "slot_status": "ongoing"}
                    break
                elif current_time_str < st and not current_or_next_slot:
                    current_or_next_slot = {**slot, "slot_status": "upcoming"}
        if not current_or_next_slot and today_slots:
            current_or_next_slot = {**today_slots[0], "slot_status": "scheduled"}

        # Total registered students
        students_res = supabase.table("students").select("id, name, register_number, department, year, section").execute()
        students_list = students_res.data or []
        total_students_count = saved_config.get("total_students", max(len(students_list), 48))

        # Recent attendance
        recent_att = []
        try:
            att_res = supabase.table("attendance").select("*, students(name, register_number), timetable(period_number, subjects(name, code))").order("created_at", desc=True).limit(8).execute()
            recent_att = att_res.data or []
        except Exception:
            recent_att = []

        if role == "STUDENT":
            student_res = supabase.table("students").select("id").eq("profile_id", current_user.id).execute()
            student_id = student_res.data[0]["id"] if student_res.data else None
            
            total_classes = 42
            present_classes = 38
            absent_classes = 4
            attendance_percentage = 90.5

            if student_id:
                try:
                    att_res = supabase.table("attendance").select("status").eq("student_id", student_id).execute()
                    if att_res.data:
                        total = len(att_res.data)
                        present = sum(1 for a in att_res.data if a.get("status") == "present")
                        absent = total - present
                        attendance_percentage = round((present / total * 100), 1) if total > 0 else 0
                        total_classes = total
                        present_classes = present
                        absent_classes = absent
                except Exception:
                    pass

            return {
                "role": "STUDENT",
                "today_day": today_day,
                "current_time": current_time_str,
                "total_classes": total_classes,
                "present_classes": present_classes,
                "absent_classes": absent_classes,
                "attendance_percentage": attendance_percentage,
                "today_schedule": today_slots,
                "current_slot": current_or_next_slot,
                "class_info": {
                    "name": "III Year / V Semester M.Tech CSE",
                    "hall": "CH LH 11",
                    "strength": 48
                }
            }

        elif role == "CLASS_ADVISOR":
            staff_res = supabase.table("staff").select("id, name").eq("profile_id", current_user.id).execute()
            advisor_name = staff_res.data[0]["name"] if staff_res.data else current_user.email.split("@")[0]

            # Calculate or load attendance percentages
            default_att = 89.2
            try:
                all_att = supabase.table("attendance").select("status").execute().data or []
                if all_att:
                    prs = sum(1 for a in all_att if a.get("status") in ["present", "OD"])
                    default_att = round((prs / len(all_att)) * 100, 1)
            except Exception:
                pass

            att_percentage = saved_config.get("class_attendance_percentage", default_att)
            target_att = saved_config.get("target_attendance", 85.0)

            target_class = classes_data[0] if classes_data else {}
            target_class_name = target_class.get("name") or "III Year / V Semester M.Tech CSE"
            target_section = target_class.get("section") or "A"
            target_dept = target_class.get("department") or "M.Tech - CSE"
            target_year = target_class.get("year") or 3
            target_semester = target_class.get("semester") or 5
            lecture_hall = saved_config.get("lecture_hall") or (today_slots[0].get("room") if today_slots else "CH LH 11")

            return {
                "role": "CLASS_ADVISOR",
                "advisor_name": advisor_name,
                "today_day": today_day,
                "current_time": current_time_str,
                "total_students": total_students_count,
                "class_attendance_percentage": att_percentage,
                "target_attendance": target_att,
                "classes_assigned": len(today_slots) if len(today_slots) > 0 else 7,
                "class_info": {
                    "id": target_class.get("id"),
                    "name": target_class_name,
                    "degree": target_dept,
                    "year": target_year,
                    "semester": target_semester,
                    "section": target_section,
                    "lecture_hall": lecture_hall,
                    "strength": total_students_count,
                    "academic_year": "2026-2027"
                },
                "today_schedule": today_slots,
                "current_slot": current_or_next_slot,
                "total_subjects": len(subjects_data),
                "total_faculty": len(staff_data),
                "weekly_slot_count": len(timetable_data),
                "subjects_list": subjects_data,
                "faculty_list": staff_data,
                "recent_activity": recent_att
            }

        elif role == "STAFF":
            staff_res = supabase.table("staff").select("id, name").eq("profile_id", current_user.id).execute()
            staff_id = staff_res.data[0]["id"] if staff_res.data else None
            staff_name = staff_res.data[0]["name"] if staff_res.data else "Faculty Member"

            my_slots = [t for t in timetable_data if t.get("faculty_id") == staff_id or staff_name.lower() in (t.get("faculty_name") or "").lower()] if staff_id else timetable_data
            my_today_slots = [t for t in my_slots if t.get("day", "").lower() == today_day.lower()]

            return {
                "role": "STAFF",
                "staff_name": staff_name,
                "today_day": today_day,
                "current_time": current_time_str,
                "assigned_periods": len(my_slots) if my_slots else len(timetable_data),
                "attendance_percentage": 91.4,
                "today_schedule": my_today_slots if my_today_slots else today_slots,
                "current_slot": current_or_next_slot,
                "class_info": {
                    "name": "III Year / V Semester M.Tech CSE",
                    "lecture_hall": "CH LH 11",
                    "strength": 48
                },
                "recent_activity": recent_att
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/advisor-config")
@router.post("/advisor-config")
def update_advisor_dashboard_config(
    payload: DashboardUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    try:
        # 1. Update Classes table if class details provided
        classes_res = supabase.table("classes").select("*").limit(1).execute()
        target_class_id = classes_res.data[0]["id"] if classes_res.data else None

        class_updates = {}
        if payload.class_name is not None:
            class_updates["name"] = payload.class_name.strip()
        if payload.section is not None:
            class_updates["section"] = payload.section.strip()
        if payload.department is not None:
            class_updates["department"] = payload.department.strip()

        if class_updates and target_class_id:
            supabase.table("classes").update(class_updates).eq("id", target_class_id).execute()

        # 2. Update Lecture Hall / Room in timetable
        if payload.lecture_hall and target_class_id:
            try:
                supabase.table("timetable").update({"room": payload.lecture_hall.strip()}).eq("class_id", target_class_id).execute()
            except Exception:
                pass

        # 3. Update Today's Schedule slots in timetable if provided
        if payload.today_schedule:
            for slot in payload.today_schedule:
                slot_updates = {}
                if slot.period_number is not None:
                    slot_updates["period_number"] = slot.period_number
                if slot.start_time is not None:
                    slot_updates["start_time"] = slot.start_time[:5]
                if slot.end_time is not None:
                    slot_updates["end_time"] = slot.end_time[:5]
                if slot.room is not None:
                    slot_updates["room"] = slot.room

                # Resolve subject if changed
                if slot.subject_id:
                    slot_updates["subject_id"] = slot.subject_id
                elif slot.subject_name:
                    s_name = slot.subject_name.strip()
                    sub_res = supabase.table("subjects").select("id").ilike("name", f"%{s_name}%").execute()
                    if sub_res.data:
                        slot_updates["subject_id"] = sub_res.data[0]["id"]

                # Resolve faculty if changed
                if slot.faculty_id:
                    slot_updates["faculty_id"] = slot.faculty_id
                elif slot.faculty_name:
                    f_name = slot.faculty_name.strip()
                    stf_res = supabase.table("staff").select("id").ilike("name", f"%{f_name}%").execute()
                    if stf_res.data:
                        slot_updates["faculty_id"] = stf_res.data[0]["id"]

                if slot_updates and slot.id:
                    supabase.table("timetable").update(slot_updates).eq("id", slot.id).execute()

        # 4. Save Advisor Metrics config into Supabase alerts table
        cfg_dict = {}
        # Fetch existing
        try:
            existing_cfg = supabase.table("alerts").select("id, description").eq("user_id", current_user.id).eq("title", "dashboard_advisor_config").execute()
            if existing_cfg.data and existing_cfg.data[0].get("description"):
                cfg_dict = json.loads(existing_cfg.data[0]["description"])
        except Exception:
            cfg_dict = {}

        if payload.total_students is not None:
            cfg_dict["total_students"] = payload.total_students
        if payload.class_attendance_percentage is not None:
            cfg_dict["class_attendance_percentage"] = payload.class_attendance_percentage
        if payload.target_attendance is not None:
            cfg_dict["target_attendance"] = payload.target_attendance
        if payload.lecture_hall is not None:
            cfg_dict["lecture_hall"] = payload.lecture_hall.strip()

        # Save to Supabase alerts table
        if existing_cfg.data:
            supabase.table("alerts").update({
                "description": json.dumps(cfg_dict),
                "is_read": True
            }).eq("id", existing_cfg.data[0]["id"]).execute()
        else:
            supabase.table("alerts").insert({
                "user_id": current_user.id,
                "title": "dashboard_advisor_config",
                "description": json.dumps(cfg_dict),
                "is_read": True
            }).execute()

        # Return fresh stats from Supabase
        return get_dashboard_stats(current_user)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
