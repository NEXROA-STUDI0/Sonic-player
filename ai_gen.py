#!/usr/bin/env python3
"""
🎨 Quick AI Image Generator
Usage: python3 ai_gen.py "your prompt here"
"""

import sys
import requests
import urllib.parse
import os
import time

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generated")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate(prompt, width=1024, height=1024):
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&nologo=true"
    
    print(f"🎨 Generating: {prompt[:60]}...")
    response = requests.get(url, timeout=120)
    
    filename = f"img_{int(time.time())}.png"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    with open(filepath, "wb") as f:
        f.write(response.content)
    
    print(f"✅ Saved: {filepath}")
    return filepath

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 ai_gen.py \"your prompt\"")
        print("Example: python3 ai_gen.py \"luxurious nightclub in Cairo 4K\"")
        sys.exit(1)
    
    prompt = " ".join(sys.argv[1:])
    generate(prompt)
