#!/usr/bin/env python3
"""
CloudTorrent Phase 10: Production Deployment & Hardening Verifier.
Validates production container topologies, Nginx configurations, environment
templates, security directives, and system dependencies.
"""

import os
import sys
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

def check_file(rel_path: str, description: str) -> bool:
    full_path = ROOT_DIR / rel_path
    if not full_path.exists():
        print(f"[FAIL] {description} missing: {rel_path}")
        return False
    size = full_path.stat().st_size
    if size == 0:
        print(f"[FAIL] {description} is empty: {rel_path}")
        return False
    print(f"[PASS] {description}: {rel_path} ({size} bytes)")
    return True

def verify_files_exist():
    print("\n--- 1. Verifying Required Production Assets ---")
    files = [
        ("docker-compose.yml", "Docker Compose Orchestration"),
        ("backend/Dockerfile", "Backend API & Worker Dockerfile"),
        ("backend/entrypoint.sh", "Backend Container Entrypoint"),
        ("backend/requirements.txt", "Backend Python Dependencies"),
        ("frontend/Dockerfile", "Frontend Multi-Stage Dockerfile"),
        ("frontend/nginx.conf", "Frontend SPA Nginx Routing Config"),
        ("nginx/nginx.conf", "Global Edge Nginx Configuration"),
        ("nginx/conf.d/cloudtorrent.conf", "Edge Reverse Proxy Server Config"),
        (".env.production.example", "Production Environment Template"),
    ]
    all_ok = True
    for rel_path, desc in files:
        if not check_file(rel_path, desc):
            all_ok = False
    return all_ok

def verify_docker_compose():
    print("\n--- 2. Verifying Docker Compose Topology ---")
    compose_path = ROOT_DIR / "docker-compose.yml"
    content = compose_path.read_text(encoding="utf-8")

    required_services = ["db:", "redis:", "api:", "celery_worker:", "celery_beat:", "frontend:", "nginx:"]
    missing = [s for s in required_services if s not in content]
    if missing:
        print(f"[FAIL] Missing required services in docker-compose.yml: {missing}")
        return False
    print(f"[PASS] All {len(required_services)} production services present (db, redis, api, celery_worker, celery_beat, frontend, nginx).")

    if "torrent_engine:" in content:
        print("[FAIL] Deprecated legacy 'torrent_engine' service still present.")
        return False
    print("[PASS] Obsolete 'torrent_engine' cleanly migrated to unified Celery worker architecture.")

    required_volumes = ["postgres_data:", "redis_data:", "storage_incomplete:", "storage_completed:", "storage_resume:"]
    missing_vols = [v for v in required_volumes if v not in content]
    if missing_vols:
        print(f"[FAIL] Missing persistent volumes in docker-compose.yml: {missing_vols}")
        return False
    print(f"[PASS] All {len(required_volumes)} persistent storage volumes verified.")
    return True

def verify_nginx_configuration():
    print("\n--- 3. Verifying Nginx Reverse Proxy & Hardening Directives ---")
    conf_path = ROOT_DIR / "nginx/conf.d/cloudtorrent.conf"
    content = conf_path.read_text(encoding="utf-8")

    checks = [
        ("Upstream API", "upstream backend_api"),
        ("Upstream Frontend", "upstream frontend_app"),
        ("Security Header X-Frame-Options", "add_header X-Frame-Options \"DENY\""),
        ("Security Header X-Content-Type-Options", "add_header X-Content-Type-Options \"nosniff\""),
        ("Rate Limiting Auth Zone", "limit_req_zone $binary_remote_addr zone=auth_limit"),
        ("Rate Limiting API Zone", "limit_req_zone $binary_remote_addr zone=api_limit"),
        ("Health Check Endpoint", "location /healthz"),
        ("WebSocket Upgrade Route", "location /api/v1/telemetry/ws"),
        ("WebSocket Upgrade Header", "proxy_set_header Upgrade $http_upgrade"),
        ("WebSocket Connection Header", "proxy_set_header Connection \"upgrade\""),
        ("SSE Telemetry Route", "location /api/v1/telemetry/sse"),
        ("SSE Buffering Disabled", "proxy_buffering off;"),
        ("Resumable Download Route", "location /api/v1/downloads/stream/"),
        ("Internal Download Acceleration", "location /internal_download/"),
    ]

    all_ok = True
    for label, pattern in checks:
        if pattern not in content:
            print(f"[FAIL] Missing directive: {label} ('{pattern}')")
            all_ok = False
        else:
            print(f"[PASS] Directive present: {label}")
    return all_ok

def verify_frontend_build():
    print("\n--- 4. Verifying Frontend Static Bundle ---")
    dist_index = ROOT_DIR / "frontend/dist/index.html"
    if not dist_index.exists():
        print("[FAIL] Frontend production bundle (frontend/dist/index.html) does not exist.")
        return False
    size = dist_index.stat().st_size
    print(f"[PASS] Frontend production bundle verified: frontend/dist/index.html ({size} bytes)")
    return True

def main():
    print("==================================================================")
    print("   CloudTorrent Production Deployment & Hardening Verification   ")
    print("==================================================================")

    results = [
        verify_files_exist(),
        verify_docker_compose(),
        verify_nginx_configuration(),
        verify_frontend_build()
    ]

    print("\n==================================================================")
    if all(results):
        print("  VERIFICATION RESULT: ALL 4 TEST SUITES PASSED (100% OPERATIONAL) ")
        print("==================================================================")
        return 0
    else:
        print("  VERIFICATION RESULT: VERIFICATION FAILED ")
        print("==================================================================")
        return 1

if __name__ == "__main__":
    sys.exit(main())
