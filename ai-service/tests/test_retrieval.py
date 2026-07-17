import pytest


@pytest.mark.parametrize("domain", ["credit", "compliance", "operations"])
async def test_seed_retrieval_returns_stable_grounded_citations(retriever, domain) -> None:
    first = await retriever.retrieve("policy review required documents hard stop", domain, 1)
    second = await retriever.retrieve("policy review required documents hard stop", domain, 1)
    assert first == second
    assert len(first) == 1
    assert first[0].id.startswith("citation:")
    assert first[0].document_id.startswith("sf-")
    assert first[0].excerpt.startswith("DEMO DATA.")
