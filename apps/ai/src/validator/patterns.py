"""A6 Validator — V1 pattern cấm (BUILD_SPEC C5). Bộ khởi điểm, mở rộng theo compliance."""

from __future__ import annotations

import re

# Nhóm cam kết
CAM_KET = re.compile(
    r"(cam k[ế|e]t|ch[ắ|a]c ch[ắ|a]n|đ[ả|a]m b[ả|a]o)\s*(l[ã|a]i|sinh l[ờ|o]i|l[ợ|o]i nhu[ậ|a]n)?"
    r"|kh[ô|o]ng r[ủ|u]i ro|an to[à|a]n tuy[ệ|e]t đ[ố|o]i",
    re.IGNORECASE,
)

# Nhóm hành động chưa xảy ra (không có transaction thật)
HANH_DONG = re.compile(
    r"(em |anh |ch[ị|i] )?(đ[ã|a]|v[ừ|u]a)\s*(n[â|a]ng|m[ở|o]|t[ạ|a]o|l[à|a]m l[ệ|e]nh|k[í|i]ch ho[ạ|a]t)",
    re.IGNORECASE,
)

# Nhóm số liệu: mọi chuỗi số kèm đơn vị trong hook phải khớp slots_used (đối chiếu ở engine)
SO_LIEU = re.compile(r"\d[\d.,]*\s*(%|tri[ệ|e]u|tr\b|nghìn|ng[à|a]n|đ|vnd)", re.IGNORECASE)

# Nhóm PII: số ID/CCCD/số tài khoản lọt vào hook
PII = re.compile(r"\b\d{9,12}\b")

PATTERN_GROUPS = {
    "cam_ket": CAM_KET,
    "hanh_dong_chua_xay_ra": HANH_DONG,
    "pii": PII,
}
