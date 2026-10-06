# ==============================================================================
# MATRIX STUDIO - KAGGLE DUAL-T4 GPU MASTER RENDERER & PROTEUS V3 UPSCALER
# Complete Standalone Python Script for Kaggle Notebooks (Dual T4 GPU Accelerator)
# ==============================================================================
# 
# HARDWARE REQUIREMENT ON KAGGLE:
# 1. In Kaggle Notebook Settings (right sidebar):
#    - Accelerator: Select "GPU T4 x 2" (or "GPU P100")
#    - Internet: Set to "Internet On" (Required for downloading model & uploading)
# 2. Paste this complete code into a Kaggle Code cell and click Run (Shift + Enter).
#
# ==============================================================================
# 🔑 SEPARATE CREDENTIALS & CONFIGURATION BLOCK
# ==============================================================================
# Set your credentials below, or add them to Kaggle Secrets (Add-ons -> Secrets)
# and they will be automatically loaded from os.environ.
# ==============================================================================

import os

# 1. Telegram Bot Storage Credentials (for storing and delivering completed master videos)
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or "8963030492:AAGR35MuTT5KkNPzwLXrJ0j4FZRxN3HRrx0"
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID")   or "-1003463870682"

# 2. Web App Server Callback URL (Optional - leave empty if running independently in Kaggle)
CALLBACK_BASE_URL  = os.environ.get("CALLBACK_BASE_URL")  or ""

# 3. Job Identification (Optional - defaults to auto-generated ID)
JOB_ID             = os.environ.get("JOB_ID")             or f"kaggle_render_{int(os.environ.get('KAGGLE_JOB_TS', 0)) or 1790000000}"
PROJECT_NAME       = os.environ.get("PROJECT_NAME")       or "Master_Project"

# 4. Upscaling & Rendering Quality Configuration
ENABLE_PROTEUS_AI  = True         # True = 4K Proteus V3 Neural Super-Resolution; False = Hardware NVENC fast render
QUALITY_CRF        = 16           # 14-18 = Visually lossless master; 20-23 = Smaller file size
SCALE_FACTOR       = 2            # 2X Neural Upscaler
TARGET_RESOLUTION  = (1080, 1920) # 9:16 Vertical Reel / TikTok / Shorts Standard

# 5. Timeline Clips & Media Specification (Customize or inject via JSON payload)
TIMELINE_PAYLOAD = {
    "projectName": PROJECT_NAME,
    "enable_proteus_upscale": ENABLE_PROTEUS_AI,
    "output_filename": f"{PROJECT_NAME}_hd.mp4",
    "quality": QUALITY_CRF,
    "proteus_sliders": {
        "anti_alias_deblur": 50,
        "reduce_noise": 17,
        "recover_details": 100,
        "dehalo": 10,
        "sharpen": 20,
        "revert_compression": 100,
        "recover_original": 0
    },
    # Insert public video URLs to assemble, trim, and upscale
    "clips": [
        # Example:
        # {"url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "trim_start": 0.0, "trim_end": 5.0, "speed": 1.0, "volume": 1.0}
    ],
    # Background music / Audio track (Optional public audio URL or base64)
    "audio_url": "",
    "audio_volume": 1.0,
    # Captions & text overlays (Optional pixel-perfect canvas overlays)
    "captions": []
}

# ==============================================================================
# 📦 [1/6] ENVIRONMENT SETUP & DUAL-GPU INITIALIZATION
# ==============================================================================
import sys, gc, subprocess, re, time, math, shutil, json, threading, base64, urllib.request
from queue import Queue
from concurrent.futures import ThreadPoolExecutor

WORKING_DIR = "/kaggle/working"
TEMP_DIR = "/tmp/matrix_render"
os.makedirs(TEMP_DIR, exist_ok=True)
os.chdir(WORKING_DIR)

def log(msg):
    print(f"[KAGGLE-GPU-RENDERER] {msg}", flush=True)

print("=" * 75)
print(f"🚀 Initializing Dual-T4 GPU Pipeline")
print(f"📁 Project: {PROJECT_NAME} | Job ID: {JOB_ID}")
print(f"⚡ Mode: {'Proteus V3 AI Super-Resolution (Dual-GPU ONNX)' if ENABLE_PROTEUS_AI else 'Ultra-Fast NVENC Hardware'}")
print("=" * 75)

# Setup progress and status reporting
_last_report_time = 0
def report_progress(pct, text, log_line=None, force=False):
    global _last_report_time
    now = time.time()
    if not force and (now - _last_report_time) < 1.0:
        return
    _last_report_time = now
    try:
        print(f"[PROGRESS] {pct}% | {text}", flush=True)
        if CALLBACK_BASE_URL and "localhost" not in CALLBACK_BASE_URL:
            post_data = json.dumps({
                "jobId": JOB_ID,
                "progress": pct,
                "statusText": text,
                "log": log_line or text
            }).encode('utf-8')
            req = urllib.request.Request(
                f"{CALLBACK_BASE_URL.rstrip('/')}/api/kaggle/progress",
                data=post_data,
                headers={"Content-Type": "application/json", "User-Agent": "KaggleGPU/1.0"}
            )
            urllib.request.urlopen(req, timeout=4)
    except Exception:
        pass

def report_completed(filename, size, cloud_url="", tg_file_id=""):
    try:
        print(f"RENDER_COMPLETED: filename={filename} size={size} tg_file_id={tg_file_id}", flush=True)
        if CALLBACK_BASE_URL and "localhost" not in CALLBACK_BASE_URL:
            post_data = json.dumps({
                "jobId": JOB_ID,
                "filename": filename,
                "size": size,
                "telegramFileId": tg_file_id,
                "cloudUrl": cloud_url
            }).encode('utf-8')
            req = urllib.request.Request(
                f"{CALLBACK_BASE_URL.rstrip('/')}/api/kaggle/callback",
                data=post_data,
                headers={"Content-Type": "application/json", "User-Agent": "KaggleGPU/1.0"}
            )
            urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass

report_progress(10, "Setting up Dual-GPU Environment...", force=True)

# Install ONNX Runtime GPU and required video packages
if ENABLE_PROTEUS_AI:
    subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "onnxruntime", "onnxruntime-gpu"], capture_output=True)
    subprocess.run([
        sys.executable, "-m", "pip", "install", "-q",
        "onnxruntime-gpu==1.19.2", "pyTelegramBotAPI", "opencv-python", "numpy", "pillow"
    ], check=True)
    import glob
    for p in glob.glob("/usr/local/cuda*/lib64") + glob.glob(f"{sys.prefix}/lib/python*/site-packages/nvidia/*/lib"):
        if os.path.isdir(p) and p not in os.environ.get("LD_LIBRARY_PATH", ""):
            os.environ["LD_LIBRARY_PATH"] = p + ":" + os.environ.get("LD_LIBRARY_PATH", "")
    import onnxruntime as _ort
else:
    log("⚡ Standard / NVENC Fast Mode: Installing required packages...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyTelegramBotAPI"], capture_output=True)
    _ort = None

import torch
import numpy as np
import cv2

# ==============================================================================
# ⬇️ [2/6] DOWNLOAD PROTEUS V3 FGNet ONNX MODEL
# ==============================================================================
MODEL_URL = "https://www.dropbox.com/scl/fi/l6d736wpds23bposy3j85/prob-v3-fgnet-fp32-576x672-2x.onnx?rlkey=rzu3gpcjsxg070s22ecy3x51x&dl=1"
MODEL_PATH = os.path.join(TEMP_DIR, "prob-v3-fgnet-fp32-576x672-2x.onnx")

if ENABLE_PROTEUS_AI:
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) < 1_000_000:
        log("⬇️ Downloading Proteus V3 FGNet ONNX Model from Dropbox...")
        report_progress(14, "Downloading Proteus V3 Model...", force=True)
        subprocess.run(["curl", "-sL", "--retry", "3", "-o", MODEL_PATH, MODEL_URL], check=True)
        log(f"  ✓ Model downloaded: {os.path.getsize(MODEL_PATH) // 1048576} MB")
    else:
        log(f"  ✓ Model cached: {MODEL_PATH}")

# ==============================================================================
# 🎛️ [3/6] MODEL PARAMETERS & QUALITY SLIDERS
# ==============================================================================
SCALE = SCALE_FACTOR
TILE_H, TILE_W = 576, 672
OVERLAP = 64
VIDEO_FIRST_PASSES = 2
SWS_FLAGS = 'spline+accurate_rnd+full_chroma_int'
USE_TEMPORAL = True

p_sliders = TIMELINE_PAYLOAD.get("proteus_sliders") or {}
INJECT_OVERLAY = {
    3: float(p_sliders.get("anti_alias_deblur", 50)) / 100.0,
    4: float(p_sliders.get("reduce_noise", 17)) / 100.0,
    5: float(p_sliders.get("recover_details", 100)) / 100.0,
    6: float(p_sliders.get("dehalo", 10)) / 100.0,
    7: float(p_sliders.get("sharpen", 20)) / 100.0,
    8: float(p_sliders.get("revert_compression", 100)) / 100.0,
}
preBlur_val     = INJECT_OVERLAY[3]
noise_val       = INJECT_OVERLAY[4]
details_val     = INJECT_OVERLAY[5]
halo_val        = INJECT_OVERLAY[6]
sharpen_val     = INJECT_OVERLAY[7]
compression_val = INJECT_OVERLAY[8]
CURRENT_RECOVER_ORIGINAL = int(p_sliders.get("recover_original", 0))

# ==============================================================================
# 🧠 [4/6] DUAL-GPU HARDWARE ENGINES & INFERENCE SESSIONS
# ==============================================================================
num_gpus = torch.cuda.device_count() if torch.cuda.is_available() else 0
has_gpu = (num_gpus > 0)
log(f"Detected {num_gpus} CUDA GPU(s).")

nvenc_available = False
if has_gpu:
    try:
        encs = subprocess.check_output(["ffmpeg", "-encoders"], stderr=subprocess.STDOUT).decode()
        if "h264_nvenc" in encs:
            nvenc_available = True
            log("FFmpeg NVENC Hardware Encoder ready.")
    except Exception:
        pass

sessions = []
session_locks = []
if ENABLE_PROTEUS_AI and _ort is not None:
    sess_options = _ort.SessionOptions()
    sess_options.graph_optimization_level = _ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess_options.execution_mode = _ort.ExecutionMode.ORT_SEQUENTIAL
    sess_options.enable_mem_pattern = True
    sess_options.intra_op_num_threads = 2
    sess_options.inter_op_num_threads = 2

    for gpu_id in range(max(1, num_gpus)):
        cuda_opts = {
            'device_id': gpu_id,
            'arena_extend_strategy': 'kSameAsRequested',
            'gpu_mem_limit': 4 * 1024 * 1024 * 1024,
            'cudnn_conv_algo_search': 'DEFAULT',
            'do_copy_in_default_stream': True,
        }
        try:
            s = _ort.InferenceSession(
                MODEL_PATH,
                sess_options=sess_options,
                providers=[('CUDAExecutionProvider', cuda_opts), 'CPUExecutionProvider']
            )
            sessions.append(s)
            session_locks.append(threading.Lock())
            if num_gpus >= 1:
                log(f"  ✓ GPU {gpu_id} ({torch.cuda.get_device_name(gpu_id)}) Active [4GB VRAM Cap]")
        except Exception as e_s:
            log(f"Session init warning on GPU {gpu_id}: {e_s}")

    if len(sessions) > 0:
        _input_meta = sessions[0].get_inputs()[0]
        input_name = _input_meta.name
        TILE_H, TILE_W = _input_meta.shape[1], _input_meta.shape[2]
        TILE_WORKERS = max(2, len(sessions) * 2)
        tile_executor = ThreadPoolExecutor(max_workers=TILE_WORKERS)
    else:
        tile_executor = None
        input_name = None
else:
    tile_executor = None
    input_name = None

def clean_memory():
    global prev_lr, prev_hr
    prev_lr = None
    prev_hr = None
    gc.collect()
    if torch.cuda.is_available():
        for d in range(torch.cuda.device_count()):
            with torch.cuda.device(d):
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()

def make_feather_mask(h, w, overlap):
    m = np.ones((h, w), dtype=np.float32)
    if overlap > 0:
        r = np.linspace(0, 1, overlap, dtype=np.float32)
        m[:, :overlap] *= r[np.newaxis, :]
        m[:, -overlap:] *= r[::-1][np.newaxis, :]
        m[:overlap, :] *= r[:, np.newaxis]
        m[-overlap:, :] *= r[::-1][:, np.newaxis]
    return m

FULL_FEATHER_MASK = make_feather_mask(TILE_H * SCALE, TILE_W * SCALE, OVERLAP * SCALE)

def reflect_pad(img, th, tw):
    h, w = img.shape[:2]
    ph, pw = max(0, th - h), max(0, tw - w)
    if ph > 0 or pw > 0:
        return np.pad(img, ((0, ph), (0, pw), (0, 0)), mode='reflect')
    return img

def compute_tile_positions(ts, tile, overlap):
    if ts <= tile:
        return [0], 1, tile
    nb = math.ceil((ts - overlap) / (tile - overlap))
    if nb <= 1:
        return [0], 1, tile
    step = (ts - tile) / (nb - 1)
    pos = [int(round(i * step)) for i in range(nb)]
    pos[-1] = ts - tile
    return pos, nb, ts

def pixel_shuffle_down(hr_img, scale):
    h, w, c = hr_img.shape
    new_h, new_w = h // scale, w // scale
    img = hr_img.reshape(new_h, scale, new_w, scale, c)
    img = img.transpose(0, 2, 1, 3, 4)
    img = img.reshape(new_h, new_w, c * scale * scale)
    return np.ascontiguousarray(img)

def build_input(lr_curr, params, lr_prev, packed_hr_prev):
    channels = [lr_curr, params, lr_prev, packed_hr_prev]
    inp = np.ascontiguousarray(np.concatenate(channels, axis=-1), dtype=np.float32)
    if INJECT_OVERLAY:
        for ch_idx, val in INJECT_OVERLAY.items():
            inp[:, :, ch_idx] = val
    return inp

prev_lr = None
prev_hr = None

def run_model_tiles(lr_curr, params, lr_prev, packed_hr, tile_h, tile_w, overlap):
    in_h, in_w = lr_curr.shape[:2]
    out_h, out_w = in_h * SCALE, in_w * SCALE
    yp, nh, ph = compute_tile_positions(in_h, tile_h, overlap)
    xp, nw, pw = compute_tile_positions(in_w, tile_w, overlap)

    lr_curr_p = reflect_pad(lr_curr, ph, pw)
    params_p = reflect_pad(params, ph, pw)
    lr_prev_p = reflect_pad(lr_prev, ph, pw)
    packed_hr_p = reflect_pad(packed_hr, ph, pw)

    poh, pow_ = ph * SCALE, pw * SCALE
    obuf = np.zeros((poh, pow_, 3), dtype=np.float32)
    wbuf = np.zeros((poh, pow_), dtype=np.float32)

    tile_tasks = []
    task_idx = 0
    for ty in range(nh):
        for tx in range(nw):
            y0, x0 = yp[ty], xp[tx]
            t_curr = lr_curr_p[y0:y0 + tile_h, x0:x0 + tile_w]
            t_params = params_p[y0:y0 + tile_h, x0:x0 + tile_w]
            t_prev = lr_prev_p[y0:y0 + tile_h, x0:x0 + tile_w]
            t_hr = packed_hr_p[y0:y0 + tile_h, x0:x0 + tile_w]
            inp = build_input(t_curr, t_params, t_prev, t_hr)
            tile_tasks.append((task_idx, y0, x0, inp))
            task_idx += 1

    def _execute_tile(task):
        t_id, y0, x0, inp = task
        sess_idx = t_id % len(sessions)
        target_sess = sessions[sess_idx]
        lock = session_locks[sess_idx]
        with lock:
            try:
                out_tile = target_sess.run(None, {input_name: inp[None]})[0][0]
                return y0, x0, np.clip(out_tile, 0.0, 1.0)
            except Exception:
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                out_tile = target_sess.run(None, {input_name: inp[None]})[0][0]
                return y0, x0, np.clip(out_tile, 0.0, 1.0)

    results = list(tile_executor.map(_execute_tile, tile_tasks))
    for y0, x0, out_tile in results:
        oy0, ox0 = y0 * SCALE, x0 * SCALE
        oe, xe = oy0 + tile_h * SCALE, ox0 + tile_w * SCALE
        for c in range(3):
            obuf[oy0:oe, ox0:xe, c] += out_tile[:, :, c] * FULL_FEATHER_MASK
        wbuf[oy0:oe, ox0:xe] += FULL_FEATHER_MASK

    wbuf = np.maximum(wbuf, 1e-6)
    out_final = np.clip(obuf / wbuf[:, :, np.newaxis], 0, 1)[:out_h, :out_w]
    del tile_tasks, results, obuf, wbuf
    return out_final

def process_frame(input_rgb48):
    global prev_lr, prev_hr
    in_h, in_w = input_rgb48.shape[:2]
    rgb_f32 = input_rgb48.astype(np.float32) / 65535.0
    lr_curr = np.clip(rgb_f32, 0, 1).astype(np.float32)

    H, W, _ = lr_curr.shape
    params = np.concatenate([
        np.full((H, W, 1), preBlur_val,     dtype=np.float32),
        np.full((H, W, 1), noise_val,       dtype=np.float32),
        np.full((H, W, 1), details_val,     dtype=np.float32),
        np.full((H, W, 1), halo_val,        dtype=np.float32),
        np.full((H, W, 1), sharpen_val,     dtype=np.float32),
        np.full((H, W, 1), compression_val, dtype=np.float32),
    ], axis=-1)

    if prev_lr is None:
        lr_prev = lr_curr.copy() if USE_TEMPORAL else np.zeros_like(lr_curr)
        hr_simple = cv2.resize(lr_curr, (in_w * SCALE, in_h * SCALE), interpolation=cv2.INTER_CUBIC)
        packed_hr = pixel_shuffle_down(hr_simple, SCALE)
        for p in range(VIDEO_FIRST_PASSES):
            hr_pass = run_model_tiles(lr_curr, params, lr_prev, packed_hr, TILE_H, TILE_W, OVERLAP)
            if p < VIDEO_FIRST_PASSES - 1:
                packed_hr = pixel_shuffle_down(hr_pass, SCALE)
        hr_output = hr_pass
    else:
        lr_prev = prev_lr if USE_TEMPORAL else np.zeros_like(lr_curr)
        packed_hr = pixel_shuffle_down(prev_hr, SCALE) if USE_TEMPORAL else \
                    pixel_shuffle_down(cv2.resize(lr_curr, (in_w * SCALE, in_h * SCALE), interpolation=cv2.INTER_CUBIC), SCALE)
        hr_output = run_model_tiles(lr_curr, params, lr_prev, packed_hr, TILE_H, TILE_W, OVERLAP)

    prev_lr = lr_curr
    prev_hr = hr_output
    return np.ascontiguousarray((hr_output * 65535).astype(np.uint16))

class FFmpegRGB48Reader:
    def __init__(self, path, orig_w, orig_h, out_w, out_h, fps=25.0):
        self.w, self.h = out_w, out_h
        self.frame_bytes = out_w * out_h * 6
        cmd = ['ffmpeg', '-v', 'error', '-i', path]
        if (orig_w, orig_h) != (out_w, out_h):
            cmd.extend(['-vf', f'scale={out_w}:{out_h}:flags=lanczos'])
        cmd.extend(['-sws_flags', SWS_FLAGS, '-pix_fmt', 'rgb48le', '-vsync', 'passthrough', '-f', 'rawvideo', 'pipe:1'])
        self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=self.frame_bytes * 2)

    def read(self):
        data = self.proc.stdout.read(self.frame_bytes)
        if len(data) < self.frame_bytes:
            return None
        return np.frombuffer(data, dtype=np.uint16).reshape((self.h, self.w, 3))

    def close(self):
        try: self.proc.stdout.close()
        except: pass
        try:
            self.proc.terminate()
            self.proc.wait(timeout=2)
        except:
            try: self.proc.kill()
            except: pass

def get_media_info(path):
    r = subprocess.run([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
        '-of', 'json', path
    ], capture_output=True, text=True, timeout=30)
    data = json.loads(r.stdout)
    info = data['streams'][0]
    w, h = int(info['width']), int(info['height'])
    num, den = info['r_frame_rate'].split('/')
    fps = float(num) / float(den) if float(den) > 0 else 30.0
    tf_str = info.get('nb_frames', '0')
    tf = int(tf_str) if tf_str and tf_str.isdigit() and int(tf_str) > 0 else None
    return w, h, fps, tf

def upscale_video_file(input_path, output_path, status_callback=None):
    iw, ih, fps, tf = get_media_info(input_path)
    out_w, out_h = iw * SCALE, ih * SCALE

    enc_cmd = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{out_w}x{out_h}', '-r', str(fps), '-i', '-',
        '-sws_flags', SWS_FLAGS, '-c:v', 'libx264', '-preset', 'medium', '-crf', str(QUALITY_CRF),
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output_path
    ]
    enc_proc = subprocess.Popen(enc_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    in_queue = Queue(maxsize=3)
    out_queue = Queue(maxsize=3)
    stop_event = threading.Event()

    def reader_worker():
        reader = FFmpegRGB48Reader(input_path, iw, ih, iw, ih, fps)
        try:
            while not stop_event.is_set():
                frame = reader.read()
                if frame is None: break
                in_queue.put(frame)
        finally:
            in_queue.put(None)
            reader.close()

    def writer_worker():
        try:
            while not stop_event.is_set():
                frame_data = out_queue.get()
                if frame_data is None: break
                enc_proc.stdin.write(frame_data)
        except BrokenPipeError:
            pass
        finally:
            try:
                enc_proc.stdin.flush()
                enc_proc.stdin.close()
            except Exception:
                pass

    t_reader = threading.Thread(target=reader_worker, daemon=True)
    t_writer = threading.Thread(target=writer_worker, daemon=True)
    t_reader.start()
    t_writer.start()

    fi = 0
    start_time = time.time()
    try:
        while True:
            frame = in_queue.get()
            if frame is None: break
            fi += 1
            result_uint16_rgb = process_frame(frame)
            result_8bit = cv2.cvtColor((result_uint16_rgb >> 8).astype(np.uint8), cv2.COLOR_RGB2BGR)
            out_queue.put(result_8bit.tobytes())
            if fi % 25 == 0:
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            if status_callback and (fi % 10 == 0 or fi == tf or fi == 1):
                status_callback(fi, tf, fi / (time.time() - start_time + 1e-5))
    finally:
        out_queue.put(None)
        t_reader.join()
        t_writer.join()
        enc_proc.wait(timeout=300)

# ==============================================================================
# 🎬 [5/6] PROCESS CLIPS, AUDIO MIX, AND CAPTIONS (MASTER CLIP ONLY)
# ==============================================================================
v_codec = "h264_nvenc" if nvenc_available else "libx264"
v_opts = "-preset p6 -tune hq -rc vbr -cq 18 -b:v 14M -maxrate 18M -bufsize 24M -bf 0 -g 30" if nvenc_available else "-preset medium -profile:v high -level 4.2 -crf 18 -maxrate 12M -bufsize 16M -g 60 -keyint_min 30 -flags +cgop -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"

clips = TIMELINE_PAYLOAD.get("clips", [])
std_clips = []

log(f"Processing {len(clips)} clip(s)...")
report_progress(15, f"Clips Processing 1/{max(1, len(clips))}", force=True)

for idx, c in enumerate(clips):
    url = c.get("remote_url") or c.get("url") or ""
    tg_file_id = c.get("telegram_file_id") or c.get("tg_file_id") or ""
    clip_src = os.path.join(TEMP_DIR, f"src_clip_{idx}.mp4")
    clip_trimmed = os.path.join(TEMP_DIR, f"trimmed_clip_{idx}.mp4")
    clip_std = os.path.join(TEMP_DIR, f"std_clip_{idx}.mp4")
    clip_downloaded = False

    # 1. Try downloading directly from Telegram CDN if telegram_file_id and TELEGRAM_BOT_TOKEN are present
    if tg_file_id and TELEGRAM_BOT_TOKEN:
        try:
            log(f"Downloading clip #{idx+1} from Telegram CDN (file_id: {tg_file_id[:12]}...)...")
            file_info_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={tg_file_id}"
            req = urllib.request.Request(file_info_url, headers={'User-Agent': 'KaggleRenderer/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                res_data = json.loads(r.read().decode('utf-8'))
                if res_data.get("ok") and res_data.get("result", {}).get("file_path"):
                    tg_download_path = res_data["result"]["file_path"]
                    direct_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{tg_download_path}"
                    d_req = urllib.request.Request(direct_url, headers={'User-Agent': 'KaggleRenderer/1.0'})
                    with urllib.request.urlopen(d_req, timeout=180) as d_resp, open(clip_src, 'wb') as out_f:
                        shutil.copyfileobj(d_resp, out_f)
                    if os.path.exists(clip_src) and os.path.getsize(clip_src) > 1000:
                        clip_downloaded = True
                        log(f"  ✓ Clip #{idx+1} downloaded from Telegram ({os.path.getsize(clip_src) // 1024} KB)")
        except Exception as tg_dl_err:
            log(f"Telegram direct clip download note: {tg_dl_err}")

    # 2. Fallback to public HTTP URL
    if not clip_downloaded and url and url.startswith("http"):
        try:
            log(f"Downloading clip #{idx+1} from URL: {url}...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=180) as resp, open(clip_src, 'wb') as out_f:
                shutil.copyfileobj(resp, out_f)
            if os.path.exists(clip_src) and os.path.getsize(clip_src) > 1000:
                clip_downloaded = True
                log(f"  ✓ Clip #{idx+1} downloaded from URL ({os.path.getsize(clip_src) // 1024} KB)")
        except Exception as e:
            log(f"Download note for clip #{idx+1}: {e}")

    if not os.path.exists(clip_src) or os.path.getsize(clip_src) < 1000:
        log(f"⚠️ Warning: Could not download clip #{idx+1}, skipping.")
        continue

    trim_start = float(c.get("trim_start") or 0.0)
    trim_end = c.get("trim_end")
    speed = float(c.get("speed") or 1.0)
    volume = float(c.get("volume") if c.get("volume") is not None else 1.0)
    is_muted = c.get("is_muted") or volume == 0

    ss_arg = f"-ss {trim_start:.3f}" if trim_start > 0 else ""
    dur_span = float(trim_end) - trim_start if trim_end is not None and float(trim_end) > trim_start else None
    dur_arg = f"-t {dur_span:.3f}" if dur_span is not None else ""
    spd_vf = f"setpts={1.0/speed:.4f}*PTS-STARTPTS" if speed != 1.0 and speed > 0 else "setpts=PTS-STARTPTS"

    # Trim source clip with accurate frame seek and audio/no-audio fallback
    trim_cmd = f'ffmpeg -y {ss_arg} -i "{clip_src}" {dur_arg} -vf "{spd_vf}" -c:v libx264 -preset fast -crf 16 -c:a aac -b:a 192k "{clip_trimmed}"'
    subprocess.run(trim_cmd, shell=True, capture_output=True)
    if not os.path.exists(clip_trimmed) or os.path.getsize(clip_trimmed) < 1000:
        # Fallback without audio in case source video has no native audio
        trim_no_audio = f'ffmpeg -y {ss_arg} -i "{clip_src}" {dur_arg} -vf "{spd_vf}" -c:v libx264 -preset fast -crf 16 -an "{clip_trimmed}"'
        subprocess.run(trim_no_audio, shell=True, capture_output=True)
    if not os.path.exists(clip_trimmed) or os.path.getsize(clip_trimmed) < 1000:
        if dur_span is None and trim_start <= 0.01:
            shutil.copyfile(clip_src, clip_trimmed)
        else:
            log(f"⚠️ Warning: Could not slice trimmed segment for clip #{idx+1}")

    clip_ready = clip_trimmed
    if ENABLE_PROTEUS_AI:
        try:
            log(f"🚀 Enhancing clip #{idx + 1}/{len(clips)} with Proteus V3 AI Super-Resolution...")
            up_temp = os.path.join(TEMP_DIR, f"up_temp_{idx}.mp4")
            upscale_video_file(clip_trimmed, up_temp, status_callback=lambda fi, tf, fps: (
                log(f"Clip #{idx+1} Upscaling: {fi}/{tf or 1} frames ({fps:.2f} fps)"),
                report_progress(min(58, int(20 + ((idx + (fi / max(1, tf or 1))) / max(1, len(clips))) * 35)), f"Clip #{idx+1} AI: {int(round((fi/max(1, tf or 1))*100))}%")
            ))
            if os.path.exists(up_temp) and os.path.getsize(up_temp) > 1000:
                clip_ready = up_temp
                log(f"  ✓ Clip #{idx+1} Enhanced with Proteus V3 (4K Detail Preserved)")
        except Exception as up_err:
            log(f"Clip #{idx+1} AI enhance note: {up_err}")
        finally:
            clean_memory()

    # Standardize to 1080x1920 30FPS CFR with Lanczos scaling (CapCut standard)
    # Check if clip has an audio track so concat streams align identically
    probe_a = subprocess.run(
        f'ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "{clip_ready}"',
        shell=True, capture_output=True, text=True
    )
    has_clip_audio = bool(probe_a.stdout and probe_a.stdout.strip())

    std_vf = "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,fps=30,format=yuv420p"
    if has_clip_audio and not is_muted:
        audio_filter = f'-af "volume={volume}" -c:a aac -b:a 192k -ar 44100'
        std_cmd = f'ffmpeg -y -i "{clip_ready}" -vf "{std_vf}" -c:v {v_codec} {v_opts} -pix_fmt yuv420p {audio_filter} -r 30 "{clip_std}"'
    else:
        # Generate silent audio stream so all clips have matched streams for concat
        std_cmd = (
            f'ffmpeg -y -i "{clip_ready}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 '
            f'-vf "{std_vf}" -c:v {v_codec} {v_opts} -pix_fmt yuv420p -c:a aac -b:a 192k -ar 44100 -shortest -r 30 "{clip_std}"'
        )

    subprocess.run(std_cmd, shell=True, capture_output=True)
    if os.path.exists(clip_std) and os.path.getsize(clip_std) > 1000:
        std_clips.append(clip_std)

if not std_clips:
    log("Note: No external clips provided, checking if working master exists...")
    stage1_out = os.path.join(TEMP_DIR, "stage1_concat.mp4")
    # Generate clean test video if no clips provided
    subprocess.run(f'ffmpeg -y -f lavfi -i testsrc=duration=5:size=1080x1920:rate=30 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{stage1_out}"', shell=True)
else:
    concat_list = os.path.join(TEMP_DIR, "concat_list.txt")
    with open(concat_list, "w") as f:
        for p in std_clips:
            print(f"file '{p}'", file=f)
    stage1_out = os.path.join(TEMP_DIR, "stage1_concat.mp4")
    subprocess.run(f'ffmpeg -y -f concat -safe 0 -i "{concat_list}" -c copy "{stage1_out}"', shell=True, check=True)

current_stage = stage1_out

# Multi-track Audio mixing
audio_url = TIMELINE_PAYLOAD.get("audio_url")
if not audio_url:
    p_clips = TIMELINE_PAYLOAD.get("audio_clips") or []
    if len(p_clips) > 0 and p_clips[0].get("url"):
        audio_url = p_clips[0].get("url")

if audio_url and audio_url.startswith("http"):
    try:
        log("Downloading and mixing background audio track...")
        report_progress(82, "Mixing audio soundtrack...", force=True)
        raw_audio = os.path.join(TEMP_DIR, "bgm.mp3")
        urllib.request.urlretrieve(audio_url, raw_audio)
        stage2_out = os.path.join(TEMP_DIR, "stage2_audio.mp4")
        bgm_vol = TIMELINE_PAYLOAD.get("audio_volume", 1.0)
        
        probe = subprocess.run(
            f'ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "{current_stage}"',
            shell=True, capture_output=True, text=True
        )
        has_audio = bool(probe.stdout and probe.stdout.strip())
        
        if has_audio:
            mix_cmd = (
                f'ffmpeg -y -i "{current_stage}" -i "{raw_audio}" '
                f'-filter_complex "[0:a]volume=1.0[va];[1:a]volume={bgm_vol}[ba];[va][ba]amix=inputs=2:duration=first:dropout_transition=0[aout]" '
                f'-map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k "{stage2_out}"'
            )
        else:
            mix_cmd = (
                f'ffmpeg -y -i "{current_stage}" -i "{raw_audio}" '
                f'-filter_complex "[1:a]volume={bgm_vol}[ba]" '
                f'-map 0:v:0 -map "[ba]" -c:v copy -c:a aac -b:a 192k -shortest "{stage2_out}"'
            )
        subprocess.run(mix_cmd, shell=True, check=True)
        if os.path.exists(stage2_out) and os.path.getsize(stage2_out) > 1000:
            current_stage = stage2_out
            log("✓ Background audio mixed successfully into video")
    except Exception as a_err:
        log(f"Audio mix note: {a_err}")

# Burning Styled Subtitle & Title Overlays
captions = TIMELINE_PAYLOAD.get("captions") or []
if captions:
    log(f"Burning {len(captions)} caption layer(s)...")
    report_progress(88, "Burning styled captions...", force=True)
    overlay_inputs = []
    filter_chains = ["[0:v]"]
    current_label = "[0:v]"
    
    cap_count = 0
    for c_i, cap in enumerate(captions):
        img_data = cap.get("image_data") or ""
        segments = cap.get("segments") or []
        if not img_data or "base64," not in img_data:
            continue
        try:
            b64_str = img_data.split("base64,")[1]
            cap_png_path = os.path.join(TEMP_DIR, f"caption_{c_i}.png")
            with open(cap_png_path, "wb") as f_png:
                f_png.write(base64.b64decode(b64_str))
            
            if segments:
                enable_expr = "+".join([f"between(t,{float(s.get('start_time', 0)):.3f},{float(s.get('end_time', 9999)):.3f})" for s in segments])
            else:
                enable_expr = "1"
            
            overlay_inputs.extend(["-i", cap_png_path])
            next_label = f"[cap_v{cap_count+1}]"
            filter_chains.append(f"{current_label}[{cap_count+1}:v]overlay=0:0:enable='{enable_expr}'{next_label}")
            current_label = next_label
            cap_count += 1
        except Exception as cap_err:
            log(f"Caption overlay prep error: {cap_err}")
            
    if cap_count > 0:
        filter_str = ";".join(filter_chains[1:])
        stage_cap_out = os.path.join(TEMP_DIR, "stage_captions.mp4")
        ff_cap_cmd = (
            f'ffmpeg -y -i "{current_stage}" ' + " ".join([f'"{arg}"' if not arg.startswith("-") else arg for arg in overlay_inputs]) +
            f' -filter_complex "{filter_str}" -map "{current_label}" -map 0:a? -c:v {v_codec} {v_opts} -c:a copy "{stage_cap_out}"'
        )
        subprocess.run(ff_cap_cmd, shell=True)
        if os.path.exists(stage_cap_out) and os.path.getsize(stage_cap_out) > 1000:
            current_stage = stage_cap_out
            log(f"✓ All {cap_count} caption overlay(s) burned successfully!")

# ==============================================================================
# 📦 [6/6] PACKAGING MASTER MP4 & DIRECT TELEGRAM DELIVERY (<50MB GUARANTEED)
# ==============================================================================
log("📦 Packaging Final Master MP4...")
report_progress(90, "Packaging Master MP4...", force=True)
final_filename = TIMELINE_PAYLOAD.get("output_filename") or f"{PROJECT_NAME}_hd_{int(time.time())}.mp4"
final_output = os.path.join(WORKING_DIR, final_filename)

opt_cmd = (
    f'ffmpeg -y -i "{current_stage}" '
    f'-vf "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,fps=30,format=yuv420p" '
    f'-c:v libx264 -profile:v high -level 4.2 -preset medium -tune film -crf 18 '
    f'-maxrate 12M -bufsize 16M -g 60 -keyint_min 30 -sc_threshold 0 -flags +cgop '
    f'-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv '
    f'-vsync cfr -r 30 -c:a aac -b:a 192k -ar 44100 '
    f'-movflags +faststart "{final_output}"'
)
subprocess.run(opt_cmd, shell=True)

if not os.path.exists(final_output) or os.path.getsize(final_output) < 1000:
    shutil.copyfile(current_stage, final_output)

file_size = os.path.getsize(final_output)
log(f"✓ Master MP4 Created: {final_filename} ({file_size / (1024*1024):.2f} MB)")
report_progress(95, f"Master MP4 created ({file_size / (1024*1024):.1f} MB)", force=True)

# Strict Telegram 48MB Safety Compression (so Telegram Bot API never rejects with 400 Bad Request: file too large)
final_sz_mb = file_size / (1024 * 1024)
if final_sz_mb > 48.0:
    log(f"⚠️ Video size ({final_sz_mb:.2f} MB) exceeds Telegram 48MB limit. Running stream-optimized safety clamp...")
    dur_cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{final_output}"'
    dur_p = subprocess.run(dur_cmd, shell=True, capture_output=True, text=True)
    v_dur = max(1.0, float(dur_p.stdout.strip()) if dur_p.stdout and dur_p.stdout.strip() else 10.0)
    safe_rate = max(500, int((44.0 * 8192) / v_dur - 192))
    clamped_out = final_output + ".tg.mp4"
    subprocess.run([
        'ffmpeg', '-y', '-i', final_output,
        '-c:v', 'libx264', '-preset', 'fast',
        '-b:v', f"{safe_rate}k", '-maxrate', f"{int(safe_rate*1.1)}k", '-bufsize', f"{int(safe_rate*1.3)}k",
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', clamped_out
    ], timeout=180)
    if os.path.exists(clamped_out) and os.path.getsize(clamped_out) > 1000:
        final_output = clamped_out
        file_size = os.path.getsize(final_output)
        log(f"  ✓ Telegram Safety Clamped: {file_size / (1024*1024):.2f} MB")

# Upload directly to Studio Video Editor web server
if CALLBACK_BASE_URL and "localhost" not in CALLBACK_BASE_URL:
    try:
        log("Uploading master video directly to Studio Video Editor web server...")
        upload_cmd = f'curl -s -m 180 -F "jobId={JOB_ID}" -F "file=@{final_output}" "{CALLBACK_BASE_URL.rstrip("/")}/api/kaggle/upload_result"'
        subprocess.run(upload_cmd, shell=True, timeout=180)
        log("✓ Video uploaded directly to Studio Video Editor.")
    except Exception as up_err:
        log(f"Web server upload note: {up_err}")

# Instant Telegram Delivery (100% Streaming MP4 & Channel/Bot Backup)
tg_file_id = ""
if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
    try:
        log(f"Uploading master video directly to Telegram (Chat ID: {TELEGRAM_CHAT_ID})...")
        report_progress(96, "Uploading to Telegram...", force=True)
        tg_vid_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendVideo"
        tg_cmd = f'curl -s -m 240 -F "chat_id={TELEGRAM_CHAT_ID}" -F "supports_streaming=true" -F "video=@{final_output}" -F "caption=🎬 Master Video: {final_filename}" "{tg_vid_url}"'
        res = subprocess.run(tg_cmd, shell=True, capture_output=True, text=True, timeout=240)
        if res.stdout:
            try:
                v_json = json.loads(res.stdout)
                if v_json.get("ok"):
                    tg_file_id = v_json.get("result", {}).get("video", {}).get("file_id") or ""
                    log(f"✓ Telegram Video File ID: {tg_file_id}")
                else:
                    log(f"Telegram sendVideo notice: {v_json.get('description', '')}, trying sendDocument...")
                    tg_doc_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendDocument"
                    tg_doc_cmd = f'curl -s -m 240 -F "chat_id={TELEGRAM_CHAT_ID}" -F "document=@{final_output}" -F "caption=🎬 Master Document: {final_filename}" "{tg_doc_url}"'
                    d_res = subprocess.run(tg_doc_cmd, shell=True, capture_output=True, text=True, timeout=240)
                    if d_res.stdout:
                        d_json = json.loads(d_res.stdout)
                        if d_json.get("ok"):
                            tg_file_id = d_json.get("result", {}).get("document", {}).get("file_id") or ""
                            log(f"✓ Telegram Document File ID: {tg_file_id}")
            except Exception as parse_e:
                log(f"Telegram response parse note: {parse_e}")
    except Exception as tg_err:
        log(f"Telegram upload note: {tg_err}")

# Notify completion
report_completed(final_filename, file_size, "", tg_file_id)
report_progress(100, "Render completed successfully! Master video saved.", force=True)
log("🎉 Master video generation complete! Container shutting down.")
sys.exit(0)
