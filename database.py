import ast
import threading
import json
from pathlib import Path
from typing import Any, List, Dict, cast
from postgrest import ReturnMethod
from supabase import create_client, Client

SUPABASE_URL = "https://rhfmgkhkarbwlqmutrle.supabase.co"
SUPABASE_KEY = "sb_publishable_4KcrZXeKIIMWHrHxj2_RHg_es2sYhsf"

# Initialize Supabase client for public schema operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def retrieve_uuid(email_id: str = '', pwd: str = ''):
    if not email_id or not pwd:
        print("ERROR: Invalid credentials")
        return
    try:
        response = supabase.table('users').select('log_table').eq('email_id', email_id).eq('password', pwd).execute()
        if not response.data:
            raise ValueError("No matching user found")
        table_data = cast(List[Dict[str, Any]], response.data)
        if table_data is not None:
            table_log = table_data[0]['log_table']
        with open('tableName.txt', 'w', encoding='utf-8') as file:
            file.write(table_log)
    except Exception as e:
        print(f"ERROR 2: {e}")


def _ensure_local_files():
    if not Path('app.log').exists():
        Path('app.log').write_text('', encoding='utf-8')
    if not Path('line.txt').exists():
        Path('line.txt').write_text('0', encoding='utf-8')
    if not Path('tableName.txt').exists():
        Path('tableName.txt').write_text('', encoding='utf-8')


def put_data():
    global t
    _ensure_local_files()
    last_processed = 0
    with open('line.txt', 'r', encoding='utf-8') as line_file:
        try:
            last_processed = int(line_file.read().strip() or '0')
        except ValueError:
            last_processed = 0

    with open('app.log', 'r', encoding='utf-8') as log_file:
        for line_num, raw_line in enumerate(log_file):
            if line_num < last_processed:
                continue
            parts = [part.strip() for part in raw_line.strip().split(' - ')]
            if len(parts) < 7:
                continue
            timestamp = parts[0]
            message_parts = parts[3:]
            fields = { }
            for item in message_parts:
                if ': ' in item:
                    key, value = item.split(': ', 1)
                    fields[key.lower()] = value.strip()
            if not all(k in fields for k in ('name', 'humans', 'machines', 'description')):
                continue
            machines_text = fields['machines']
            try:
                machines = ast.literal_eval(machines_text)
            except Exception:
                try:
                    machines = json.loads(machines_text.replace("'", '"'))
                except Exception:
                    machines = []
            with open('tableName.txt', 'r', encoding='utf-8') as table_name_file:
                table_id = table_name_file.read().strip()
            query = {
                'time_stamp': timestamp,
                'name': fields['name'],
                'humans': int(fields['humans']),
                'machines': machines,
                'description': fields['description'],
                'unique_id': table_id
            }
            try:
                response = supabase.table('logs').insert(query, returning=ReturnMethod.minimal).execute()
                print(response)
            except Exception as e:
                print(f"ERROR 3: {e}")
            last_processed = line_num + 1

    with open('line.txt', 'w', encoding='utf-8') as line_file:
        line_file.write(str(last_processed))

    t = threading.Timer(10.0, put_data)
    t.start()

def stop_db_write():
    try:
        t.cancel()
    except Exception as e:
        pass