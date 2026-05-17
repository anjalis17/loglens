import pytest
import uuid


@pytest.mark.asyncio
async def test_create_and_list_subject(client, auth_headers):
    resp = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Jane Doe",
        "role_title": "Engineer",
        "relationship_type": "direct report",
    })
    assert resp.status_code == 201
    subject_id = resp.json()["id"]

    list_resp = await client.get("/subjects", headers=auth_headers)
    assert list_resp.status_code == 200
    ids = [s["id"] for s in list_resp.json()]
    assert subject_id in ids


@pytest.mark.asyncio
async def test_get_subject(client, auth_headers):
    resp = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Bob Smith",
        "relationship_type": "mentee",
    })
    subject_id = resp.json()["id"]

    get_resp = await client.get(f"/subjects/{subject_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["full_name"] == "Bob Smith"


@pytest.mark.asyncio
async def test_update_subject(client, auth_headers):
    resp = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Old Name",
        "relationship_type": "student",
    })
    subject_id = resp.json()["id"]

    put_resp = await client.put(f"/subjects/{subject_id}", headers=auth_headers, json={"full_name": "New Name"})
    assert put_resp.status_code == 200
    assert put_resp.json()["full_name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_subject(client, auth_headers):
    resp = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "To Delete",
        "relationship_type": "colleague",
    })
    subject_id = resp.json()["id"]

    del_resp = await client.delete(f"/subjects/{subject_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/subjects/{subject_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_cross_org_subject_access_returns_404(client):
    # Register two separate orgs
    resp1 = await client.post("/auth/register", json={
        "email": "org1user@test.com", "password": "pass", "org_name": "Org1"
    })
    token1 = resp1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    resp2 = await client.post("/auth/register", json={
        "email": "org2user@test.com", "password": "pass", "org_name": "Org2"
    })
    token2 = resp2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Org1 creates a subject
    create_resp = await client.post("/subjects", headers=headers1, json={
        "full_name": "Private Subject",
        "relationship_type": "direct report",
    })
    subject_id = create_resp.json()["id"]

    # Org2 tries to access it — must get 404, not 200
    get_resp = await client.get(f"/subjects/{subject_id}", headers=headers2)
    assert get_resp.status_code == 404
