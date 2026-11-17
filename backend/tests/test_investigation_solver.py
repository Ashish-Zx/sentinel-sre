from backend.services.investigation import (
    _apply_patch as apply_patch_for_test,  # re-export for convenience
    _deterministic_fix,
    _extract_target,
)


def test_extract_target_parses_traceback():
    trace = (
        'File "app/services/checkout_service.py", line 37, in create_order\n'
        "    rate = promo_info[\"discount_rate\"]\n"
        "TypeError: 'PromoInfo' object is not subscriptable\n"
    )
    assert _extract_target(trace) == ("app/services/checkout_service.py", 37)


def test_deterministic_fix_subscriptable_typeerror():
    content = "X\n                rate = promo_info[\"discount_rate\"]\nY\n"
    error = "TypeError: 'PromoInfo' object is not subscriptable"
    patch = _deterministic_fix(content, error, "app/services/checkout_service.py", 2)
    assert patch is not None
    fixed = apply_patch_for_test(content, patch)
    assert "promo_info.discount_rate" in fixed
    assert 'promo_info["discount_rate"]' not in fixed


def test_deterministic_fix_keyerror():
    content = "a\n    discount = payload[\"discount_code\"]\nb\n"
    error = "KeyError: 'discount_code'"
    patch = _deterministic_fix(content, error, "api/checkout.py", 2)
    assert patch is not None
    fixed = apply_patch_for_test(content, patch)
    assert 'payload.get("discount_code")' in fixed


def test_deterministic_fix_returns_none_for_unhandled():
    content = "a\nprint(1)\nb\n"
    assert _deterministic_fix(content, "Some weird error", "x.py", 2) is None


def test_error_class_token_extracts_typeerror_class():
    from backend.services.investigation import _error_class_token

    assert (
        _error_class_token("TypeError: 'PromoInfo' object is not subscriptable")
        == "PromoInfo"
    )
    assert _error_class_token("KeyError: 'discount_code'") == "discount_code"
    assert _error_class_token("some other error") is None


def test_deterministic_fix_without_line_number_single_subscript():
    from backend.services.investigation import _deterministic_fix

    content = (
        "import uuid\n"
        "class PromoInfo: pass\n"
        "rate = promo_info[\"discount_rate\"]\n"
        "print(rate)\n"
    )
    error = "TypeError: 'PromoInfo' object is not subscriptable"
    patch = _deterministic_fix(content, error, "app/services/checkout_service.py", None)
    assert patch is not None
    fixed = apply_patch_for_test(content, patch)
    assert "promo_info.discount_rate" in fixed
    assert 'promo_info["discount_rate"]' not in fixed


def test_deterministic_fix_without_line_ambiguous_returns_none():
    from backend.services.investigation import _deterministic_fix

    content = 'x["a"]\ny["b"]\n'
    assert _deterministic_fix(content, "TypeError: 'X' object is not subscriptable", "x.py", None) is None


def test_scan_subscript_lines_skips_docstrings_and_comments():
    from backend.services.investigation import _scan_subscript_lines

    content = (
        '"""Doc example: promo_info["discount_rate"] should not match."""\n'
        "# comment: x[\"y\"]\n"
        '        rate = promo_info["discount_rate"]\n'
        "other = plain\n"
    )
    found = _scan_subscript_lines(content)
    assert len(found) == 1
    assert found[0][0] == 3

