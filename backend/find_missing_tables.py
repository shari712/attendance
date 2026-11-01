import asyncio
from database import supabase

async def check_tables():
    tables = [
        "profiles",
        "staff",
        "classes",
        "students",
        "subjects",
        "timetable",
        "attendance",
        "alerts",
        "face_records"
    ]
    
    missing = []
    print("Checking for missing tables...")
    for table in tables:
        try:
            res = supabase.table(table).select("*").limit(1).execute()
        except Exception as e:
            if "relation" in str(e).lower() and "does not exist" in str(e).lower():
                missing.append(table)
            else:
                missing.append(table)
                print(f"Error checking {table}: {e}")
                
    if missing:
        print(f"\nMissing tables found: {missing}")
    else:
        print("\nAll tables exist!")

if __name__ == "__main__":
    asyncio.run(check_tables())
