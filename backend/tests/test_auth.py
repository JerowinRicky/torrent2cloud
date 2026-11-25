import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.auth_service import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD

@pytest.mark.asyncio
async def test_auth_flow_e2e():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Trigger startup lifespan to ensure admin exists
        async with app.router.lifespan_context(app):
            random_suffix = uuid.uuid4().hex[:8]
            test_email = f"user_{random_suffix}@example.com"

            # 1. Login with bad credentials
            bad_login = await client.post("/api/v1/auth/login", json={
                "email": DEFAULT_ADMIN_EMAIL,
                "password": "wrong_password"
            })
            assert bad_login.status_code == 401

            # 2. Login as Administrator
            admin_login = await client.post("/api/v1/auth/login", json={
                "email": DEFAULT_ADMIN_EMAIL,
                "password": DEFAULT_ADMIN_PASSWORD
            })
            assert admin_login.status_code == 200
            admin_tokens = admin_login.json()
            assert "access_token" in admin_tokens
            assert "refresh_token" in admin_tokens
            assert admin_tokens["user"]["role"] == "ADMIN"
            admin_auth_header = {"Authorization": f"Bearer {admin_tokens['access_token']}"}

            # 3. Verify /me endpoint
            me_res = await client.get("/api/v1/auth/me", headers=admin_auth_header)
            assert me_res.status_code == 200
            assert me_res.json()["email"] == DEFAULT_ADMIN_EMAIL

            # 4. Admin creates an invitation code
            inv_res = await client.post(
                "/api/v1/auth/invitations",
                headers=admin_auth_header,
                json={"email": test_email, "expires_in_days": 7}
            )
            assert inv_res.status_code == 201
            invitation = inv_res.json()
            inv_code = invitation["code"]
            assert inv_code.startswith("ct-")

            # 5. Validate the invitation code
            val_res = await client.get(f"/api/v1/auth/invitations/validate/{inv_code}")
            assert val_res.status_code == 200
            val_data = val_res.json()
            assert val_data["valid"] is True

            # 6. Register a new user with the invitation code
            reg_res = await client.post("/api/v1/auth/register", json={
                "invitation_code": inv_code,
                "email": test_email,
                "password": "SecurePassword123!",
                "full_name": "Test User"
            })
            assert reg_res.status_code == 201
            new_user = reg_res.json()
            assert new_user["role"] == "USER"
            assert new_user["email"] == test_email

            # 7. Attempt to re-use claimed invitation (must be rejected)
            reuse_res = await client.post("/api/v1/auth/register", json={
                "invitation_code": inv_code,
                "email": f"another_{random_suffix}@example.com",
                "password": "SecurePassword123!",
                "full_name": "Another User"
            })
            assert reuse_res.status_code == 400

            # 8. User logs in
            user_login = await client.post("/api/v1/auth/login", json={
                "email": test_email,
                "password": "SecurePassword123!"
            })
            assert user_login.status_code == 200
            user_tokens = user_login.json()
            user_auth_header = {"Authorization": f"Bearer {user_tokens['access_token']}"}

            # 9. Verify normal user cannot create invitations (RBAC check)
            forbidden_inv = await client.post(
                "/api/v1/auth/invitations",
                headers=user_auth_header,
                json={"email": f"unauthorized_{random_suffix}@example.com"}
            )
            assert forbidden_inv.status_code == 403

            # 10. Refresh token rotation test
            refresh_res = await client.post("/api/v1/auth/refresh", json={
                "refresh_token": user_tokens["refresh_token"]
            })
            assert refresh_res.status_code == 200
            rotated_tokens = refresh_res.json()
            assert rotated_tokens["access_token"] != user_tokens["access_token"]

            # 11. Old refresh token cannot be used again (replay prevention)
            stale_refresh = await client.post("/api/v1/auth/refresh", json={
                "refresh_token": user_tokens["refresh_token"]
            })
            assert stale_refresh.status_code == 401

            # 12. Password change
            pwd_res = await client.put(
                "/api/v1/auth/password",
                headers={"Authorization": f"Bearer {rotated_tokens['access_token']}"},
                json={
                    "current_password": "SecurePassword123!",
                    "new_password": "NewSecurePassword456!"
                }
            )
            assert pwd_res.status_code == 200

            # 13. Logout
            logout_res = await client.post(
                "/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {rotated_tokens['access_token']}"},
                json={"refresh_token": rotated_tokens["refresh_token"]}
            )
            assert logout_res.status_code == 200
