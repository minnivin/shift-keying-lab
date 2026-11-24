"""Inline core.js + app.js into body.html.

Writes:
  ../shift-keying-lab.html  page body for publishing as a Claude artifact (no doctype; the host adds it)
  ../index.html           complete standalone page for GitHub Pages / Netlify / opening locally
"""
from pathlib import Path

here = Path(__file__).parent
body = (here / "body.html").read_text(encoding="utf8")
body = body.replace("/*CORE*/", (here / "core.js").read_text(encoding="utf8"))
body = body.replace("/*APP*/", (here / "app.js").read_text(encoding="utf8"))
(here.parent / "shift-keying-lab.html").write_text(body, encoding="utf8")

standalone = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
    "body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n"
    "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
)
(here.parent / "index.html").write_text(standalone, encoding="utf8")
print("built", len(body), "chars")
