import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import re
import json
import base64
import urllib.request
import urllib.error
import time

DIAGRAMS_MD = os.path.join(os.path.dirname(__file__), "DATA_FLOW_AND_USE_CASE_DIAGRAMS.md")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(DIAGRAMS_MD, "r", encoding="utf-8") as f:
    text = f.read()

parts = text.split("```mermaid")
print(f"Total mermaid blocks found: {len(parts)-1}", flush=True)

diagram_names = [
    ("dfd_level_0_context", "DFD Level 0: Context Data Flow Diagram (Top-Level)", 1400),
    ("dfd_level_1_subsystem", "DFD Level 1: Subsystem Data Flow Diagram (Middle-Level)", 1600),
    ("dfd_level_2_order_placement", "DFD Level 2: Order Processing Subsystem", 1200),
    ("dfd_level_2_kitchen_kds", "DFD Level 2: Kitchen Routing & KDS Workflow Subsystem", 1200),
    ("dfd_level_2_payment_invoicing", "DFD Level 2: Payment Processing Subsystem", 1200),
    ("dfd_level_2_inventory_tracking", "DFD Level 2: Inventory Tracking Subsystem", 1200),
    ("usecase_complete_system", "Complete System-Wide Use Case Diagram", 1800),
    ("usecase_customer_subsystem", "Customer Self-Ordering Use Case Diagram", 1200),
    ("usecase_kitchen_subsystem", "Kitchen Display System Use Case Diagram", 1200),
    ("usecase_waitstaff_floor", "Waitstaff & Floor Service Use Case Diagram", 1100),
    ("usecase_cashier_settlement", "Cashier & Settlement Use Case Diagram", 1100),
    ("usecase_admin_governance", "Admin & Governance Use Case Diagram", 1300),
]

def clean_mermaid_code(code: str) -> str:
    # 1. Strip whitespace
    c = code.strip()
    # 2. Fix unquoted parentheses inside edge labels |...|
    def fix_edge(m):
        inner = m.group(1)
        # replace unquoted parentheses with hyphens
        inner = inner.replace("(", "- ").replace(")", " -")
        return f"|{inner}|"
    c = re.sub(r'\|([^\|]+)\|', fix_edge, c)
    # 3. Fix any lone empty brackets like [ ]
    c = re.sub(r'\[\s*\]', '[Node]', c)
    return c

results = []

for i in range(1, len(parts)):
    raw_block = parts[i].split("```")[0].strip()
    cleaned = clean_mermaid_code(raw_block)
    
    if i - 1 < len(diagram_names):
        filename, title, width = diagram_names[i - 1]
    else:
        filename, title, width = f"diagram_{i}", f"Diagram {i}", 1200
        
    print(f"[{i}/{len(parts)-1}] Rendering '{filename}' ({title})...", flush=True)
    
    payload = {
        "code": cleaned,
        "mermaid": {
            "theme": "default"
        }
    }
    b64_str = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('ascii')
    
    svg_path = os.path.join(OUTPUT_DIR, f"{filename}.svg")
    png_path = os.path.join(OUTPUT_DIR, f"{filename}.png")
    
    # 1. Download SVG
    svg_saved = False
    try:
        url_svg = f"https://mermaid.ink/svg/{b64_str}"
        req = urllib.request.Request(url_svg, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                svg_data = resp.read()
                with open(svg_path, "wb") as f_out:
                    f_out.write(svg_data)
                svg_saved = True
    except Exception as e:
        print(f"  [Error SVG] {e}", flush=True)

    # 2. Download PNG
    png_saved = False
    try:
        url_png = f"https://mermaid.ink/img/{b64_str}?width={width}"
        req = urllib.request.Request(url_png, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status == 200:
                png_data = resp.read()
                with open(png_path, "wb") as f_out:
                    f_out.write(png_data)
                png_saved = True
    except Exception as e:
        print(f"  [Error PNG] {e}", flush=True)

    status_str = f"SVG: {'✓' if svg_saved else '✗'} | PNG: {'✓' if png_saved else '✗'}"
    print(f"  -> {status_str}", flush=True)
    results.append((filename, title, svg_saved, png_saved))
    time.sleep(0.4)

print("\n================== SUMMARY ==================", flush=True)
for r in results:
    print(f"{r[0]}: SVG={'YES' if r[2] else 'NO'}, PNG={'YES' if r[3] else 'NO'}", flush=True)
