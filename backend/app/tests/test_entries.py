import pytest


async def _create_subject(client, headers):
    resp = await client.post("/subjects", headers=headers, json={
        "full_name": "Entry Test Subject",
        "relationship_type": "direct report",
    })
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_and_list_entries(client, auth_headers):
    subject_id = await _create_subject(client, auth_headers)

    resp = await client.post(f"/subjects/{subject_id}/entries", headers=auth_headers, json={
        "raw_text": "Alice handled the deployment exceptionally well today.",
        "tags": ["deployment", "reliability"],
    })
    assert resp.status_code == 201
    entry_id = resp.json()["id"]
    assert resp.json()["tags"] == ["deployment", "reliability"]

    list_resp = await client.get(f"/subjects/{subject_id}/entries", headers=auth_headers)
    assert list_resp.status_code == 200
    ids = [e["id"] for e in list_resp.json()["items"]]
    assert entry_id in ids


@pytest.mark.asyncio
async def test_delete_entry(client, auth_headers):
    subject_id = await _create_subject(client, auth_headers)

    create_resp = await client.post(f"/subjects/{subject_id}/entries", headers=auth_headers, json={
        "raw_text": "Entry to be deleted.",
        "tags": [],
    })
    entry_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/entries/{entry_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    list_resp = await client.get(f"/subjects/{subject_id}/entries", headers=auth_headers)
    ids = [e["id"] for e in list_resp.json()["items"]]
    assert entry_id not in ids


@pytest.mark.asyncio
async def test_cross_org_entry_access(client):
    resp1 = await client.post("/auth/register", json={
        "email": "e_org1@test.com", "password": "pass", "org_name": "EOrd1"
    })
    h1 = {"Authorization": f"Bearer {resp1.json()['access_token']}"}

    resp2 = await client.post("/auth/register", json={
        "email": "e_org2@test.com", "password": "pass", "org_name": "EOrd2"
    })
    h2 = {"Authorization": f"Bearer {resp2.json()['access_token']}"}

    # Org1 creates subject + entry
    s = await client.post("/subjects", headers=h1, json={
        "full_name": "Cross Org Subject", "relationship_type": "student"
    })
    subject_id = s.json()["id"]
    e = await client.post(f"/subjects/{subject_id}/entries", headers=h1, json={
        "raw_text": "Private note.", "tags": []
    })
    entry_id = e.json()["id"]

    # Org2 tries to delete Org1's entry — must fail
    del_resp = await client.delete(f"/entries/{entry_id}", headers=h2)
    assert del_resp.status_code == 404
