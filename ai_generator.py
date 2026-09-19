"""
🎨 Free AI Image & Video Generator
Uses Pollinations.ai - No API key, No signup, No credit card!
"""

import requests
import os
import time
import urllib.parse

# Output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_image(prompt: str, width: int = 1024, height: int = 1024, filename: str = None) -> str:
    """
    Generate an image using Pollinations.ai (FREE - No API key needed!)
    
    Args:
        prompt: Text description of the image
        width: Image width (default: 1024)
        height: Image height (default: 1024)
        filename: Custom filename (optional)
    
    Returns:
        Path to saved image
    """
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true"
    
    print(f"🎨 Generating image: {prompt[:50]}...")
    
    try:
        response = requests.get(url, timeout=120)
        response.raise_for_status()
        
        if not filename:
            filename = f"image_{int(time.time())}.png"
        
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"✅ Image saved: {filepath}")
        return filepath
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def generate_video(prompt: str, filename: str = None) -> str:
    """
    Generate a video using Pollinations.ai (FREE - No API key needed!)
    
    Args:
        prompt: Text description of the video
        filename: Custom filename (optional)
    
    Returns:
        Path to saved video
    """
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://video.pollinations.ai/prompt/{encoded_prompt}"
    
    print(f"🎬 Generating video: {prompt[:50]}...")
    
    try:
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        
        if not filename:
            filename = f"video_{int(time.time())}.mp4"
        
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"✅ Video saved: {filepath}")
        return filepath
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


def generate_image_cloudflare(prompt: str, api_token: str = None, account_id: str = None) -> str:
    """
    Generate an image using Cloudflare Workers AI (FREE tier: 100 requests/day)
    
    Args:
        prompt: Text description of the image
        api_token: Cloudflare API token
        account_id: Cloudflare account ID
    
    Returns:
        Path to saved image
    """
    if not api_token or not account_id:
        print("⚠️ Cloudflare requires API token and account ID")
        print("   Sign up free at: https://dash.cloudflare.com/sign-up")
        return None
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0"
    
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": prompt,
        "num_steps": 20,
        "width": 1024,
        "height": 1024
    }
    
    print(f"🎨 Generating image (Cloudflare): {prompt[:50]}...")
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        
        filename = f"cf_image_{int(time.time())}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"✅ Image saved: {filepath}")
        return filepath
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


# ==================== EXAMPLES ====================

if __name__ == "__main__":
    print("=" * 60)
    print("🎨 FREE AI Image & Video Generator")
    print("=" * 60)
    
    # Example 1: Generate Cairo Club image
    generate_image(
        prompt="Ultra-realistic 4K photograph of a luxurious nightclub in Cairo, Egypt. Gold and black decor, crystal chandeliers, LED dance floor, marble bar. Cairo Tower visible through windows at night.",
        width=1920,
        height=1080,
        filename="cairo_club_4k.png"
    )
    
    # Example 2: Generate Sonic Player promo image
    generate_image(
        prompt="Futuristic music streaming app interface on a sleek smartphone. Dark mode, neon blue and purple audio visualizer bars. Premium design, 4K quality.",
        width=1080,
        height=1080,
        filename="sonic_player_promo.png"
    )
    
    # Example 3: Generate NEXORA logo image
    generate_image(
        prompt="Modern minimalist tech company logo 'NEXORA' on dark background. Neon blue glow effect, clean typography, professional design.",
        width=1024,
        height=1024,
        filename="nexora_logo.png"
    )
    
    print("\n✅ All images generated! Check the 'generated' folder.")
