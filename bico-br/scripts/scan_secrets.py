#!/usr/bin/env python3
"""Scan rápido de segredos e más práticas. Uso: python scan_secrets.py [pasta]"""
import os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "venv", ".venv", "__pycache__"}
EXTS = {".js", ".jsx", ".ts", ".tsx", ".py", ".json", ".yml", ".yaml", ".html", ".php", ".java", ".kt", ".swift", ".dart", ".sql", ".vue"}

PATTERNS = {
    "Chave privada": r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "AWS key": r"AKIA[0-9A-Z]{16}",
    "OpenAI/Anthropic key": r"sk-(ant-)?[A-Za-z0-9_\-]{20,}",
    "Google API key": r"AIza[0-9A-Za-z_\-]{35}",
    "Stripe secret": r"sk_live_[0-9a-zA-Z]{20,}",
    "JWT": r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
    "Supabase service_role citada": r"service_role",
    "Senha fixa": r"(?i)(password|senha|secret|token)\s*[:=]\s*['\"][^'\"]{6,}['\"]",
    "String de conexão": r"(postgres|mysql|mongodb(\+srv)?)://[^\s'\"]+:[^\s'\"]+@",
}
RISKY = {
    "SQL concatenado": r"(?i)(select|insert|update|delete)\s.+['\"]\s*\+\s*\w+",
    "innerHTML": r"\.innerHTML\s*=|dangerouslySetInnerHTML",
    "eval()": r"\beval\s*\(",
    "CORS aberto": r"origin\s*:\s*['\"]\*['\"]",
    "Hash fraco": r"(?i)\b(md5|sha1)\s*\(",
    "HTTP sem TLS": r"http://(?!localhost|127\.0\.0\.1)",
}

def mask(s): return s[:4] + "…" if len(s) > 4 else "…"

found = 0
for dp, dns, fns in os.walk(ROOT):
    dns[:] = [d for d in dns if d not in SKIP_DIRS]
    for fn in fns:
        path = os.path.join(dp, fn)
        ext = os.path.splitext(fn)[1].lower()
        is_env = fn.startswith(".env") and fn != ".env.example"
        if ext not in EXTS and not is_env:
            continue
        try:
            lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
        except Exception:
            continue
        if is_env:
            print(f"🟡 Arquivo de ambiente: {path} (confira se está no .gitignore)"); found += 1
            continue
        for i, line in enumerate(lines, 1):
            for name, pat in PATTERNS.items():
                m = re.search(pat, line)
                if m:
                    print(f"🔴 {name}: {path}:{i} → {mask(m.group(0))}"); found += 1
            for name, pat in RISKY.items():
                if re.search(pat, line):
                    print(f"🟡 {name}: {path}:{i}"); found += 1

gi = os.path.join(ROOT, ".gitignore")
if not os.path.exists(gi) or ".env" not in open(gi, encoding="utf-8", errors="ignore").read():
    print("🔴 .gitignore ausente ou sem .env"); found += 1

print(f"\nTotal de achados: {found}" if found else "✅ Nenhum achado no scan automático (revise o checklist manual mesmo assim).")
