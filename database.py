import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
import os
import threading
import json
from psycopg2.extras import Json

load_dotenv()

def make_connection():
    global cursor, connection
    DATABASE_URL = os.getenv('DATABASE_URL')
    try:
        connection = psycopg2.connect(DATABASE_URL)
        cursor = connection.cursor()
    except Exception as e:
        print(f"ERROR: {e}")

def retrieve_table_name(email_id:str=None, pwd:str=None):
    if email_id == None and pwd == None:
        print("ERROR: Invalid credentials")
        return
    query = sql.SQL("SELECT log_table FROM users WHERE email_id = %s AND password = %s")
    try:
        cursor.execute(query, (email_id, pwd))
        connection.commit()
        table_log = cursor.fetchone()[0]
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
            processed_array = [Json(d) for d in json_text]
            
            # Read dynamic table name from environmental configuration
            with open('tableName.txt', 'r') as file:
                log_table = file.readlines()[0].strip()
            query = sql.SQL('INSERT INTO {} (time_stamp, name, humans, machines, description) VALUES (%s, %s, %s, %s::jsonb[], %s)').format(sql.Identifier(log_table))
            try:
                cursor.execute(query, (arr[0], arr[1], int(arr[2]), processed_array, arr[4]))
                connection.commit()
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
    cursor.close()
    connection.close()
