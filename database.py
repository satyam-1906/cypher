import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
import os
import threading
import json
from psycopg2.extras import Json
from supabase import create_client, Client

SUPABASE_URL = "https://rhfmgkhkarbwlqmutrle.supabase.co"
SUPABASE_KEY = "sb_publishable_4KcrZXeKIIMWHrHxj2_RHg_es2sYhsf"

# Initialize Supabase client for public schema operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def retrieve_uuid(email_id:str=None, pwd:str=None):
    if email_id == None and pwd == None:
        print("ERROR: Invalid credentials")
        return
    try:
        response = supabase.table('users').select('log_table').eq('email_id', email_id).eq('password', pwd).execute()
        table_log = response.data[0]['log_table']
        with open('tableName.txt', 'w') as file:
            file.write(table_log)
    except Exception as e:
        print(f"ERROR: {e}")

def put_data():
    global t
    line_num = 0
    with open("app.log", 'r') as file:
        with open("line.txt", 'r') as line:
            start_line = int(line.readlines()[0])
        for line_num, line in enumerate(file, start=0):
            if start_line > line_num:
                continue
            arr = line.strip().split('-')
            arr.pop(4)
            arr.pop(4)
            arr.pop(3)
            arr[0] = arr[0] + '-' + arr[1] + '-' + arr[2][:11]
            arr.pop(1)
            arr.pop(1)
            for i in range(len(arr)):
                arr[i] = arr[i].strip()
            arr[1] = arr[1][6:]
            arr[2] = arr[2][8:]
            arr[3] = arr[3][10:]
            arr[4] = arr[4][13:]
            text = arr[3].replace('\'','"')
            json_text = json.loads(text)
            processed_array = [json_text]
            with open('tableName.txt', 'r') as table_name:
                table_id = table_name.readlines()[0].strip()
            query = {
                "time_stamp": arr[0],
                "name": arr[1],
                "humans": int(arr[2]),
                "machines": processed_array,
                "description": arr[4],
                "unique_id": table_id
            }
            try:
                response = supabase.table('logs').insert(query).execute()
                print(response)
            except Exception as e:
                print(f"ERROR: {e}")
        with open("line.txt", 'w') as line:
            if line_num != 0:
                line.write(f'{line_num+1}')
    
    t = threading.Timer(10.0, put_data)
    t.start()

def stop_db_write():
    try:
        t.cancel()
    except Exception as e:
        pass