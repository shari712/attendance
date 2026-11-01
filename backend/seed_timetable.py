import sys
from database import supabase

def setup_timetable():
    print("1. Fetching or creating class...")
    classes = supabase.table("classes").select("*").execute().data
    if not classes:
        cls_res = supabase.table("classes").insert({
            "name": "CSE - Year 3 - Sec A",
            "department": "M.Tech CSE",
            "year": 3,
            "semester": 5,
            "section": "A"
        }).execute()
        target_class = cls_res.data[0]
    else:
        target_class = classes[0]
    
    class_id = target_class["id"]
    print(f"Target Class: {target_class['name']} ({class_id})")

    print("2. Ensuring all staff exist...")
    staff_list = [
        {"name": "Mr. K.A. Dhamotharan", "department": "M.Tech - CSE"},
        {"name": "Ms. N.R. Raghapriya", "department": "M.Tech - CSE"},
        {"name": "Mr. S. Mohankumar", "department": "M.Tech - CSE"},
        {"name": "Ms. M. LakshmiPriya", "department": "M.Tech - CSE"},
        {"name": "Mr. K. Gokul", "department": "M.Tech - CSE"},
        {"name": "Mr. A. Rajesh", "department": "M.Tech - CSE"},
        {"name": "Ms. S.M. Karpagavalli", "department": "M.Tech - CSE"},
        {"name": "Ms. P. Prema", "department": "Aptitude Trainer / T&P"},
    ]

    existing_staff = supabase.table("staff").select("*").execute().data or []
    staff_map = {}
    for stf in existing_staff:
        staff_map[stf["name"].lower()] = stf["id"]

    for stf in staff_list:
        name_key = stf["name"].lower()
        # Also check without spaces/dots
        found_id = None
        for k, v in staff_map.items():
            if name_key in k or k in name_key:
                found_id = v
                break
        if not found_id:
            res = supabase.table("staff").insert({
                "name": stf["name"],
                "department": stf["department"],
                "profile_id": None
            }).execute()
            if res.data:
                found_id = res.data[0]["id"]
                staff_map[name_key] = found_id
                print(f"Created staff: {stf['name']}")
        else:
            staff_map[name_key] = found_id

    # Helper to get staff id by partial name
    def get_staff_id(query):
        q = query.lower()
        for k, v in staff_map.items():
            if q in k:
                return v
        return list(staff_map.values())[0]

    print("3. Ensuring all subjects exist...")
    subjects_list = [
        {"code": "23CI501", "name": "Advanced Java Programming (AJP)"},
        {"code": "23CI502", "name": "Artificial Intelligence and Expert Systems (AIES)"},
        {"code": "23CI503", "name": "Theory of Computation (TOC)"},
        {"code": "23CI504", "name": "Computer Networks (CN) (Embedded)"},
        {"code": "23CIX03", "name": "Mobile Application Development (MAD)"},
        {"code": "23CIX07", "name": "Cloud Computing (CC)"},
        {"code": "23EBC01", "name": "Entrepreneurship and Business Incubation (EBI)"},
        {"code": "23TPS05", "name": "Quantitative Aptitude and Logical Reasoning - III (QALR-III)"},
        {"code": "23CI505", "name": "Advanced Java Programming Laboratory (AJP LAB)"},
        {"code": "23CI506", "name": "Computer Networks Laboratory (CN LAB)"},
        {"code": "LIB", "name": "Library"},
    ]

    existing_subjects = supabase.table("subjects").select("*").execute().data or []
    subject_map = {}
    for sub in existing_subjects:
        subject_map[sub["code"].upper()] = sub["id"]

    for sub in subjects_list:
        code_key = sub["code"].upper()
        if code_key not in subject_map:
            res = supabase.table("subjects").insert({
                "code": sub["code"],
                "name": sub["name"]
            }).execute()
            if res.data:
                subject_map[code_key] = res.data[0]["id"]
                print(f"Created subject: {sub['code']} - {sub['name']}")
        else:
            # Optionally update name if needed
            supabase.table("subjects").update({"name": sub["name"]}).eq("id", subject_map[code_key]).execute()

    print("4. Clearing existing timetable for this class...")
    supabase.table("timetable").delete().eq("class_id", class_id).execute()

    period_times = {
        1: ("09:30", "10:20"),
        2: ("10:20", "11:10"),
        3: ("11:25", "12:15"),
        4: ("12:15", "13:05"),
        5: ("14:00", "14:50"),
        6: ("14:50", "15:40"),
        7: ("15:40", "16:30"),
    }

    room = "CH LH 11"

    # Define exact timetable grid
    # (Day, Period, Subject Code, Faculty partial query, optional room)
    slots = [
        # Monday
        ("Monday", 1, "23CI504", "LakshmiPriya", room),
        ("Monday", 2, "23CIX03", "Gokul", room),
        ("Monday", 3, "23CI501", "Dhamotharan", room),
        ("Monday", 4, "23CI502", "Raghapriya", room),
        ("Monday", 5, "23CI505", "Dhamotharan", "CH LH 11 / AJP LAB"),
        ("Monday", 6, "23CI505", "Dhamotharan", "CH LH 11 / AJP LAB"),
        ("Monday", 7, "23CI505", "Dhamotharan", "CH LH 11 / AJP LAB"),

        # Tuesday
        ("Tuesday", 1, "LIB", "Raghapriya", "CH LH 11 / Library"),
        ("Tuesday", 2, "23CIX07", "Rajesh", room),
        ("Tuesday", 3, "23CI503", "Mohankumar", room),
        ("Tuesday", 4, "23CI501", "Dhamotharan", room),
        ("Tuesday", 5, "23CIX03", "Gokul", room),
        ("Tuesday", 6, "23CIX07", "Rajesh", room),
        ("Tuesday", 7, "23CI504", "LakshmiPriya", room),

        # Wednesday
        ("Wednesday", 1, "23CI503", "Mohankumar", room),
        ("Wednesday", 2, "23EBC01", "Karpagavalli", room),
        ("Wednesday", 3, "23EBC01", "Karpagavalli", room),
        ("Wednesday", 4, "23EBC01", "Karpagavalli", room),
        ("Wednesday", 5, "23CI501", "Dhamotharan", room),
        ("Wednesday", 6, "23EBC01", "Karpagavalli", room),
        ("Wednesday", 7, "23CIX07", "Rajesh", room),

        # Thursday
        ("Thursday", 1, "23CIX03", "Gokul", room),
        ("Thursday", 2, "23CI501", "Dhamotharan", room),
        ("Thursday", 3, "23CI503", "Mohankumar", room),
        ("Thursday", 4, "23CIX07", "Rajesh", room),
        ("Thursday", 5, "23CI504", "LakshmiPriya", room),
        ("Thursday", 6, "23CI502", "Raghapriya", room),
        ("Thursday", 7, "23CIX03", "Gokul", room),

        # Friday
        ("Friday", 1, "23TPS05", "Prema", room),
        ("Friday", 2, "23TPS05", "Prema", room),
        ("Friday", 3, "23CI502", "Raghapriya", room),
        ("Friday", 4, "23CI503", "Mohankumar", room),
        ("Friday", 5, "23CI506", "LakshmiPriya", "CH LH 11 / CN LAB"),
        ("Friday", 6, "23CI506", "LakshmiPriya", "CH LH 11 / CN LAB"),
        ("Friday", 7, "23CI506", "LakshmiPriya", "CH LH 11 / CN LAB"),

        # Saturday
        ("Saturday", 1, "23CI504", "LakshmiPriya", room),
        ("Saturday", 2, "23CI503", "Mohankumar", room),
        ("Saturday", 3, "23CI502", "Raghapriya", room),
        ("Saturday", 4, "23CIX07", "Rajesh", room),
        ("Saturday", 5, "23CIX03", "Gokul", room),
        ("Saturday", 6, "23CI501", "Dhamotharan", room),
        ("Saturday", 7, "23CI502", "Raghapriya", room),
    ]

    print(f"5. Inserting {len(slots)} timetable slots...")
    records_to_insert = []
    for day, period_num, sub_code, faculty_q, slot_room in slots:
        start_t, end_t = period_times[period_num]
        s_id = subject_map.get(sub_code.upper())
        f_id = get_staff_id(faculty_q)
        records_to_insert.append({
            "class_id": class_id,
            "subject_id": s_id,
            "faculty_id": f_id,
            "day": day,
            "period_number": period_num,
            "start_time": start_t,
            "end_time": end_t,
            "room": slot_room,
        })

    insert_res = supabase.table("timetable").insert(records_to_insert).execute()
    print(f"Successfully inserted {len(insert_res.data)} slots into timetable!")

if __name__ == "__main__":
    setup_timetable()
