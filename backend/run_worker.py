import subprocess
import sys
import time
import os

def main():
    print("==================================================================")
    print("  CloudTorrent Windows Celery Worker & Beat Scheduler")
    print("==================================================================")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # On Windows, Celery worker and beat must run as distinct processes
    worker_cmd = [
        sys.executable, "-m", "celery",
        "-A", "app.core.celery_app.celery_app",
        "worker",
        "--loglevel=info",
        "-P", "solo",
        "--without-gossip",
        "--without-mingle",
        "--without-heartbeat"
    ]
    
    beat_cmd = [
        sys.executable, "-m", "celery",
        "-A", "app.core.celery_app.celery_app",
        "beat",
        "--loglevel=info"
    ]

    print("[*] Launching Celery Worker (Pool: solo)...")
    worker_proc = subprocess.Popen(worker_cmd)
    
    time.sleep(1)
    print("[*] Launching Celery Beat Scheduler...")
    beat_proc = subprocess.Popen(beat_cmd)
    
    print("\n[OK] Celery Worker and Beat Scheduler are running in the background.")
    print("     Press Ctrl+C or close this window to stop both services.\n")
    
    try:
        while True:
            time.sleep(1)
            if worker_proc.poll() is not None:
                print("Celery worker exited.")
                break
            if beat_proc.poll() is not None:
                print("Celery beat scheduler exited.")
                break
    except KeyboardInterrupt:
        print("\nStopping Celery worker and beat...")
    finally:
        try:
            worker_proc.terminate()
        except Exception:
            pass
        try:
            beat_proc.terminate()
        except Exception:
            pass
        print("Celery processes stopped.")

if __name__ == "__main__":
    main()
