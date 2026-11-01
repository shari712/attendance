import asyncio
from database import supabase

def sync_records():
    # Get all profiles
    profiles = supabase.table("profiles").select("*").execute().data
    print(f"Found {len(profiles)} profiles.")
    
    for p in profiles:
        user_id = p["id"]
        role = p.get("role", "STUDENT")
        name = p.get("name") or "User"
        email = p.get("email")
        
        if role in ["STAFF", "CLASS_ADVISOR"]:
            # Check staff record
            staff = supabase.table("staff").select("*").eq("profile_id", user_id).execute().data
            if not staff:
                print(f"Creating staff record for {email} ({role})...")
                res = supabase.table("staff").insert({
                    "profile_id": user_id,
                    "name": name,
                    "department": "Computer Science"
                }).execute()
                print("Created staff:", res.data)
            else:
                print(f"Staff record already exists for {email}.")
                
        elif role == "STUDENT":
            student = supabase.table("students").select("*").eq("profile_id", user_id).execute().data
            if not student:
                print(f"Creating student record for {email}...")
                reg_no = "REG_" + user_id[:6]
                res = supabase.table("students").insert({
                    "profile_id": user_id,
                    "name": name,
                    "email": email,
                    "register_number": reg_no,
                    "department": "Computer Science"
                }).execute()
                print("Created student:", res.data)
            else:
                print(f"Student record already exists for {email}.")

    # Also check if a sample class exists, and link advisor if needed
    classes = supabase.table("classes").select("*").execute().data
    print(f"Found {len(classes)} classes.")
    if not classes:
        # Find advisor staff id
        advisor_prof = next((p for p in profiles if p.get("role") == "CLASS_ADVISOR"), None)
        advisor_staff_id = None
        if advisor_prof:
            staff_rec = supabase.table("staff").select("id").eq("profile_id", advisor_prof["id"]).execute().data
            if staff_rec:
                advisor_staff_id = staff_rec[0]["id"]
        
        print("Creating default class...")
        supabase.table("classes").insert({
            "name": "CSE - Year 3 - Sec A",
            "department": "Computer Science",
            "year": 3,
            "semester": 6,
            "section": "A",
            "advisor_id": advisor_staff_id
        }).execute()
        print("Created default class.")

if __name__ == "__main__":
    sync_records()
