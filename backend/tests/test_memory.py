from backend.services.memory import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    EMBEDDING_DIM,
    _pseudo_embedding,
    chunk_text,
)


def test_chunk_text_empty():
    assert chunk_text("") == []


def test_chunk_text_single_small_block():
    text = "hello world"
    chunks = chunk_text(text)
    assert chunks == ["hello world"]


def test_chunk_text_overlap_obeys_size():
    tokens = " ".join(f"token{i}" for i in range(2000))
    chunks = chunk_text(tokens)
    assert len(chunks) > 1
    for chunk in chunks:
        n_tokens = len(chunk.split())
        assert n_tokens <= CHUNK_SIZE


def test_chunk_text_steps_by_size_minus_overlap():
    tokens = " ".join(f"w{i}" for i in range(1000))
    chunks = chunk_text(tokens)
    # Adjacent chunks should overlap by ~CHUNK_OVERLAP tokens
    a = chunks[0].split()
    b = chunks[1].split()
    # last (CHUNK_OVERLAP) tokens of a == first of b
    assert a[-CHUNK_OVERLAP:] == b[:CHUNK_OVERLAP]


def test_pseudo_embedding_dimension_and_normalized():
    vec = _pseudo_embedding("some document text here")
    assert len(vec) == EMBEDDING_DIM
    norm = sum(v * v for v in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-6


def test_pseudo_embedding_deterministic():
    a = _pseudo_embedding("same input")
    b = _pseudo_embedding("same input")
    assert a == b
