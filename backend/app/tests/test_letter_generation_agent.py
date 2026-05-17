import pytest
from app.agents.letter_generation_agent import LetterGenerationAgent
from app.models.recommendation_letter import LetterTone


async def _make_subject_with_entries(client, auth_headers, n=3):
    s = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Letter Subject", "relationship_type": "direct report"
    })
    subject_id = s.json()["id"]
    for i in range(n):
        await client.post(f"/subjects/{subject_id}/entries", headers=auth_headers, json={
            "raw_text": f"Entry {i}: showed strong initiative.",
            "tags": [],
        })
    return subject_id


@pytest.mark.asyncio
async def test_letter_streams_text(db, org_and_user, client, auth_headers):
    org, user = org_and_user
    import uuid
    subject_id_str = await _make_subject_with_entries(client, auth_headers)
    subject_id = uuid.UUID(subject_id_str)

    agent = LetterGenerationAgent(db)
    stream = await agent.generate(
        subject_id=subject_id,
        org_id=org.id,
        requesting_user_id=user.id,
        purpose="graduate school application",
        tone=LetterTone.warm,
    )

    chunks = []
    async for chunk in stream:
        chunks.append(chunk)

    assert len(chunks) > 0
    full_text = "".join(chunks)
    assert len(full_text) > 100


@pytest.mark.asyncio
async def test_letter_persisted_after_stream(db, org_and_user, client, auth_headers):
    from sqlalchemy import select
    from app.models.recommendation_letter import RecommendationLetter
    org, user = org_and_user
    import uuid
    subject_id_str = await _make_subject_with_entries(client, auth_headers)
    subject_id = uuid.UUID(subject_id_str)

    agent = LetterGenerationAgent(db)
    stream = await agent.generate(
        subject_id=subject_id,
        org_id=org.id,
        requesting_user_id=user.id,
        purpose="job application",
        tone=LetterTone.formal,
    )
    async for _ in stream:
        pass

    result = await db.execute(
        select(RecommendationLetter).where(
            RecommendationLetter.subject_id == subject_id,
            RecommendationLetter.org_id == org.id,
        )
    )
    letter = result.scalar_one_or_none()
    assert letter is not None
    assert letter.letter_text is not None
    assert len(letter.letter_text) > 100


@pytest.mark.asyncio
async def test_sparse_warning_in_sse(client, auth_headers):
    # Create subject with only 1 entry (< 3 threshold)
    s = await client.post("/subjects", headers=auth_headers, json={
        "full_name": "Sparse Subject", "relationship_type": "student"
    })
    subject_id = s.json()["id"]
    await client.post(f"/subjects/{subject_id}/entries", headers=auth_headers, json={
        "raw_text": "One entry only.", "tags": []
    })

    resp = await client.post("/letters/generate", headers=auth_headers, json={
        "subject_id": subject_id,
        "purpose": "test",
        "tone": "balanced",
    })
    assert resp.status_code == 200
    content = resp.text
    assert "warning" in content
