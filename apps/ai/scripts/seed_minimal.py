"""Seed script: đổ product_catalog, tag_taxonomy, call_lists (T+0/T+1), model_weights v0
vào Supabase bằng psycopg2 (dùng DATABASE_URL từ .env).

Chạy: uv run python scripts/seed_minimal.py
"""
from __future__ import annotations
import json
import os
import sys
from datetime import date, timedelta

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DATABASE_URL = os.environ.get("AI_DATABASE_URL") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("AI_DATABASE_URL / DATABASE_URL chưa set trong .env")

try:
    import psycopg
except ImportError:
    sys.exit("Thiếu psycopg — chạy: uv sync")

conn = psycopg.connect(DATABASE_URL)

# ──────────────────────────────────────────────────────────────────────────────
# 1. product_catalog (nguồn slot filling duy nhất)
# ──────────────────────────────────────────────────────────────────────────────
CATALOG = [
    # (product, package, rate, fee, limit_min, limit_max, age_min, age_max, tier)
    ("the", "SHB Classic", 3.5, 250000, 5_000_000, 50_000_000, 18, 65, "standard"),
    ("the", "SHB Platinum", 2.9, 0, 20_000_000, 200_000_000, 21, 65, "premium"),
    ("vay", "Vay tiêu dùng tín chấp", 12.5, 0, 20_000_000, 300_000_000, 22, 60, "standard"),
    ("vay", "Vay mua nhà", 9.8, 0, 500_000_000, 5_000_000_000, 22, 55, "premium"),
    ("dautu", "Tiết kiệm 6 tháng", 5.0, 0, 1_000_000, 2_000_000_000, 18, 80, "standard"),
    ("dautu", "Tiết kiệm 12 tháng", 5.6, 0, 1_000_000, 2_000_000_000, 18, 80, "premium"),
    ("baohiem", "BH nhân thọ SHBLife Cơ bản", 0, 500_000, 100_000, 50_000_000, 18, 60, "standard"),
    ("baohiem", "BH nhân thọ SHBLife Toàn diện", 0, 1_200_000, 200_000, 200_000_000, 18, 55, "premium"),
    ("taikhoan", "Tài khoản thanh toán SHB Everyday", 0, 0, 0, 0, 18, 80, "standard"),
    ("taikhoan", "Tài khoản ưu tiên SHB Priority", 0, 0, 0, 0, 21, 80, "premium"),
]

with conn.cursor() as cur:
    cur.execute("TRUNCATE product_catalog RESTART IDENTITY CASCADE")
    for row in CATALOG:
        cur.execute(
            """INSERT INTO product_catalog(product, package, rate, fee, limit_min, limit_max, age_min, age_max, tier)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
            row,
        )
conn.commit()
print(f"  product_catalog: {len(CATALOG)} rows")

# ──────────────────────────────────────────────────────────────────────────────
# 2. tag_taxonomy (15 tag đóng theo BUILD_SPEC C1)
# ──────────────────────────────────────────────────────────────────────────────
TAGS = [
    ("tag_dining", "Merchant nhà hàng/cafe"),
    ("tag_kids", "Merchant trẻ em/khu vui chơi"),
    ("tag_travel", "Vé máy bay/khách sạn/OTA"),
    ("tag_petrol_auto", "Xăng dầu, gara, đăng kiểm"),
    ("tag_sieuthi", "Siêu thị/tạp hóa lớn"),
    ("tag_thoitrang_dienmay", "Thời trang, điện máy"),
    ("tag_thu_kinh_doanh", "CK vào từ nhiều nguồn nhỏ (kinh doanh)"),
    ("tag_thu_cho_thue", "CK vào định kỳ tiền thuê nhà/phòng"),
    ("tag_thu_luong_phu", "CK vào định kỳ ngoài lương chính"),
    ("tag_life_muanha", "Đặt cọc, góp mua đất, CK sang CĐT"),
    ("tag_life_conhoc", "Có cả hocphi + kids cùng lúc"),
    ("tag_hocphi", "Merchant trường + từ khóa học phí"),
    ("tag_vienphi", "Bệnh viện/phòng khám + viện phí"),
    ("tag_dong_phi_bh", "CK định kỳ đến hãng bảo hiểm"),
    ("tag_ck_nguoithan_dinhky", "CK ra cá nhân định kỳ (gia đình)"),
]

with conn.cursor() as cur:
    cur.execute("TRUNCATE tag_taxonomy RESTART IDENTITY CASCADE")
    for tag, desc in TAGS:
        cur.execute(
            "INSERT INTO tag_taxonomy(tag, description) VALUES(%s,%s) ON CONFLICT DO NOTHING",
            (tag, desc),
        )
conn.commit()
print(f"  tag_taxonomy: {len(TAGS)} tags")

# ──────────────────────────────────────────────────────────────────────────────
# 3. call_lists — assign 20 khách ngẫu nhiên cho ngày hôm nay + ngày mai
#    (lấy customer_id thật từ bảng customers)
# ──────────────────────────────────────────────────────────────────────────────
with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
    cur.execute("SELECT id FROM customers ORDER BY random() LIMIT 40")
    cids = [r["id"] for r in cur.fetchall()]

    # Lấy 1 sale user (hoặc dùng mock)
    cur.execute("SELECT id FROM users LIMIT 1")
    row = cur.fetchone()
    sale_id = row["id"] if row else None

today = date.today()
tomorrow = today + timedelta(days=1)
inserted = 0
with conn.cursor() as cur:
    for i, cid in enumerate(cids[:40]):
        d = today if i < 20 else tomorrow
        cur.execute(
            "INSERT INTO call_lists(list_date, customer_id, assigned_sale_id, created_by) VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING",
            (d, cid, sale_id, sale_id),
        )
        inserted += 1
conn.commit()
print(f"  call_lists: {inserted} rows (20 today + 20 tomorrow)")

# ──────────────────────────────────────────────────────────────────────────────
# 4. model_weights v0 default (logistic trivial — intercept=-1, weights=0)
#    Không cần sklearn, chỉ để batch có weights để load.
# ──────────────────────────────────────────────────────────────────────────────
PRODUCTS = ["the", "vay", "dautu", "baohiem", "taikhoan"]
FEATURES_DEFAULT = [
    "age", "dti", "casa_avg", "casa_trend_3m", "salary_regular",
    "has_loan", "has_card", "txn_per_month", "days_since_big_txn", "contact_count_90d",
]

with conn.cursor() as cur:
    cur.execute("TRUNCATE model_weights RESTART IDENTITY CASCADE")
    for product in PRODUCTS:
        weights_json = {
            "version": f"weights_{product}_v0",
            "product": product,
            "trained_on": today.isoformat(),
            "n_samples": 0,
            "n_positive": 0,
            "auc_holdout": 0.5,
            "lift_at_10": 1.0,
            "base_rate": 0.1,
            "gates": {"auc": "PENDING", "lift": "PENDING", "calibration": "PENDING", "baseline": "PENDING"},
            "intercept": -1.0,
            "weights": {f: 0.0 for f in FEATURES_DEFAULT},
            "feature_list": FEATURES_DEFAULT,
        }
        cur.execute(
            """INSERT INTO model_weights(product, version, filename, n_samples, n_positive, auc_holdout, lift_at_10, gates, is_production)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,TRUE)""",
            (
                product,
                0,
                f"weights_{product}_v0.json",
                0,
                0,
                0.5,
                1.0,
                json.dumps(weights_json["gates"]),
            ),
        )
conn.commit()
print(f"  model_weights: {len(PRODUCTS)} products (v0-default)")

conn.close()
print("\nSeed xong! Giờ chạy batch nightly.")
