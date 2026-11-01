import json
from database import supabase

def seed_demo_students():
    demo_students = [
        {'name': 'Harshini S', 'register_number': 'ES24CJ12', 'department': 'Computer Science', 'email': 'harshini@college.edu', 'year': 3, 'section': 'A'},
        {'name': 'Pooja Sri A', 'register_number': 'ES24CJ15', 'department': 'Computer Science', 'email': 'poojasri@college.edu', 'year': 3, 'section': 'A'},
        {'name': 'Dharani S', 'register_number': 'ES24CJ08', 'department': 'Computer Science', 'email': 'dharani@college.edu', 'year': 3, 'section': 'A'},
        {'name': 'Lalitha Shree', 'register_number': 'ES24CJ17', 'department': 'Computer Science', 'email': 'lathika@college.edu', 'year': 3, 'section': 'A'}
    ]

    for s in demo_students:
        exist = supabase.table('students').select('id').or_(f"register_number.eq.{s['register_number']},name.ilike.%{s['name']}%").execute().data
        if exist:
            s_id = exist[0]['id']
            supabase.table('students').update({
                'name': s['name'],
                'register_number': s['register_number'],
                'year': 3,
                'section': 'A'
            }).eq('id', s_id).execute()
            print('Updated student:', s['name'], s_id)
        else:
            ins = supabase.table('students').insert({
                'name': s['name'],
                'register_number': s['register_number'],
                'department': s['department'],
                'email': s['email'],
                'year': 3,
                'section': 'A'
            }).execute()
            s_id = ins.data[0]['id']
            print('Created student:', s['name'], s_id)

        # Check face_record
        f_rec = supabase.table('face_records').select('id').eq('student_id', s_id).execute().data
        if not f_rec:
            mock_encoding = [0.05 * ((i + len(s['name'])) % 10) for i in range(128)]
            supabase.table('face_records').insert({
                'student_id': s_id,
                'encoding_reference': json.dumps(mock_encoding)
            }).execute()
            print('Created face record for:', s['name'])
        else:
            print('Face record exists for:', s['name'])

if __name__ == '__main__':
    seed_demo_students()
