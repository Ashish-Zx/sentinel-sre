from backend.services.mcp import _normalize_repo, _slugify


def test_normalize_repo_owner_slash_name():
    assert _normalize_repo("asisasissah/primary") == "asisasissah/primary"


def test_normalize_repo_full_url():
    assert (
        _normalize_repo("https://github.com/asisasissah/primary")
        == "asisasissah/primary"
    )


def test_normalize_repo_with_git_suffix():
    assert (
        _normalize_repo("https://github.com/asisasissah/primary.git")
        == "asisasissah/primary"
    )


def test_normalize_repo_trailing_slash():
    assert _normalize_repo("asisasissah/primary/") == "asisasissah/primary"


def test_normalize_repo_empty_falls_back_to_default():
    assert _normalize_repo("") == ""


def test_slugify_lowercases_and_dashes():
    assert _slugify("Hotfix: KeyError in Checkout") == "hotfix--keyerror-in-checkout"


def test_slugify_empty_returns_hotfix():
    assert _slugify("!!!") == "hotfix"
