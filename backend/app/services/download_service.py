import os
import re
import uuid
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from app.models.download import DownloadLink
from app.models.storage import StoredFile
from app.models.user import User
from app.schemas.download import DownloadLinkResponse
from app.core.security import create_download_token, decode_download_token, hash_token
from app.core.logging import logger

class DownloadService:

    @staticmethod
    async def generate_download_link(
        db: AsyncSession,
        user: User,
        file_id: uuid.UUID,
        expires_in_hours: int = 24,
        base_url: str = ""
    ) -> DownloadLinkResponse:
        """
        Creates a cryptographically signed, expiring download link for a stored cloud file.
        """
        # 1. Verify file ownership and availability
        file_stmt = select(StoredFile).where(
            and_(
                StoredFile.id == file_id,
                StoredFile.user_id == user.id,
                StoredFile.is_available == True
            )
        )
        file = (await db.execute(file_stmt)).scalars().first()
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or not available for download"
            )

        if not os.path.exists(file.storage_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Physical file does not exist on storage mount"
            )

        # 2. Issue link and signed token
        link_id = uuid.uuid4()
        token, expires_at = create_download_token(
            file_id=file.id,
            user_id=user.id,
            link_id=link_id,
            expires_delta=timedelta(hours=expires_in_hours)
        )

        download_link = DownloadLink(
            id=link_id,
            user_id=user.id,
            file_id=file.id,
            token=token,
            token_hash=hash_token(token),
            expires_at=expires_at,
            is_revoked=False,
            download_count=0
        )
        db.add(download_link)
        await db.commit()

        download_url = f"{base_url.rstrip('/')}/api/v1/downloads/file/{token}"

        from app.services.activity_service import ActivityService
        try:
            await ActivityService.log_event(
                db=db,
                event_type="DOWNLOAD_LINK_GENERATED",
                severity="INFO",
                title="Direct Download Link Generated",
                description=f"Issued {expires_in_hours}h signed download link for '{file.filename}'",
                user_id=user.id,
                entity_type="DOWNLOAD_LINK",
                entity_id=str(link_id),
                auto_commit=True
            )
        except Exception:
            pass

        return DownloadLinkResponse(
            link_id=download_link.id,
            file_id=file.id,
            token=token,
            download_url=download_url,
            expires_at=expires_at,
            is_revoked=False,
            download_count=0,
            last_downloaded_at=None,
            filename=file.filename,
            file_size=file.file_size,
            category=file.category,
            mime_type=file.mime_type
        )

    @staticmethod
    async def generate_multi_download_links(
        db: AsyncSession,
        user: User,
        file_ids: list[uuid.UUID],
        expires_in_hours: int = 24,
        base_url: str = ""
    ) -> list[DownloadLinkResponse]:
        """Generates individual signed download links for a collection of files."""
        links: list[DownloadLinkResponse] = []
        for fid in file_ids:
            try:
                link = await DownloadService.generate_download_link(
                    db=db,
                    user=user,
                    file_id=fid,
                    expires_in_hours=expires_in_hours,
                    base_url=base_url
                )
                links.append(link)
            except HTTPException:
                continue
        return links

    @staticmethod
    async def list_user_links(db: AsyncSession, user: User, base_url: str = "") -> list[DownloadLinkResponse]:
        """Lists active, unrevoked download links created by the user."""
        now = datetime.now(timezone.utc)
        stmt = select(DownloadLink).where(
            and_(
                DownloadLink.user_id == user.id,
                DownloadLink.is_revoked == False,
                DownloadLink.expires_at > now
            )
        ).order_by(desc(DownloadLink.created_at)).options(selectinload(DownloadLink.file))

        result = await db.execute(stmt)
        links = result.scalars().all()

        responses = []
        for l in links:
            if not l.file:
                continue
            responses.append(
                DownloadLinkResponse(
                    link_id=l.id,
                    file_id=l.file_id,
                    token=l.token,
                    download_url=f"{base_url.rstrip('/')}/api/v1/downloads/file/{l.token}",
                    expires_at=l.expires_at,
                    is_revoked=l.is_revoked,
                    download_count=l.download_count,
                    last_downloaded_at=l.last_downloaded_at,
                    filename=l.file.filename,
                    file_size=l.file.file_size,
                    category=l.file.category,
                    mime_type=l.file.mime_type
                )
            )
        return responses

    @staticmethod
    async def revoke_link(db: AsyncSession, user: User, link_id: uuid.UUID) -> bool:
        """Revokes a specific download link, instantly blocking further downloads."""
        stmt = select(DownloadLink).where(
            and_(
                DownloadLink.id == link_id,
                DownloadLink.user_id == user.id
            )
        )
        link = (await db.execute(stmt)).scalars().first()
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download link not found")

        link.is_revoked = True
        await db.commit()

        from app.services.activity_service import ActivityService
        try:
            await ActivityService.log_event(
                db=db,
                event_type="DOWNLOAD_LINK_REVOKED",
                severity="WARNING",
                title="Download Link Revoked",
                description=f"Revoked signed link {link_id}",
                user_id=user.id,
                entity_type="DOWNLOAD_LINK",
                entity_id=str(link_id),
                auto_commit=True
            )
        except Exception:
            pass

        return True

    @staticmethod
    async def stream_download(
        db: AsyncSession,
        token: str,
        range_header: str | None = None
    ) -> StreamingResponse:
        """
        Validates signed token and streams file with full HTTP Range resume support.
        Operates without loading the full file into server RAM.
        """
        # 1. Decode token
        try:
            payload = decode_download_token(token)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

        link_id_str = payload.get("link_id")
        if not link_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token structure")

        try:
            link_id = uuid.UUID(link_id_str)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token link identifier")

        # 2. Check DB revocation and expiration status
        stmt = select(DownloadLink).where(DownloadLink.id == link_id).options(selectinload(DownloadLink.file))
        link = (await db.execute(stmt)).scalars().first()
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Download link record not found")

        if link.is_revoked:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This download link has been revoked")

        now = datetime.now(timezone.utc)
        if link.expires_at < now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="This download link has expired")

        file = link.file
        if not file or not file.is_available:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File is no longer available in storage")

        file_path = Path(file.storage_path)
        if not file_path.is_file() or not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on physical disk")

        # 3. Update download telemetry counter
        link.download_count += 1
        link.last_downloaded_at = now
        await db.commit()

        total_size = file_path.stat().st_size

        # Format RFC 6266 / RFC 5987 Content-Disposition
        safe_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
        quoted_filename = urllib.parse.quote(file.filename, encoding="utf-8")
        content_disposition = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{quoted_filename}'

        # 4. Handle HTTP Range Requests
        start = 0
        end = total_size - 1
        status_code = status.HTTP_200_OK

        if range_header:
            range_match = re.match(r"^bytes=(\d*)-(\d*)$", range_header.strip())
            if range_match:
                start_str, end_str = range_match.groups()
                if start_str and end_str:
                    start = int(start_str)
                    end = int(end_str)
                elif start_str:
                    start = int(start_str)
                    end = total_size - 1
                elif end_str:
                    suffix_length = int(end_str)
                    start = max(0, total_size - suffix_length)
                    end = total_size - 1

                # Validate range
                if start > end or start >= total_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
                        headers={"Content-Range": f"bytes */{total_size}"}
                    )

                end = min(end, total_size - 1)
                status_code = status.HTTP_206_PARTIAL_CONTENT

        content_length = end - start + 1

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": file.mime_type or "application/octet-stream",
            "Content-Disposition": content_disposition,
        }

        if status_code == status.HTTP_206_PARTIAL_CONTENT:
            headers["Content-Range"] = f"bytes {start}-{end}/{total_size}"

        # 5. Asynchronous chunk generator
        async def file_chunk_generator() -> AsyncGenerator[bytes, None]:
            chunk_size = 128 * 1024  # 128 KB chunks
            remaining = content_length
            with open(file_path, "rb") as f:
                f.seek(start)
                while remaining > 0:
                    bytes_to_read = min(chunk_size, remaining)
                    data = f.read(bytes_to_read)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            file_chunk_generator(),
            status_code=status_code,
            headers=headers
        )
