#!/usr/bin/env python3
"""Build independent marketing/admin artifacts; preserve every legacy source file."""
import json, shutil, html, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'out'
DATA=json.loads((ROOT/'platform/content/site.json').read_text())
PAGES=['index','pilots','clubs','how-it-works','contact']
LABELS={'de':'Deutsch','en':'English','hu':'Magyar'}
esc=html.escape

def brand():
    return '<span class="emblem"><img src="/assets/paraspots-original.png" alt=""></span><span class="wordmark">PARASPOTS<small>FLY MORE. SEARCH LESS.</small></span>'
def buttons(d):
    return f'<div class="actions"><a class="button" href="pilots.html">{d["app"]} <span aria-hidden="true">↗</span></a><a class="button secondary" href="clubs.html">{d["clubs"]} <span aria-hidden="true">→</span></a></div>'
def card(c,href,d):
    return f'<article class="feature-card"><p class="eyebrow">{c[0]}</p><h3>{c[1]}</h3><p>{c[2]}</p><a class="text-link" href="{href}">{d["more"]} <span aria-hidden="true">↗</span></a></article>'
def features(items):
    return '<div class="feature-grid">'+''.join(f'<article class="feature"><span class="feature-number">0{i+1}</span><h3>{x[0]}</h3><p>{x[1]}</p></article>' for i,x in enumerate(items))+'</div>'
def club_features(d):
    rows=[]
    for i,(title,body) in enumerate(d['clubFeatures']):
        text=f'<div class="club-feature-copy"><span class="feature-number">0{i+1}</span><h2>{title}</h2><p class="large-text">{body}</p></div>'
        if i<2:
            image_name=['app-club.png','app-events.png'][i]
            text+=f'<figure class="club-phone-figure"><div class="phone"><img src="/assets/{image_name}" alt="{esc(d["clubScreenAlts"][i])}" width="1170" height="2532" loading="lazy"></div><figcaption>{d["clubScreenCaption"]}</figcaption></figure>'
        rows.append(f'<article class="club-feature-row">{text}</article>')
    return '<div class="club-feature-story">'+''.join(rows)+'</div>'

def download(d):
    return f'<section class="download wrap" id="app"><div><p class="eyebrow">PARASPOTS APP</p><h2>{d["downloadTitle"]}</h2><p>{d["downloadText"]}</p></div><div class="store-status"><span class="pill">{d["store"]}</span><div class="store-row"><span>{d["ios"]}</span><span>{d["android"]}</span></div></div></section>'
def preview(d):
    return f'<div class="phone"><img src="/assets/app-start.png" alt="{d["screenAlt"]}" width="1170" height="2532" loading="lazy"></div>'
def page_content(p,d,lang,demo_url):
    if p=='index':
        return f'''<section class="hero"><div class="hero-inner wrap"><div class="hero-copy"><p class="eyebrow">{d['eyebrow']}</p><h1>{d['headline']}</h1><div class="red-line"></div><p class="hero-lead">{d['intro']}</p>{buttons(d)}<p class="stage"><span></span>{d['stage']}</p></div><div class="hero-aside"><span class="altitude">PARASPOTS<br><strong>PLATFORM</strong></span><p>{d['heroNote']}</p></div></div><div class="hero-bottom wrap"><span>{d['scroll']}</span><span aria-hidden="true">↓</span></div></section>
<section class="wrap intro-section"><p class="eyebrow">PARASPOTS</p><div class="split"><h2>{d['homeTitle']}</h2><p class="large-text">{d['homeText']}</p></div><div class="two-cards">{card(d['pilotCard'],'pilots.html',d)}{card(d['clubCard'],'clubs.html',d)}</div></section>
<section class="app-section"><div class="wrap split app-grid"><div><p class="eyebrow">PARASPOTS 0.1</p><h2>{d['preview']}</h2><p>{d['previewText']}</p><a class="button" href="pilots.html">{d['app']} ↗</a></div>{preview(d)}</div></section>{download(d)}'''
    if p=='pilots':
        return f'''<section class="wrap inner-hero split"><div><p class="eyebrow">{d['nav'][1]}</p><h1>{d['pilotTitle']}</h1><div class="red-line"></div><p class="large-text">{d['pilotIntro']}</p><a class="button" href="#app">{d['app']} ↓</a></div>{preview(d)}</section><section class="wrap section-space">{features(d['pilotFeatures'])}<p class="notice">{d['pilotNote']}</p><p class="caption">{d['previewText']}</p></section>{download(d)}'''
    if p=='clubs':
        cta=f'<a class="button" href="{esc(demo_url)}?lang={lang}">{d["demo"]} ↗</a>' if demo_url else f'<a class="button" href="contact.html">{d["contactButton"]} ↗</a>'
        return f'''<section class="wrap inner-hero"><p class="eyebrow">{d['nav'][2]}</p><h1>{d['clubTitle']}</h1><div class="red-line"></div><p class="large-text max-text">{d['clubIntro']}</p></section><section class="wrap section-space">{club_features(d)}</section><section class="admin-teaser"><div class="wrap split"><div><p class="eyebrow">{d['adminBadge']}</p><h2>{d['adminTitle']}</h2><p>{d['adminText']}</p>{cta}<p class="caption">{d['demoNote']}</p></div><div class="mini-admin"><div class="mini-top"><span>PARASPOTS</span><span class="pill">DEMO</span></div>{''.join(f'<div class="mini-row"><span>0{i+1}</span><strong>{x}</strong><span>→</span></div>' for i,x in enumerate(d['adminPreview']))}</div></div></section><section class="wrap closing"><h2>{d['contactTitle']}</h2><a class="button" href="contact.html">{d['contactButton']} ↗</a></section>'''
    if p=='how-it-works':
        flows=''
        for f in d['flows']:
            flows+=f'<section class="flow" id="{f["id"]}"><div><p class="eyebrow">{f["label"]}</p><h2>{f["title"]}</h2></div><div class="steps">'+''.join(f'<article><span>{i+1}</span><div><h3>{x[0]}</h3><p>{x[1]}</p></div></article>' for i,x in enumerate(f['steps']))+f'<p class="notice">{f["note"]}</p></div></section>'
        return f'<section class="wrap inner-hero"><p class="eyebrow">{d["nav"][3]}</p><h1>{d["howTitle"]}</h1><div class="red-line"></div><p class="large-text max-text">{d["howIntro"]}</p><div class="jump-links">'+''.join(f'<a href="#{f["id"]}">{f["label"]} ↓</a>' for f in d['flows'])+f'</div></section><div class="wrap">{flows}</div>{download(d)}'
    return f'''<section class="wrap inner-hero"><p class="eyebrow">{d['nav'][4]}</p><h1>{d['contactTitle']}</h1><div class="red-line"></div><p class="large-text max-text">{d['contactIntro']}</p></section><section class="wrap contact-layout"><article class="contact-card"><p class="eyebrow">{d['contactLabel']}</p><h2>{d['contactName']}</h2><a class="email" href="mailto:petergati@me.com">petergati@me.com ↗</a><p>{d['contactNote']}</p></article><div>{''.join(f'<article class="contact-topic"><h3>{a}</h3><p>{b}</p></article>' for a,b in zip(d['contactSubjects'],d['contactDetails']))}</div></section>'''

def render(p,d,lang,demo_url):
    nav=''.join(f'<a href="{s}.html"'+(' aria-current="page"' if s==p else '')+f'>{n}</a>' for s,n in zip(PAGES,d['nav']))
    langs=''.join(f'<a href="/{l}/{p}.html" lang="{l}" hreflang="{l}" aria-label="{LABELS[l]}"'+(' aria-current="true"' if l==lang else '')+f'>{l.upper()}</a>' for l in DATA)
    return f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{d['nav'][PAGES.index(p)]} · PARASPOTS</title><meta name="description" content="{esc(d['intro'])}"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#102740"><link rel="stylesheet" href="/site.css"><script src="/site.js" defer></script></head><body><a class="skip" href="#main">{d['skip']}</a><header class="site-header"><div class="public-demo-banner">{d["demoBanner"]}</div><div class="header-inner wrap"><a class="brand" href="index.html" aria-label="PARASPOTS · {d['nav'][0]}">{brand()}</a><button class="menu-toggle" aria-expanded="false" aria-controls="main-nav">{d['menu']} ☰</button><nav id="main-nav" aria-label="{d['menu']}">{nav}</nav><nav class="languages" aria-label="{d['lang']}">{langs}</nav></div></header><main id="main">{page_content(p,d,lang,demo_url)}</main><footer class="site-footer"><div class="wrap"><div class="footer-top"><a class="brand" href="index.html">{brand()}</a><p>{d['footer']}</p><a href="contact.html">{d['contactButton']} ↗</a></div><div class="footer-bottom"><span>{d['copyright']}</span><span>DE · EN · HU</span></div><p class="legal-note">{d['legal']}</p></div></footer></body></html>'''

if OUT.exists(): shutil.rmtree(OUT)
for target,demo_url in [('marketing',os.environ.get('PARASPOTS_ADMIN_URL','')),('preview','/demo/')]:
    dest=OUT/target; shutil.copytree(ROOT/'platform/public',dest)
    for lang,d in DATA.items():
        (dest/lang).mkdir()
        for p in PAGES: (dest/lang/(p+'.html')).write_text(render(p,d,lang,demo_url))
    (dest/'index.html').write_text('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/de/index.html"><title>PARASPOTS</title></head><body><a href="/de/index.html">Deutsch</a> · <a href="/en/index.html">English</a> · <a href="/hu/index.html">Magyar</a></body></html>')
    (dest/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    (dest/'404.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · PARASPOTS</title><link rel="stylesheet" href="/site.css"><main class="wrap inner-hero"><h1>404</h1><p>Seite nicht gefunden · Page not found · Az oldal nem található</p><a class="button" href="/">PARASPOTS →</a></main></html>')
    (dest/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()\n  Content-Security-Policy: default-src \'self\'; img-src \'self\'; script-src \'self\'; style-src \'self\'; connect-src \'self\'; frame-ancestors \'none\'; base-uri \'self\'; form-action \'none\'\n  X-Robots-Tag: noindex, nofollow\n')
shutil.copytree(ROOT/'platform/admin',OUT/'admin')
admin_index=OUT/'admin/index.html'
admin_index.write_text(admin_index.read_text().replace('<body>', '<body data-website-base="'+esc(os.environ.get('PARASPOTS_WEBSITE_URL','https://paraspots.at'))+'">'))
shutil.copytree(ROOT/'platform/admin',OUT/'preview/demo')
for dest in [OUT/'admin',OUT/'preview/demo']:
    (dest/'assets').mkdir(exist_ok=True)
    shutil.copy2(ROOT/'platform/public/assets/paraspots-original.png',dest/'assets')
    shutil.copy2(OUT/'marketing/_headers',dest/'_headers')
print('Built: out/marketing (15 pages), out/admin, out/preview (combined local review).')

# Protected editor assets are public; all reads/writes require server authentication.
for target in ['marketing','preview']:
    dest=OUT/target/'superadmin'
    shutil.copytree(ROOT/'platform/superadmin',dest)
    shutil.copy2(ROOT/'backend/validation.js',dest/'validation.js')
    with (OUT/target/'_headers').open('a') as f:
        f.write("\n/superadmin/*\n  Cache-Control: no-store\n")
