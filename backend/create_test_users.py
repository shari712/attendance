import asyncio
from database import supabase

async def create_users():
    users = [
        {"email": "staff1@test.com", "password": "password123", "role": "STAFF"},
        {"email": "advisor1@test.com", "password": "password123", "role": "CLASS_ADVISOR"},
        {"email": "student1@test.com", "password": "password123", "role": "STUDENT"},
    ]
    
    for u in users:
        print(f"Signing up {u['email']}...")
        try:
            res = supabase.auth.admin.create_user({
                "email": u["email"], 
                "password": u["password"],
                "email_confirm": True,
                "user_metadata": {
                    "full_name": "Test " + u["role"]
                }
            })
            if res.user:
                print(f"Created {u['email']} (ID: {res.user.id}). Updating role to {u['role']}...")
                # Update profiles role directly
                update_res = supabase.table("profiles").update({"role": u["role"]}).eq("id", res.user.id).execute()
                print("Profile updated:", update_res)
                
                # Create role-specific records
                if u["role"] == "STUDENT":
                    supabase.table("students").insert({"profile_id": res.user.id, "name": "Test Student", "register_number": "STU001", "email": u["email"]}).execute()
                else:
                    supabase.table("staff").insert({"profile_id": res.user.id, "name": f"Test {u['role']}"}).execute()
        except Exception as e:
            print(f"Error creating {u['email']}: {e}")

if __name__ == "__main__":
    asyncio.run(create_users())
