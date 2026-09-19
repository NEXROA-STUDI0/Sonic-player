#!/usr/bin/env python3
"""
Sonic Player Backend — Zero dependencies (stdlib only)
Replaces FastAPI backend for Termux/Android compatibility.

All endpoints use Python's built-in http.server + json + subprocess + urllib.
No pip packages needed except yt-dlp (install via 'pkg install yt-dlp' on Termux).
"""

import http.server
import json
import os
import re
import shlex
import subprocess
import time
import urllib.parse
import urllib.request
import threading
import glob
import socketserver
from pathlib import Path

PORT = 8005
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sonic_cache.json')
DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
YTDLP_COOKIES = os.environ.get('SONIC_YTDLP_COOKIES', '').strip()
YTDLP_BROWSER = os.environ.get('SONIC_YTDLP_BROWSER', '').strip()

# ── Allowed domains for /proxy endpoint ──
ALLOWED_PROXY_DOMAINS = ('youtube.com', 'googlevideo.com', 'ytimg.com', 'lrclib.net')

# ── Rate limiting ──
rate_limit = {}
rate_limit_lock = threading.Lock()

# ── In-memory cache ──
cache = {'search': {}, 'stream_url': {}, 'lyrics': {}}
cache_lock = threading.Lock()


def save_cache():
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
    except:
        pass


def load_cache():
    global cache
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE) as f:
                data = json.load(f)
                with cache_lock:
                    cache.update(data)
    except:
        pass


load_cache()
os.makedirs(DOWNLOADS_DIR, exist_ok=True)


class SonicHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler for Sonic Player API."""

    def log_message(self, format, *args):
        """Quiet logging — only log errors."""
        if args and len(args) > 0 and '200' not in str(args[0]):
            print(f"[Sonic] {format % args}")

    def _send_json(self, data, status=200):
        """Send JSON response."""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Client disconnected — ignore

    def _send_error(self, msg, status=400):
        self._send_json({'error': msg}, status)

    def _send_file(self, filepath, media_type):
        """Send a file as binary response."""
        if not os.path.isfile(filepath):
            return self._send_error('file not found', 404)
        size = os.path.getsize(filepath)
        try:
            self.send_response(200)
            self.send_header('Content-Type', media_type)
            self.send_header('Content-Length', str(size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _proxy_stream(self, url):
        """Proxy a URL and stream its content."""
        if not self._is_allowed_proxy_url(url):
            return self._send_error('proxy domain not allowed', 403)
        try:
            parsed_url = urllib.parse.urlparse(url)
            is_googlevideo = 'googlevideo.com' in (parsed_url.hostname or '')
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
            }
            if is_googlevideo:
                headers['Origin'] = 'https://www.youtube.com'
                headers['Referer'] = 'https://www.youtube.com/'
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                content_type = resp.headers.get('Content-Type', 'audio/mpeg')
                content_length = resp.headers.get('Content-Length')
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Headers', '*')
                if content_length:
                    self.send_header('Content-Length', content_length)
                self.end_headers()
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except Exception as e:
            if not self.wfile.closed:
                self._send_error(f'proxy failed: {str(e)}', 502)

    def _is_allowed_proxy_url(self, url):
        """Check if URL domain is in the allowed list."""
        try:
            parsed = urllib.parse.urlparse(url)
            hostname = parsed.hostname or ''
            return any(hostname == d or hostname.endswith('.' + d) for d in ALLOWED_PROXY_DOMAINS)
        except Exception:
            return False

    def _get_params(self):
        """Parse query string parameters."""
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        return {k: v[0] for k, v in params.items()}

    def _get_int_param(self, params, name, default, minimum=None, maximum=None):
        """Parse and clamp an integer query parameter with a useful client error."""
        raw_value = params.get(name)
        if raw_value is None or raw_value.strip() == '':
            value = default
        else:
            try:
                value = int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f'{name} must be an integer') from exc

        if minimum is not None:
            value = max(value, minimum)
        if maximum is not None:
            value = min(value, maximum)
        return value

    def _sanitize_video_id(self, vid):
        """
        Validate video ID: must be exactly 11 chars of [a-zA-Z0-9_-].
        Returns the validated ID or None if invalid.
        """
        if not vid or not isinstance(vid, str):
            return None
        vid = vid.strip()
        if len(vid) != 11:
            return None
        if not re.match(r'^[a-zA-Z0-9_-]+$', vid):
            return None
        return vid

    def _sanitize_search_query(self, q):
        """
        Remove dangerous special characters from search query.
        Strips: ; | & ` $
        """
        if not q or not isinstance(q, str):
            return ''
        q = re.sub(r'[;&|`$]+', '', q)
        return q.strip()

    def _check_rate_limit(self):
        """
        Simple rate limiting: max 15 requests/second per IP.
        Returns True if allowed, False if rate limited.
        """
        ip = self.client_address[0]
        now = time.time()
        with rate_limit_lock:
            # Periodic cleanup of stale entries (every 2000 unique IPs)
            if len(rate_limit) > 2000:
                cutoff = now - 5
                stale = [k for k, (c, t) in rate_limit.items() if t < cutoff]
                for k in stale:
                    del rate_limit[k]

            if ip in rate_limit:
                count, first_time = rate_limit[ip]
                if now - first_time > 1:
                    # Reset sliding window
                    rate_limit[ip] = [1, now]
                    return True
                elif count >= 15:
                    return False
                else:
                    rate_limit[ip][0] += 1
                    return True
            else:
                rate_limit[ip] = [1, now]
                return True

    def _ytdlp_args(self, args):
        """Add optional user-provided YouTube authentication to yt-dlp calls."""
        auth_args = []
        if YTDLP_COOKIES and os.path.isfile(YTDLP_COOKIES):
            auth_args = ['--cookies', YTDLP_COOKIES]
        elif YTDLP_BROWSER:
            auth_args = ['--cookies-from-browser', YTDLP_BROWSER]
        return auth_args + args

    def _ytdlp_commands(self, args):
        """Build yt-dlp command fallbacks with the same authentication settings."""
        configured_args = self._ytdlp_args(args)
        return [
            ['yt-dlp'] + configured_args,
            ['python3', '-m', 'yt_dlp'] + configured_args,
            ['python', '-m', 'yt_dlp'] + configured_args,
        ]

    def _run_ytdlp(self, args, timeout=30):
        """Run yt-dlp with given args, return stdout."""
        # Clamp timeout to max 120 seconds
        timeout = min(timeout, 120)
        for cmd in self._ytdlp_commands(args):
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True, text=True, timeout=timeout,
                    errors='replace'
                )
                if result.returncode == 0 or result.stdout.strip():
                    return result.stdout.strip(), result.returncode
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                return '', 1
        return '', -1

    def _run_ytdlp_bytes(self, args, timeout=120):
        """Run yt-dlp and return binary stdout for download endpoints."""
        timeout = min(timeout, 120)
        for cmd in self._ytdlp_commands(args):
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=timeout)
                if result.returncode == 0 and result.stdout:
                    return result.stdout, result.returncode
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                return b'', 1
        return b'', -1

    def _route(self):
        """Route request to appropriate handler."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        method = self.command

        # ── Rate limiting (applied to all routes) ──
        if not self._check_rate_limit():
            return self._send_error('rate limit exceeded', 429)

        # CORS preflight
        if method == 'OPTIONS':
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.end_headers()
            return

        if method != 'GET':
            return self._send_error('method not allowed', 405)

        params = self._get_params()

        # ── Health ──
        if path == '/health' or path == '':
            return self._send_json({
                'status': 'ok',
                'cached_streams': len(cache.get('stream_url', {}))
            })

        # ── Search YouTube ──
        if path == '/search':
            q = params.get('q', '')
            if not q:
                return self._send_error('query required')
            q = self._sanitize_search_query(q)
            if not q:
                return self._send_error('invalid query after sanitization')
            try:
                limit = self._get_int_param(params, 'limit', 20, minimum=1, maximum=200)
                offset = self._get_int_param(params, 'offset', 0, minimum=0)
            except ValueError as exc:
                return self._send_error(str(exc), 400)
            return self._handle_search(q, limit, offset)

        # ── Search Playlists ──
        if path == '/search_playlists':
            q = params.get('q', '')
            if not q:
                return self._send_json({'playlists': []})
            q = self._sanitize_search_query(q)
            try:
                limit = self._get_int_param(params, 'limit', 10, minimum=1, maximum=20)
            except ValueError as exc:
                return self._send_error(str(exc), 400)
            return self._handle_search_playlists(q, limit)

        # ── Uploader Tracks ──
        if path == '/uploader_tracks':
            uploader = params.get('uploader', '')
            if not uploader:
                return self._send_json({'results': []})
            uploader = self._sanitize_search_query(uploader)
            try:
                limit = self._get_int_param(params, 'limit', 20, minimum=1, maximum=50)
            except ValueError as exc:
                return self._send_error(str(exc), 400)
            return self._handle_uploader_tracks(uploader, limit)

        # ── Stream URL ──
        m = re.match(r'^/stream/([a-zA-Z0-9_-]+)$', path)
        if m:
            return self._handle_stream(m.group(1))

        # ── Batch Stream URLs ──
        if path == '/batch_stream':
            ids_param = params.get('ids', '')
            if ids_param:
                ids = [i.strip() for i in ids_param.split(',') if i.strip()]
                return self._handle_batch_stream(ids)
            return self._send_json({'urls': {}})

        # ── Video Stream URL ──
        m = re.match(r'^/video_stream/([a-zA-Z0-9_-]+)$', path)
        if m:
            return self._handle_video_stream(m.group(1))

        # ── Info ──
        m = re.match(r'^/info/([a-zA-Z0-9_-]+)$', path)
        if m:
            return self._handle_info(m.group(1))

        # ── Lyrics ──
        if path == '/lyrics':
            title = params.get('title', '')
            artist = params.get('artist', '')
            return self._handle_lyrics(title, artist)

        # ── Proxy ──
        if path == '/proxy':
            url = params.get('url', '')
            if not url:
                return self._send_error('url required')
            if not self._is_allowed_proxy_url(url):
                return self._send_error('proxy domain not allowed', 403)
            return self._proxy_stream(url)

        # ── Stream Audio (direct playback via yt-dlp) ──
        m = re.match(r'^/play/([a-zA-Z0-9_-]+)$', path)
        if m:
            return self._handle_play(m.group(1))

        # ── Download ──
        m = re.match(r'^/download/([a-zA-Z0-9_-]+)$', path)
        if m:
            return self._handle_download(m.group(1))

        # ── Download Video ──
        m = re.match(r'^/download_video/([a-zA-Z0-9_-]+)$', path)
        if m:
            quality = params.get('quality', 'best')
            return self._handle_download_video(m.group(1), quality)

        # ── Download Local ──
        m = re.match(r'^/download_local/([a-zA-Z0-9_-]+)$', path)
        if m:
            title = params.get('title', '')
            return self._handle_download_local(m.group(1), title)

        # ── Local Play ──
        m = re.match(r'^/local_play/(.+)', path)
        if m:
            filename = m.group(1)
            filepath = os.path.join(DOWNLOADS_DIR, filename)
            # Prevent path traversal
            if '..' in filename or not os.path.realpath(filepath).startswith(os.path.realpath(DOWNLOADS_DIR)):
                return self._send_error('invalid path', 403)
            return self._send_file(filepath, 'audio/mp4')

        # ── Local List ──
        if path == '/local_list':
            return self._handle_local_list()

        # ── Country ──
        if path == '/country':
            return self._handle_country()

        # ── Trending ──
        if path == '/trending':
            country = params.get('country', '')
            country = self._sanitize_search_query(country)
            return self._handle_trending(country)

        # ── Check Local ──
        if path == '/check_local':
            video_id = params.get('video_id', '')
            return self._handle_check_local(video_id)

        # ── 404 ──
        self._send_error('not found', 404)

    # ── Handler Implementations ──

    def _handle_search(self, q, limit, offset):
        """Handle YouTube search (q is pre-sanitized)."""
        cache_key = f'search_{q}_{limit}'
        with cache_lock:
            if cache_key in cache.get('search', {}):
                entry = cache['search'][cache_key]
                if time.time() - entry.get('time', 0) < 1800:
                    sliced = entry['results'][offset:offset + limit]
                    return self._send_json({'results': sliced, 'total': len(entry['results']), 'cached': True})

        # Larger limit = more timeout
        search_timeout = min(30 + limit, 120)

        safe_q = shlex.quote(q)
        stdout, rc = self._run_ytdlp([
            '--quiet', '--no-warnings',
            '--dump-json', '--flat-playlist', '--ignore-errors',
            f'ytsearch{limit}:{safe_q}'
        ], timeout=search_timeout)

        if rc == -1:
            return self._send_json({'results': [], 'total': 0, 'error': 'yt-dlp not found. Install: pkg install yt-dlp'})

        tracks = self._parse_yt_search(stdout)
        with cache_lock:
            if 'search' not in cache:
                cache['search'] = {}
            cache['search'][cache_key] = {'results': tracks, 'time': time.time()}
        save_cache()
        sliced = tracks[offset:offset + limit]
        return self._send_json({'results': sliced, 'total': len(tracks)})

    def _parse_yt_search(self, stdout):
        """Parse yt-dlp flat JSON output into track list."""
        tracks = []
        for line in stdout.split('\n'):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            vid = entry.get('id', '')
            if not vid:
                continue
            tracks.append({
                'id': f'yt_{vid}',
                'title': entry.get('title', 'Unknown'),
                'artist': entry.get('uploader', 'Unknown'),
                'album': entry.get('album', '') or 'YouTube',
                'duration': entry.get('duration', 0) or 0,
                'cover': f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
                'audio': f'/stream/{vid}',
                'source': 'YouTube',
                'videoId': vid,
            })
        return tracks

    def _handle_search_playlists(self, q, limit):
        """Handle playlist search (q is pre-sanitized)."""
        cache_key = f'pl_{q}_{limit}'
        with cache_lock:
            if cache_key in cache and time.time() - cache.get(cache_key, {}).get('time', 0) < 1800:
                return self._send_json(cache[cache_key].get('data', {}))

        safe_q = shlex.quote(q)
        stdout, rc = self._run_ytdlp([
            '--quiet', '--no-warnings',
            '--dump-json', '--flat-playlist', '--ignore-errors',
            f'ytsearch{limit*3}:{safe_q}'
        ], timeout=30)

        if rc != 0 or not stdout:
            return self._send_json({'playlists': []})

        uploader_map = {}
        for line in stdout.split('\n'):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            vid = entry.get('id', '')
            if not vid:
                continue
            uploader = entry.get('uploader', 'Unknown')
            if uploader not in uploader_map:
                uploader_map[uploader] = {
                    'uploader': uploader,
                    'tracks': [],
                    'thumbnail': entry.get('thumbnail') or f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
                }
            uploader_map[uploader]['tracks'].append({
                'id': f'yt_{vid}',
                'title': entry.get('title', 'Unknown'),
                'duration': entry.get('duration', 0) or 0,
                'cover': f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
                'videoId': vid,
            })

        playlists = list(uploader_map.values())[:limit]
        data = {'playlists': playlists}
        with cache_lock:
            cache[cache_key] = {'data': data, 'time': time.time()}
        save_cache()
        return self._send_json(data)

    def _handle_uploader_tracks(self, uploader, limit):
        """Handle uploader tracks lookup (uploader is pre-sanitized)."""
        safe_uploader = shlex.quote(uploader)
        stdout, rc = self._run_ytdlp([
            '--quiet', '--no-warnings',
            '--dump-json', '--flat-playlist', '--ignore-errors',
            f'ytsearch{limit}:{safe_uploader}'
        ], timeout=30)

        if rc != 0 or not stdout:
            return self._send_json({'results': []})

        tracks = []
        for line in stdout.split('\n'):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue
            vid = entry.get('id', '')
            if not vid:
                continue
            tracks.append({
                'id': f'yt_{vid}',
                'title': entry.get('title', 'Unknown'),
                'artist': uploader,
                'album': 'YouTube',
                'duration': entry.get('duration', 0) or 0,
                'cover': f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
                'audio': f'/stream/{vid}',
                'source': 'YouTube',
                'videoId': vid,
            })

        return self._send_json({'results': tracks})

    def _handle_stream(self, video_id):
        """Get audio stream URL for a video."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        with cache_lock:
            if vid in cache.get('stream_url', {}):
                entry = cache['stream_url'][vid]
                cached_data = entry.get('data', {})
                if time.time() - entry.get('time', 0) < 7200 and cached_data.get('audio_url'):
                    return self._send_json(cached_data)

        audio_url, rc = self._run_ytdlp([
            '-g', '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '--no-warnings', '--quiet',
            f'https://www.youtube.com/watch?v={vid}'
        ], timeout=30)

        if not audio_url:
            audio_url, rc = self._run_ytdlp([
                '-g', '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ], timeout=30)

        if not audio_url:
            return self._send_json({
                'error': 'audio stream unavailable',
                'hint': 'YouTube may require authentication; set SONIC_YTDLP_COOKIES or SONIC_YTDLP_BROWSER',
                'video_id': vid,
            }, 503)

        data = {
            'title': '',
            'uploader': '',
            'duration': 0,
            'thumbnail': f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
            'audio_url': audio_url,
        }
        with cache_lock:
            if 'stream_url' not in cache:
                cache['stream_url'] = {}
            cache['stream_url'][vid] = {'data': data, 'time': time.time()}
        save_cache()
        return self._send_json(data)

    def _handle_batch_stream(self, video_ids):
        """Extract stream URLs for multiple videos in sequence (not parallel)."""
        urls = {}
        # Limit to first 5 to avoid blocking the server too long
        for raw_vid in video_ids[:5]:
            if not raw_vid:
                continue
            vid = self._sanitize_video_id(raw_vid)
            if not vid:
                continue
            # Check cache first
            with cache_lock:
                if vid in cache.get('stream_url', {}):
                    entry = cache['stream_url'][vid]
                    cached_url = entry.get('data', {}).get('audio_url', '')
                    if time.time() - entry.get('time', 0) < 7200 and cached_url:
                        urls[vid] = cached_url
                        continue
            # Extract
            audio_url, _ = self._run_ytdlp([
                '-g', '-f', 'bestaudio[ext=m4a]/bestaudio/best',
                '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ], timeout=30)
            if not audio_url:
                audio_url, _ = self._run_ytdlp([
                    '-g', '--no-warnings', '--quiet',
                    f'https://www.youtube.com/watch?v={vid}'
                ], timeout=30)
            if audio_url:
                urls[vid] = audio_url
                with cache_lock:
                    if 'stream_url' not in cache:
                        cache['stream_url'] = {}
                    cache['stream_url'][vid] = {'data': {'audio_url': audio_url}, 'time': time.time()}
                save_cache()
        return self._send_json({'urls': urls})

    def _handle_video_stream(self, video_id):
        """Get video stream URL."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        cache_key = f'video_{vid}'
        with cache_lock:
            cached_video = cache.get(cache_key, {})
            if cached_video.get('video_url') and time.time() - cached_video.get('time', 0) < 7200:
                return self._send_json(cached_video)

        video_url, rc = self._run_ytdlp([
            '-g', '-f', 'best[height<=720]',
            '--no-warnings', '--quiet',
            f'https://www.youtube.com/watch?v={vid}'
        ], timeout=30)

        if not video_url:
            video_url, rc = self._run_ytdlp([
                '-g', '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ], timeout=30)

        if not video_url:
            return self._send_json({
                'error': 'video stream unavailable',
                'hint': 'YouTube may require authentication; set SONIC_YTDLP_COOKIES or SONIC_YTDLP_BROWSER',
                'video_id': vid,
            }, 503)

        data = {'video_url': video_url}
        with cache_lock:
            cache[cache_key] = data
        save_cache()
        return self._send_json(data)

    def _handle_info(self, video_id):
        """Get video metadata (title, uploader, duration)."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        stdout, rc = self._run_ytdlp([
            '--print', 'title', '--print', 'uploader', '--print', 'duration',
            '--no-warnings', '--quiet',
            f'https://www.youtube.com/watch?v={vid}'
        ], timeout=15)

        if rc != 0 or not stdout:
            return self._send_json({'error': 'info failed'})

        lines = stdout.strip().split('\n')
        title = lines[0] if len(lines) > 0 else ''
        uploader = lines[1] if len(lines) > 1 else ''
        duration = lines[2] if len(lines) > 2 else '0'
        try:
            duration = int(float(duration))
        except Exception:
            duration = 0

        return self._send_json({
            'title': title,
            'uploader': uploader,
            'duration': duration,
            'thumbnail': f'https://img.youtube.com/vi/{vid}/hqdefault.jpg',
        })

    def _handle_lyrics(self, title, artist):
        """Fetch synced lyrics for a song."""
        if not title and not artist:
            return self._send_json({'lrc': '', 'source': 'none'})

        # Sanitize title/artist for cache key and API calls
        title = self._sanitize_search_query(title)
        artist = self._sanitize_search_query(artist)

        cache_key = f'lyrics_{artist}_{title}'
        with cache_lock:
            if 'lyrics' in cache and cache_key in cache['lyrics']:
                return self._send_json(cache['lyrics'][cache_key])

        # Try LRCLib API directly (no syncedlyrics library needed)
        lrc = self._fetch_lrclib(title, artist)
        result = {'lrc': lrc or '', 'source': 'lrclib' if lrc else 'none'}
        with cache_lock:
            if 'lyrics' not in cache:
                cache['lyrics'] = {}
            cache['lyrics'][cache_key] = result
        save_cache()
        return self._send_json(result)

    def _fetch_lrclib(self, title, artist):
        """Fetch synced lyrics from LRCLib API."""
        try:
            url = (
                f'https://lrclib.net/api/get?'
                f'track_name={urllib.parse.quote(title)}&'
                f'artist_name={urllib.parse.quote(artist)}'
            )
            req = urllib.request.Request(url, headers={
                'User-Agent': 'SonicPlayer/1.0 (https://github.com/NEXROA-STUDI0)',
                'Accept': 'application/json',
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return data.get('syncedLyrics', '') or data.get('plainLyrics', '')
        except Exception:
            return ''

    def _handle_play(self, video_id):
        """Stream audio directly via yt-dlp subprocess (bypasses googlevideo 403)."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        try:
            args = self._ytdlp_args([
                '-f', 'bestaudio[ext=m4a]/bestaudio/best',
                '-o', '-', '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ])
            for cmd_base in [['yt-dlp'] + args, ['python3', '-m', 'yt_dlp'] + args, ['python', '-m', 'yt_dlp'] + args]:
                try:
                    proc = subprocess.Popen(
                        cmd_base,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL,
                    )
                    if proc.stdout is None:
                        proc.kill()
                        continue
                    self.send_response(200)
                    self.send_header('Content-Type', 'audio/mp4')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    self.send_header('Cache-Control', 'no-cache')
                    self.end_headers()
                    try:
                        while True:
                            chunk = proc.stdout.read(8192)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                    finally:
                        proc.kill()
                    return
                except FileNotFoundError:
                    continue
            return self._send_error('yt-dlp not found', 500)
        except Exception as e:
            if not self.wfile.closed:
                self._send_error(f'stream failed: {str(e)}', 500)

    def _handle_download(self, video_id):
        """Download audio as binary stream."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        try:
            payload, returncode = self._run_ytdlp_bytes([
                '-f', 'bestaudio[ext=m4a]/bestaudio/best',
                '-o', '-', '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ])
            if returncode != 0 or not payload:
                # Fallback: download without format restriction
                payload, returncode = self._run_ytdlp_bytes([
                    '-f', 'bestaudio', '-o', '-',
                    '--no-warnings', '--quiet',
                    f'https://www.youtube.com/watch?v={vid}'
                ])
            if returncode != 0 or not payload:
                return self._send_error(f'download failed (exit: {returncode})', 500)
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mp4')
            self.send_header('Content-Disposition', f'attachment; filename="{vid}.m4a"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except subprocess.TimeoutExpired:
            self._send_error('download timed out', 500)
        except Exception as e:
            self._send_error(f'download failed: {str(e)}', 500)

    def _handle_download_video(self, video_id, quality):
        """Download video at requested quality."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        quality_map = {
            '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]',
            '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]',
            '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio/best[height<=360]',
            'best': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
        }
        fmt = quality_map.get(quality, quality_map['best'])

        try:
            payload, returncode = self._run_ytdlp_bytes([
                '-f', fmt, '-o', '-',
                '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ])
            if returncode != 0 or not payload:
                return self._send_error(f'video download failed (exit: {returncode})', 500)
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Disposition', f'attachment; filename="{vid}.mp4"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            self._send_error(f'video download failed: {str(e)}', 500)

    def _handle_download_local(self, video_id, title):
        """Download audio to local storage."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_error('invalid video id', 400)

        safe_name = ''.join(c for c in (title or vid) if c.isalnum() or c in ' ._-').strip() or vid
        save_path = os.path.join(DOWNLOADS_DIR, f'{safe_name}_{vid[:8]}.m4a')

        try:
            _, returncode = self._run_ytdlp([
                '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-o', save_path,
                '--no-warnings', '--quiet',
                f'https://www.youtube.com/watch?v={vid}'
            ], timeout=120)
            if returncode == 0 and os.path.exists(save_path):
                size = os.path.getsize(save_path)
                return self._send_json({
                    'path': f'/local_play/{os.path.basename(save_path)}',
                    'size': size,
                    'success': True
                })
            return self._send_json({'error': 'download failed', 'success': False})
        except Exception as e:
            return self._send_json({'error': str(e), 'success': False})

    def _handle_local_list(self):
        """List locally saved files."""
        files = glob.glob(os.path.join(DOWNLOADS_DIR, '*'))
        result = []
        for f in files:
            if os.path.isfile(f):
                result.append({
                    'path': f'/local_play/{os.path.basename(f)}',
                    'name': os.path.basename(f),
                    'size': os.path.getsize(f)
                })
        return self._send_json({'files': result})

    def _handle_check_local(self, video_id):
        """Check if a video has been downloaded locally."""
        vid = self._sanitize_video_id(video_id)
        if not vid:
            return self._send_json({'exists': False})

        pattern = os.path.join(DOWNLOADS_DIR, f'*{vid[:8]}*')
        files = glob.glob(pattern)
        for f in files:
            if os.path.isfile(f):
                return self._send_json({
                    'exists': True,
                    'path': f'/local_play/{os.path.basename(f)}',
                    'size': os.path.getsize(f)
                })
        return self._send_json({'exists': False})

    def _handle_country(self):
        """Detect user's country via IP geolocation."""
        try:
            req = urllib.request.Request(
                'http://ip-api.com/json/',
                headers={'User-Agent': 'SonicPlayer/1.0'}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return self._send_json({
                    'country': data.get('country', ''),
                    'countryCode': data.get('countryCode', ''),
                    'city': data.get('city', ''),
                })
        except Exception:
            return self._send_json({'country': '', 'countryCode': '', 'city': ''})

    def _handle_trending(self, country):
        """Get trending songs based on country."""
        try:
            # Use yt-dlp to search for trending music in the user's region
            search_query = 'trending music'
            if country:
                search_query = f'trending music in {country}'

            safe_query = shlex.quote(search_query)
            stdout, rc = self._run_ytdlp([
                '--quiet', '--no-warnings',
                '--dump-json', '--flat-playlist', '--ignore-errors',
                f'ytsearch30:{safe_query}'
            ], timeout=30)

            tracks = self._parse_yt_search(stdout)
            return self._send_json({'tracks': tracks, 'country': country or 'global'})
        except Exception:
            return self._send_json({'tracks': [], 'country': country or 'global'})

    # ── HTTP method handlers ──

    def do_GET(self):
        self._route()

    def do_OPTIONS(self):
        self._route()


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    """Threaded server that can be restarted without waiting for TIME_WAIT sockets."""

    allow_reuse_address = True
    allow_reuse_port = True
    daemon_threads = True


def run_server():
    server = ReusableThreadingTCPServer(('0.0.0.0', PORT), SonicHandler)
    print(f'[Sonic] Backend running on http://localhost:{PORT}')
    print(f'[Sonic] Multi-threaded — zero dependencies!')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[Sonic] Shutting down...')
        server.shutdown()


if __name__ == '__main__':
    run_server()
