from backend.services.mcp import _apply_patch, _normalize_repo, _slugify


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


def test_apply_patch_replaces_buggy_line():
    # Recreate the sample-product bug: promo_info["discount_rate"] -> promo_info.discount_rate
    lines = [f"line{i}" for i in range(1, 40)]
    lines[36] = '                rate = promo_info["discount_rate"]'
    original = "\n".join(lines) + "\n"
    patch = (
        "@@ -37,1 +37,1 @@\n"
        '-                rate = promo_info["discount_rate"]\n'
        "+                rate = promo_info.discount_rate\n"
    )
    result = _apply_patch(original, patch)
    assert result is not None
    assert result.splitlines()[36] == "                rate = promo_info.discount_rate"
    assert result.splitlines()[0] == "line1"
    assert result.splitlines()[38] == "line39"


def test_apply_patch_returns_none_on_bad_hunk():
    assert _apply_patch("a\nb\nc\n", "not a diff") is None
