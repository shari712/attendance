import asyncio
from database import supabase

async def check_users():
    try:
        users = supabase.auth.admin.list_users()
        print(f"Found {len(users)} users in auth.users:")
        for user in users:
            print(f"- {user.email} (ID: {user.id})")
    except Exception as e:
        print(f"Error checking users: {e}")

if __name__ == "__main__":
    asyncio.run(check_users())
