---
name: browser-e2e-testing
description: End-to-end browser testing of this app — dev server, Nostr nsec login, Blossom upload, and reliable CJK/Japanese text input via xdotool Unicode keysyms.
---

# Browser E2E Testing (TextImage)

How to exercise this app in the GUI for full-feature testing.

## Dev server

```bash
cd ~/repos/text-image-app && npm run dev   # serves on http://localhost:8080 (vite)
```

No build step or env vars needed. `npm run dev` runs `npm i` silently first.

## Nostr login for tests

Use the `NOSTR_NSEC` session secret (test account). NEVER use `NOSTR_BUNKER_URI` — that is the owner's real account.

UI path: header **Join** → **Log in to an existing account** → paste nsec into the single input (accepts `nsec1…` or `bunker://…`) → **Log in**. The header then shows an account button (initial letter avatar).

Behind the scenes: `login.nsec()` gives a local signer with NIP-44 support, so encrypted saves (kind 30003 private items) and encrypted settings (kind 30078) both work.

## Typing Japanese / CJK into form fields

The `computer` tool's `type` action silently drops CJK characters, and `xdotool type` drops random characters even at `--delay 80`. The reliable method is **Unicode keysyms via `xdotool key U<hex>`**:

```python
# /tmp/type_unicode.py — click the field first, then run this
import sys, subprocess, os
keys = []
for ch in sys.argv[1]:
    if ch == '\n': keys.append('Return')
    elif ord(ch) < 128: keys.append(ch if ch != ' ' else 'space')
    else: keys.append('U%04X' % ord(ch))
env = dict(os.environ, DISPLAY=':0')
for i in range(0, len(keys), 50):
    subprocess.run(['xdotool', 'key', '--delay', '30'] + keys[i:i+50], env=env)
```

Important: pass `env=dict(os.environ, DISPLAY=':0')` — overriding env with only DISPLAY loses `XAUTHORITY` and xdotool fails with "no authorization protocol specified".

## Save / library flow

- 「Nostrライブラリに保存」 uploads the PNG to Blossom (`blossom.ditto.pub` first by default), then republishes kind 30003 `d=text-image-app`. Identical image content → identical Blossom URL (content-addressed hash), so public + private saves of the same image share one URL but produce two library cards (公開 / 非公開 badges).
- Private items live in NIP-44-encrypted `content`; the 自分のみ（暗号化）radio requires a nip44-capable signer (nsec works).
- 「エディタで開く」 restores the doc via `localStorage` key `text-image:draft` and navigates to `/`.
- Settings (logged out) persist to `localStorage` key `text-image:settings`.

## Verifying canvas output programmatically

```js
const c = document.querySelector('canvas');
const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
// count distinct sampled colors — >10 means real content was painted
```

PNG downloads land in `~/Downloads/textimage-<format>-<size>.png`; verify with `file`.
