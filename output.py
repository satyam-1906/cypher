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


def on_click(x, y, button, pressed):
    global curr_box, boxes
    if pressed and button == Button.left:
        if window_x > 0 and window_x < width and window_y > 0 and window_y < height:
            cv2.circle(canvas, (window_x, window_y), 2, (256, 256, 256), -1)
            curr_box.append([window_x, window_y])
            if len(curr_box) == 2:
                cv2.rectangle(canvas, (curr_box[0][0], curr_box[0][1]), (curr_box[1][0], curr_box[1][1]), (256, 256, 256), 1)
                boxes.append(curr_box)
                cropped_frame = frame[curr_box[0][1]:curr_box[1][1], curr_box[0][0]:curr_box[1][0]]
                cv2.imwrite('imageAssets/output.jpg', cropped_frame)
                curr_box = []

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
    cv2.imshow("Video Feed", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        listener.stop()
        cap.release()
        cv2.destroyAllWindows()
    elif key == ord('c'):
        canvas = np.zeros_like(frame)
        boxes = []