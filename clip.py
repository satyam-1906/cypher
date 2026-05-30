from PIL import Image
from google import genai
from pydantic import BaseModel, Field
from typing import List, Optional
from google.genai import types
import json

client = genai.Client()
class Machines(BaseModel):
    name: str = Field(description="Name of the machine.")
    quantity: int = Field(description="Number of such machines.")

class Report(BaseModel):
    name: str = Field(description="Name or ID of scene.")
    humans: int = Field(description="Number of humans in the scene.")
    machines: List[Machines]
    description: str = Field(description="Basic and brief description of the scene.")

class ReportList(BaseModel):
    reports: List[Report]

# Load your local image file
image_path = "image.jpg"
img1 = Image.open(image_path)
img2 = Image.open("image1.jpg")

# Pass both the text prompt and the image object inside a list
response = client.models.generate_content(
    model="gemini-3.5-flash",
    contents=["Describe the context of both images and respond according to the JSON schema provided.", img1, img2],
    config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ReportList.model_json_schema(),
                    temperature=0.2
                )
)

json_res = json.loads(response.text)
print(json_res)
