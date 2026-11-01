import asyncio
from database import supabase

async def fix_profiles():
    try:
        users = supabase.auth.admin.list_users()
        print(f"Found {len(users)} users in auth.users.")
        
        for user in users:
            email = user.email
            user_id = user.id
            name = user.user_metadata.get('full_name', 'Test User') if user.user_metadata else 'Test User'
            
            # Determine role based on email
            role = 'STUDENT'
            if 'staff' in email.lower():
                role = 'STAFF'
            elif 'advisor' in email.lower():
                role = 'CLASS_ADVISOR'
                
            print(f"Restoring profile for {email} as {role}...")
            
            # Insert into profiles
            try:
                res = supabase.table("profiles").insert({
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "role": role
                }).execute()
                print(f"  -> Restored successfully.")
            except Exception as e:
                print(f"  -> Error restoring profile: {e}")
                
    except Exception as e:
        print(f"Error listing users: {e}")

if __name__ == "__main__":
    asyncio.run(fix_profiles())
