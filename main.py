from cv2.gapi import infer
from sqlalchemy import false
import win32gui
import win32api
import time
import cv2
from pynput.mouse import Listener
from pynput.mouse import Button
import numpy as np
from google import genai
from google.genai import types
import threading
from pydantic import BaseModel, Field
from typing import List, Optional
import logger
import json
from pathlib import Path
from PIL import Image
import database
import base64

class Machines(BaseModel):
    name: str = Field(description="Name of the machine.")
    quantity: int = Field(description="Number of such machines.")

class Report(BaseModel):
    name: str = Field(description="Name or ID of scene in the format frame_#.")
    humans: int = Field(description="Number of humans in the scene.")
    machines: List[Machines]
    description: str = Field(description="Basic and brief description of the scene.")

class ReportList(BaseModel):
    reports: List[Report]

def inferrence():
    global client
    file_path = 'videoAssets/output.mp4'
    if active_state:
        try:
            with open(file_path, 'rb') as video_file:
                base64_video = base64.b64encode(video_file.read())
            
            context_file = Path('context.json')
            if context_file.exists():
                with open(context_file, 'r') as file:
                    context = json.load(file)
            else:
                context = []
            
            if context:
                prompt = f"Analyse this context provided at the end of this prompt from previous frames of the surveillance footage and analyze the current surveillance footage and respond according to the JSON schema provided. Context: {context}"
            else:
                prompt = "Describe what you see in the live camera footage and respond according to the JSON schema provided."
            text_part = types.Part.from_text(text=prompt)
            video_part = types.Part.from_bytes(data=base64.b64decode(base64_video), mime_type='video/mp4')
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[text_part, video_part],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ReportList.model_json_schema(),
                    temperature=0.2
                )
            )
            json_res = json.loads(response.text or '')
            reports = json_res.get('reports', []) if isinstance(json_res, dict) else []
            print(reports)
            with open('context.json', 'w') as file:
                json.dump(reports, file)
            for report in reports:
                logger.log_info(report['name'], report['humans'], report['machines'], report['description'])
        except Exception as e:
            print(f'ERROR 1: {e}')
            logger.log_error(f'{e}')


def activate():
    global active_state
    active_state = not active_state
    if active_state:
        logger.log_activation('Inferrencing ACTIVATED.')
    else:
        logger.log_activation('Inferrencing DEACTIVATED')

def toggler():
    global record_state, toggle_timer
    if not record_state:
        create_writer()
        record_state = True
        toggle_timer = threading.Timer(5.0, toggler)
        toggle_timer.start()
    else:
        record_state = False
        time.sleep(1.0)
        out.release()
        inferrence()
        toggle_timer = threading.Timer(7.0, toggler)
        toggle_timer.start()



def create_writer():
    global out
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    if fps == 0:
        fps = 20
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')
    out = cv2.VideoWriter('videoAssets/output.mp4', fourcc, fps, (width, height))


email_id = input("Registered Email-ID: ")
pwd = input("Password: ")
camera_index = int(input("Select Camera (0 for primary/webcam, 1 for secondary cam): "))

database.retrieve_uuid(email_id, pwd)

active_state = False
record_state = False

folder_path = Path('videoAssets')
folder_path.mkdir(parents=True, exist_ok=True)

# Target window title (e.g., "Untitled - Notepad" or "Google Chrome")
TARGET_WINDOW = "Video Feed"
cap = cv2.VideoCapture(camera_index)
canvas = None
inferrence_state = False
client = genai.Client()

start_time = 0
curr_time = 0

t = threading.Timer(1.0, database.put_data)
t.start()

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Can't receive frame (stream end?). Exiting ...")
        break

    if canvas is None:
        canvas = np.zeros_like(frame)

    if active_state:
        cv2.circle(canvas, (10, 10), 5, (0, 256, 0), -1)
    else:
        cv2.circle(canvas, (10, 10), 5, (0, 0, 256), -1)
    cv2.putText(canvas, "INFERRENCING", (20, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (256, 256, 256), 1)

    if record_state:
        out.write(frame)

    frame = cv2.add(frame, canvas)

    cv2.imshow("Video Feed", frame)
        
    key = cv2.waitKey(25) & 0xFF
    if key == ord('q'):
        database.stop_db_write()
        try:
            toggle_timer.cancel()
            t.cancel()
        except Exception as e:
            pass
        cap.release()
        cv2.destroyAllWindows()
        database.stop_db_write()
        break
    elif key == ord('i'):
        try:
            toggle_timer.cancel()
        except Exception as e:
            pass
        activate()
        toggler()
        
