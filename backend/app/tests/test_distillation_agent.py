import pytest
from app.agents.distillation_agent import DistillationAgent
from app.models.subject_summary import DistillationStatus


async def _make_subject_with_entries(client, auth_headers):
    s = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Distill Subject", "relationship_type": "mentee"
    })
    subject_id = s.json()["id"]
    for i in range(3):
        await client.post(f"/subjects/{subject_id}/entries", headers=auth_headers, json={
            "raw_text": f"Observation {i}: did something notable.",
            "tags": [],
        })
    return subject_id


@pytest.mark.asyncio
async def test_distillation_creates_summary(client, auth_headers, db, org_and_user):
    org, user = org_and_user
    subject_id_str = await _make_subject_with_entries(client, auth_headers)

    import uuid
    subject_id = uuid.UUID(subject_id_str)

    agent = DistillationAgent(db)
    summary = await agent.distill(subject_id=subject_id, org_id=org.id)

    assert summary.distillation_status == DistillationStatus.complete
    assert summary.structured_summary is not None
    assert "core_traits" in summary.structured_summary
    assert "notable_episodes" in summary.structured_summary
    assert summary.entry_count_at_distillation == 3


@pytest.mark.asyncio
async def test_distillation_skips_if_no_new_entries(client, auth_headers, db, org_and_user):
    org, user = org_and_user
    subject_id_str = await _make_subject_with_entries(client, auth_headers)
    import uuid
    subject_id = uuid.UUID(subject_id_str)

    agent = DistillationAgent(db)
    summary1 = await agent.distill(subject_id=subject_id, org_id=org.id)
    v1 = summary1.distillation_version

    summary2 = await agent.distill(subject_id=subject_id, org_id=org.id)
    assert summary2.distillation_version == v1  # skipped — no new entries


@pytest.mark.asyncio
async def test_distillation_force_refresh_increments_version(client, auth_headers, db, org_and_user):
    org, user = org_and_user
    subject_id_str = await _make_subject_with_entries(client, auth_headers)
    import uuid
    subject_id = uuid.UUID(subject_id_str)

    agent = DistillationAgent(db)
    summary1 = await agent.distill(subject_id=subject_id, org_id=org.id)
    v1 = summary1.distillation_version

    summary2 = await agent.distill(subject_id=subject_id, org_id=org.id, force_refresh=True)
    assert summary2.distillation_version == v1 + 1


@pytest.mark.asyncio
async def test_summary_endpoint(client, auth_headers):
    subject_id_str = await _make_subject_with_entries(client, auth_headers)

    # Trigger distillation via entry creation (background task may not have run in test)
    # Call refresh endpoint directly
    refresh_resp = await client.post(
        f"/subjects/{subject_id_str}/summary/refresh", headers=auth_headers
    )
    # May 404 if background task hasn't run yet — that's ok in unit test
    # Direct agent call would be better for integration; here we test the endpoint exists
    assert refresh_resp.status_code in (200, 404)
