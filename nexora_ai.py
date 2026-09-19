#!/usr/bin/env python3
import os, sys, json, time, base64, hashlib
import urllib.request, urllib.parse, urllib.error
from pathlib import Path

OUTPUT_DIR = Path("generated")
OUTPUT_DIR.mkdir(exist_ok=True)

def save_image(data, prefix="nexora"):
    ts = int(time.time())
    h = hashlib.md5(data[:1000]).hexdigest()[:8]
    out = OUTPUT_DIR / f"{prefix}_{ts}_{h}.png"
    out.write_bytes(data)
    print(f"[+] Saved: {out} ({len(data)//1024}KB)")
    return out

def api_request(url, headers=None, data=None, method="GET", timeout=120):
    headers = headers or {}
    if data and isinstance(data, dict):
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:500]
        print(f"[!] HTTP {e.code}: {body}")
        return None, e.code
    except Exception as e:
        print(f"[!] Request error: {e}")
        return None, 0


class CloudflareAI:
    MODELS = {
        "flux-schnell": "@cf/black-forest-labs/flux-1-schnell",
        "flux-2-klein": "@cf/black-forest-labs/flux-2-klein-4b",
        "sdxl": "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    }
    def __init__(self):
        self.account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        self.api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
        self.available = bool(self.account_id and self.api_token)

    def generate(self, prompt, model="flux-schnell", width=1024, height=1024):
        if not self.available:
            print("[~] Cloudflare: set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN")
            return None
        model_id = self.MODELS.get(model, self.MODELS["flux-schnell"])
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{model_id}"
        data, status = api_request(url, {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }, {"prompt": prompt, "width": width, "height": height, "num_steps": 4}, "POST", 120)
        if data and status == 200:
            return save_image(data, f"cf_{model}")
        return None


class TogetherAI:
    def __init__(self):
        self.api_key = os.environ.get("TOGETHER_API_KEY")
        self.available = bool(self.api_key)

    def generate(self, prompt, width=1024, height=1024):
        if not self.available:
            print("[~] Together: get free key at together.ai")
            return None
        data, status = api_request(
            "https://api.together.xyz/v1/images/generations",
            {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            {"model": "black-forest-labs/FLUX.1-schnell-Free", "prompt": prompt,
             "width": width, "height": height, "steps": 4, "n": 1, "response_format": "b64_json"},
            "POST", 120
        )
        if data and status == 200:
            result = json.loads(data)
            img = base64.b64decode(result["data"][0]["b64_json"])
            return save_image(img, "together")
        return None


class SiliconFlowAI:
    def __init__(self):
        self.api_key = os.environ.get("SILICONFLOW_API_KEY")
        self.available = bool(self.api_key)

    def generate(self, prompt, width=1024, height=1024):
        if not self.available:
            print("[~] SiliconFlow: get free $1 at siliconflow.cn")
            return None
        data, status = api_request(
            "https://api.siliconflow.cn/v1/images/generations",
            {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            {"model": "black-forest-labs/FLUX.1-schnell", "prompt": prompt,
             "image_size": f"{width}x{height}", "batch_size": 1},
            "POST", 120
        )
        if data and status == 200:
            result = json.loads(data)
            img_url = result["data"][0].get("url")
            if img_url:
                img_data, _ = api_request(img_url)
                if img_data:
                    return save_image(img_data, "siliconflow")
        return None


class SegmindAPI:
    def __init__(self):
        self.api_key = os.environ.get("SEGMIND_API_KEY")
        self.available = bool(self.api_key)

    def generate(self, prompt, model="sdxl1024"):
        if not self.available:
            print("[~] Segmind: get free key at segmind.com (100 free credits/day)")
            return None
        url = f"https://api.segmind.com/v1/{model}"
        data, status = api_request(url, {
            "x-api-key": self.api_key, "Content-Type": "application/json",
        }, {"prompt": prompt}, "POST", 120)
        if data and status == 200:
            return save_image(data, f"segmind_{model}")
        return None


class HuggingFaceAPI:
    def __init__(self):
        self.api_key = os.environ.get("HF_API_KEY")
        self.available = bool(self.api_key)

    def generate(self, prompt, model="black-forest-labs/FLUX.1-schnell"):
        if not self.available:
            print("[~] HuggingFace: get free key at huggingface.co/settings/tokens")
            return None
        url = f"https://api-inference.huggingface.co/models/{model}"
        data, status = api_request(url, {
            "Authorization": f"Bearer {self.api_key}",
        }, {"inputs": prompt}, "POST", 180)
        if data and status == 200:
            return save_image(data, "hf")
        return None


class PollinationsAPI:
    def generate(self, prompt, width=1024, height=1024):
        encoded = urllib.parse.quote(prompt)
        seed = int(time.time()) % 100000
        url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&seed={seed}&model=flux"
        print("[*] Pollinations.ai generating (free, no key)...")
        data, status = api_request(url, timeout=180)
        if data and status == 200:
            return save_image(data, "pollinations")
        return None


class NovitaVideoAPI:
    def __init__(self):
        self.api_key = os.environ.get("NOVITA_API_KEY")
        self.available = bool(self.api_key)

    def generate(self, prompt, model="cogvideox"):
        if not self.available:
            print("[~] Novita: get free key at novita.ai")
            return None
        url = "https://api.novita.ai/v3/async/t2v"
        data, status = api_request(url, {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }, {"model_name": model, "prompt": prompt, "guidance_scale": 7.5,
            "num_inference_steps": 50}, "POST", 60)
        if data and status == 200:
            result = json.loads(data)
            task_id = result.get("task_id")
            if task_id:
                print(f"[*] Video task {task_id}, polling...")
                for _ in range(60):
                    time.sleep(5)
                    check_data, _ = api_request(
                        f"https://api.novita.ai/v3/async/task-result?task_id={task_id}",
                        {"Authorization": f"Bearer {self.api_key}"}
                    )
                    if check_data:
                        status_result = json.loads(check_data)
                        if status_result.get("task_status") == "SUCCEED":
                            vid_url = status_result["video"]["video_url"]
                            vid_data, _ = api_request(vid_url)
                            if vid_data:
                                ts = int(time.time())
                                out = OUTPUT_DIR / f"novita_video_{ts}.mp4"
                                out.write_bytes(vid_data)
                                print(f"[+] Saved: {out}")
                                return out
                        elif status_result.get("task_status") == "FAILED":
                            print(f"[!] Video failed: {status_result}")
                            return None
        return None


class NEXORAStudio:
    def __init__(self):
        self.cloudflare = CloudflareAI()
        self.together = TogetherAI()
        self.siliconflow = SiliconFlowAI()
        self.segmind = SegmindAPI()
        self.hf = HuggingFaceAPI()
        self.pollinations = PollinationsAPI()
        self.novita = NovitaVideoAPI()

    def generate_image(self, prompt, method="best", width=1024, height=1024):
        print(f"\n{'='*60}")
        print(f"NEXORA AI Studio - Image Generation")
        print(f"Prompt: {prompt}")
        print(f"{'='*60}\n")

        if method == "best":
            providers = [
                ("Cloudflare FLUX", lambda: self.cloudflare.generate(prompt, "flux-schnell", width, height)),
                ("Cloudflare FLUX 2 Klein", lambda: self.cloudflare.generate(prompt, "flux-2-klein", width, height)),
                ("Cloudflare SDXL", lambda: self.cloudflare.generate(prompt, "sdxl", width, height)),
                ("Together FLUX", lambda: self.together.generate(prompt, width, height)),
                ("SiliconFlow FLUX", lambda: self.siliconflow.generate(prompt, width, height)),
                ("HuggingFace FLUX", lambda: self.hf.generate(prompt)),
                ("Pollinations", lambda: self.pollinations.generate(prompt, width, height)),
            ]
            for name, gen in providers:
                print(f"[*] Trying {name}...")
                result = gen()
                if result:
                    print(f"\n[SUCCESS] Generated with {name}!")
                    return result
            print("[!] All providers failed")
            return None
        elif method == "cloudflare":
            return self.cloudflare.generate(prompt, "flux-schnell", width, height)
        elif method == "together":
            return self.together.generate(prompt, width, height)
        elif method == "siliconflow":
            return self.siliconflow.generate(prompt, width, height)
        elif method == "huggingface":
            return self.hf.generate(prompt)
        elif method == "pollinations":
            return self.pollinations.generate(prompt, width, height)
        return None

    def generate_video(self, prompt):
        print(f"\n{'='*60}")
        print(f"NEXORA AI Studio - Video Generation")
        print(f"Prompt: {prompt}")
        print(f"{'='*60}\n")
        return self.novita.generate(prompt)


def show_help():
    print("""
============================================================
          NEXORA AI Studio - Free Generator
============================================================

  FREE APIs (No credit card required):
  
  1. Cloudflare Workers AI
     Free: 10,000 neurons/day
     Models: FLUX Schnell, FLUX 2 Klein, SDXL
     Quality: 5/5
     Setup: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
     Get: https://dash.cloudflare.com (sign up free)
  
  2. Together.ai
     Free: $1 credit on signup
     Models: FLUX.1-schnell-Free
     Quality: 5/5
     Setup: TOGETHER_API_KEY
     Get: https://together.ai (sign up free)
  
  3. SiliconFlow
     Free: $1 credit
     Models: FLUX.1-schnell
     Quality: 4/5
     Setup: SILICONFLOW_API_KEY
     Get: https://siliconflow.cn (sign up free)
  
  4. HuggingFace
     Free: Rate limited
     Models: FLUX, SD
     Quality: 5/5
     Setup: HF_API_KEY
     Get: https://huggingface.co/settings/tokens
  
  5. Segmind
     Free: 100 credits/day
     Models: SDXL, FLUX
     Quality: 4/5
     Setup: SEGMIND_API_KEY
     Get: https://segmind.com (sign up free)
  
  6. Pollinations.ai
     Free: Unlimited (rate limited)
     Quality: 2/5 (fallback only)
     Setup: None required

  USAGE:
    python3 nexora_ai.py "your prompt"
    python3 nexora_ai.py "prompt" --method cloudflare
    python3 nexora_ai.py "prompt" --method best
    python3 nexora_ai.py "prompt" --video
    python3 nexora_ai.py --setup
""")


def show_setup():
    print("""
============================================================
  NEXORA AI Studio - Setup Guide
============================================================

  Step 1: Create free accounts (all free, no credit card):
  
  A) Cloudflare (best quality, 10k free/day):
     1. Go to https://dash.cloudflare.com/sign-up
     2. Create free account
     3. Go to "My Profile" > "API Tokens" > "Create Token"
     4. Use "Workers AI" template
     5. Copy Token and Account ID
     6. Set environment variables:
        export CLOUDFLARE_ACCOUNT_ID="your_account_id"
        export CLOUDFLARE_API_TOKEN="your_token"
  
  B) Together.ai ($1 free credit):
     1. Go to https://together.ai/sign-up
     2. Sign up with GitHub/Google
     3. Go to API Keys
     4. Create new key
     5. Set: export TOGETHER_API_KEY="your_key"
  
  C) SiliconFlow ($1 free credit):
     1. Go to https://cloud.siliconflow.cn
     2. Sign up
     3. Go to API Keys
     4. Set: export SILICONFLOW_API_KEY="your_key"

  Step 2: Add to your shell profile (~/.bashrc or ~/.zshrc):
     export CLOUDFLARE_ACCOUNT_ID="xxx"
     export CLOUDFLARE_API_TOKEN="xxx"
     export TOGETHER_API_KEY="xxx"
     export SILICONFLOW_API_KEY="xxx"

  Step 3: Test:
     python3 nexora_ai.py "a beautiful sunset"
""")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ["-h", "--help"]:
        show_help()
        sys.exit(0)
    if args[0] == "--setup":
        show_setup()
        sys.exit(0)

    prompt = args[0]
    method = "best"
    video = False
    width = 1024
    height = 1024
    i = 1
    while i < len(args):
        if args[i] == "--method" and i + 1 < len(args):
            method = args[i + 1]
            i += 2
        elif args[i] == "--video":
            video = True
            i += 1
        elif args[i] == "--width" and i + 1 < len(args):
            width = int(args[i + 1])
            i += 2
        elif args[i] == "--height" and i + 1 < len(args):
            height = int(args[i + 1])
            i += 2
        else:
            i += 1

    studio = NEXORAStudio()
    if video:
        studio.generate_video(prompt)
    else:
        studio.generate_image(prompt, method=method, width=width, height=height)
