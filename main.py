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

def undo():
    global boxes, curr_box, frame, canvas
    if len(curr_box) == 1:
        mask = np.zeros(frame.shape[:2], dtype=np.uint8)
        cv2.circle(mask, (curr_box[0][0], curr_box[0][1]), 2, (256, 256, 256), -1)
        canvas = cv2.inpaint(canvas, mask, 3, cv2.INPAINT_TELEA)
        print("executed")
        curr_box = []
    elif len(boxes) >= 1:
        last_box = boxes[len(boxes)-1]
        mask = np.zeros(frame.shape[:2], dtype=np.uint8)
        cv2.circle(mask, (last_box[0][0], last_box[0][1]), 2, (256, 256, 256), -1)
        cv2.circle(mask, (last_box[1][0], last_box[1][1]), 2, (256, 256, 256), -1)
        cv2.rectangle(mask, (last_box[0][0], last_box[0][1]), (last_box[1][0], last_box[1][1]), (256, 256, 256), 1)
        canvas = cv2.inpaint(canvas, mask, 3, cv2.INPAINT_TELEA)
        print("executed")
        boxes.pop()

def on_click(x, y, button, pressed):
    global curr_box, boxes
    if pressed and button == Button.left:
        if window_x > 0 and window_x < width and window_y > 0 and window_y < height:
            cv2.circle(canvas, (window_x, window_y), 2, (256, 256, 256), -1)
            curr_box.append([window_x, window_y])
            if len(curr_box) == 2:
                cv2.rectangle(canvas, (curr_box[0][0], curr_box[0][1]), (curr_box[1][0], curr_box[1][1]), (256, 256, 256), 1)
                boxes.append(curr_box)
                curr_box = []


def inferrence():
    global t, client
    folder_path = Path('imageAssets')
    folder_path.mkdir(parents=True, exist_ok=True)
    contents = []
    if len(boxes) != 0:
        # Remove old saved crops so only the current selection is inferred.
        for file_path in folder_path.iterdir():
            if file_path.is_file():
                file_path.unlink()

        for i in boxes:
            cropped_frame = frame[i[0][1]:i[1][1], i[0][0]:i[1][0]]
            cv2.imwrite(folder_path / f'frame_{i[0][0]}_{i[0][1]}.jpg', cropped_frame)

    try:
        if len(boxes) != 0:
            for file_path in folder_path.iterdir():
                if file_path.is_file():
                    img = Image.open(file_path)
                    contents.append(img)
            prompt = "Describe what you see in all of the live camera frames and respond according to the JSON schema provided."
            contents = [prompt] + contents
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ReportList.model_json_schema(),
                    temperature=0.2
                )
            )
            json_res = json.loads(response.text)
            print("Gemini Response:", json_res)
            for report in json_res['reports']:
                logger.log_info(report['name'], report['humans'], report['machines'], report['description'])
    except Exception as e:
        print(f'ERROR : {e}')
        logger.log_error(f'{e}')

    t = threading.Timer(5.0, inferrence)
    t.start()

def activate():
    global active_state
    active_state = not active_state
    if active_state:
        inferrence_timer = threading.Timer(1.0, inferrence)
        inferrence_timer.start()
    else:
        try:
            t.cancel()
        except Exception as e:
            pass


listener = Listener(on_click=on_click)
listener.start()

# Target window title (e.g., "Untitled - Notepad" or "Google Chrome")
TARGET_WINDOW = "Video Feed" 
cap = cv2.VideoCapture(0)
canvas = None
inferrence_state = False
client = genai.Client()

boxes = []
curr_box = []

active_state = False

while True:
    ret, frame = cap.read()
    if not ret:
        print("Can't receive frame (stream end?). Exiting ...")
        break

    if canvas is None:
        canvas = np.zeros_like(frame)

    hwnd = win32gui.FindWindow(None, TARGET_WINDOW)
    window_text = win32gui.GetWindowText(hwnd)
    if hwnd:
        screen_x, screen_y = win32api.GetCursorPos()
        window_x, window_y = win32gui.ScreenToClient(hwnd, (screen_x, screen_y))
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top
    else:
        left, top, right, bottom, screen_x, screen_y, window_x, window_y = 0, 0, 0, 0, 0, 0, 0, 0
        
    frame = cv2.add(frame, canvas)

    if active_state:
        cv2.circle(frame, (10, 10), 5, (0, 256, 0), -1)
    else:
        cv2.circle(frame, (10, 10), 5, (0, 0, 256), -1)

    cv2.imshow("Video Feed", frame)
        
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        try:
            t.cancel()
        except Exception as e:
            pass
        listener.stop()
        cap.release()
        cv2.destroyAllWindows()
    elif key == ord('c'):
        canvas = np.zeros_like(frame)
        boxes = []
    elif key == ord('u'):
        undo()
    elif key == ord('i'):
        activate()