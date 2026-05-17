import pytest


@pytest.mark.asyncio
async def test_register_creates_user_and_org(client):
    resp = await client.post("/auth/register", json={
        "email": "newuser@example.com",
        "password": "secret123",
        "org_name": "New Org",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_register_duplicate_email_fails(client):
    payload = {"email": "dup@example.com", "password": "pass", "org_name": "Org"}
    await client.post("/auth/register", json=payload)
    resp = await client.post("/auth/register", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client, org_and_user):
    _, user = org_and_user
    resp = await client.post("/auth/login", json={"email": user.email, "password": "testpass"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client, org_and_user):
    _, user = org_and_user
    resp = await client.post("/auth/login", json={"email": user.email, "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user(client, auth_headers):
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert "email" in resp.json()


@pytest.mark.asyncio
async def test_me_without_token_fails(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 403
