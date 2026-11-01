from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from database import supabase
from datetime import date

# Import routers
from routers import students, attendance, auth, dashboard, timetable, alerts, profile

load_dotenv()

app = FastAPI(
    title="Intelligent Face Authentication & Attendance System",
    description="Backend API for managing attendance, users, and AI interactions.",
    version="1.0.0"
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(attendance.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(timetable.router)
app.include_router(alerts.router)
app.include_router(profile.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Smart Attendance API"}

@app.get("/api/dashboard")
def get_dashboard_stats():
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database not configured"
        )

    try:
        # Get total students
        total_res = (
            supabase.table("students")
            .select("id", count="exact")
            .execute()
        )

        total_students = (
            total_res.count
            if total_res.count is not None
            else 0
        )

        # Get today's attendance
        today = date.today().isoformat()

        att_res = (
            supabase.table("attendance")
            .select("id", count="exact")
            .eq("date", today)
            .execute()
        )

        present_today = (
            att_res.count
            if att_res.count is not None
            else 0
        )

        absent_today = max(
            total_students - present_today, 0
        )

        attendance_percentage = (
            round(
                (present_today / total_students) * 100, 2
            )
            if total_students > 0
            else 0
        )

        return {
            "total_students": total_students,
            "present_today": present_today,
            "absent_today": absent_today,
            "attendance_percentage": attendance_percentage,
            "active_cameras": 2,
            "unknown_faces": 0
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
