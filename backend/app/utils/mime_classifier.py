import os
import mimetypes

CATEGORY_MAPPING = {
    # Videos
    "mp4": "VIDEOS", "mkv": "VIDEOS", "avi": "VIDEOS", "mov": "VIDEOS", 
    "wmv": "VIDEOS", "flv": "VIDEOS", "webm": "VIDEOS", "m4v": "VIDEOS", 
    "ts": "VIDEOS", "mpg": "VIDEOS", "mpeg": "VIDEOS", "3gp": "VIDEOS", "vob": "VIDEOS",
    
    # Audio
    "mp3": "AUDIO", "flac": "AUDIO", "wav": "AUDIO", "aac": "AUDIO", 
    "ogg": "AUDIO", "m4a": "AUDIO", "wma": "AUDIO", "opus": "AUDIO", 
    "aiff": "AUDIO", "mid": "AUDIO", "midi": "AUDIO",
    
    # Images
    "jpg": "IMAGES", "jpeg": "IMAGES", "png": "IMAGES", "gif": "IMAGES", 
    "webp": "IMAGES", "svg": "IMAGES", "bmp": "IMAGES", "tiff": "IMAGES", 
    "ico": "IMAGES", "heic": "IMAGES",
    
    # Documents
    "pdf": "DOCUMENTS", "doc": "DOCUMENTS", "docx": "DOCUMENTS", "txt": "DOCUMENTS", 
    "rtf": "DOCUMENTS", "odt": "DOCUMENTS", "xls": "DOCUMENTS", "xlsx": "DOCUMENTS", 
    "ppt": "DOCUMENTS", "pptx": "DOCUMENTS", "csv": "DOCUMENTS", "md": "DOCUMENTS",
    
    # Archives
    "zip": "ARCHIVES", "rar": "ARCHIVES", "7z": "ARCHIVES", "tar": "ARCHIVES", 
    "gz": "ARCHIVES", "bz2": "ARCHIVES", "xz": "ARCHIVES", "zst": "ARCHIVES", 
    "tgz": "ARCHIVES", "deb": "ARCHIVES", "rpm": "ARCHIVES",
    
    # Disk Images
    "iso": "DISK_IMAGES", "img": "DISK_IMAGES", "dmg": "DISK_IMAGES", 
    "vmdk": "DISK_IMAGES", "qcow2": "DISK_IMAGES", "bin": "DISK_IMAGES", 
    "cue": "DISK_IMAGES", "nrg": "DISK_IMAGES",
    
    # Code
    "py": "CODE", "js": "CODE", "jsx": "CODE", "ts": "CODE", "tsx": "CODE", 
    "html": "CODE", "css": "CODE", "c": "CODE", "cpp": "CODE", "h": "CODE", 
    "hpp": "CODE", "rs": "CODE", "go": "CODE", "java": "CODE", "json": "CODE", 
    "yaml": "CODE", "yml": "CODE", "sh": "CODE", "bat": "CODE", "ps1": "CODE", 
    "sql": "CODE", "php": "CODE", "rb": "CODE", "xml": "CODE", "toml": "CODE",
}

CUSTOM_MIME_TYPES = {
    "mkv": "video/x-matroska",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "avi": "video/x-msvideo",
    "flac": "audio/flac",
    "mp3": "audio/mpeg",
    "opus": "audio/opus",
    "7z": "application/x-7z-compressed",
    "rar": "application/vnd.rar",
    "zip": "application/zip",
    "tar": "application/x-tar",
    "gz": "application/gzip",
    "iso": "application/x-iso9660-image",
    "dmg": "application/x-apple-diskimage",
    "epub": "application/epub+zip",
    "pdf": "application/pdf",
    "json": "application/json",
    "ts": "video/mp2t",
}

def classify_file(filename: str) -> tuple[str, str, str]:
    """
    Returns (extension, mime_type, category) for a given filename.
    """
    _, ext = os.path.splitext(filename)
    clean_ext = ext.lstrip(".").lower()
    
    # 1. Category
    category = CATEGORY_MAPPING.get(clean_ext, "OTHER")
    
    # 2. MIME type
    if clean_ext in CUSTOM_MIME_TYPES:
        mime = CUSTOM_MIME_TYPES[clean_ext]
    else:
        guessed, _ = mimetypes.guess_type(filename)
        mime = guessed or "application/octet-stream"
        
    return clean_ext, mime, category
