# NIP Extensions — TextImage

This app introduces no new event kinds. It reuses NIP-51 (lists), NIP-78
(app data) and BUD-03 (Blossom uploads) with the app-specific conventions
documented here.

## Image library — NIP-51 bookmark set (kind 30003)

Rendered images are saved to a dedicated bookmark set so they do not mix
with the user's regular bookmarks:

- `kind`: `30003` (NIP-51 bookmark set)
- `d` tag: `text-image-app`
- `title` tag: `TextImage Library`

Each saved image contributes two tags:

```
["r",   "<blossom image url>"]
["doc", "<blossom image url>", "<json>"]
```

- `r` is the standard bookmark reference to the uploaded image (uploaded
  via Blossom / BUD-03 before the set is republished).
- `doc` is a **custom tag** carrying the source document for re-editing.
  Its second element repeats the image URL so the tag can be matched back
  to its `r` item. The third element is a compact JSON payload:

```json
{
  "t": "title",          // optional
  "b": "body text",      // optional
  "a": "attribution",    // optional
  "f": "card",           // renderer id
  "s": "square",         // size id
  "h": "paper",          // theme id
  "v": { "align": "center" } // renderer option values
}
```

### Private items

When the user chooses "自分のみ" (private), the same two tags are appended
to the **encrypted content array** per NIP-51 private list items: the
`content` field holds the NIP-44 self-encrypted JSON array of tag arrays.
Legacy `?iv=` (NIP-04) ciphertext is detected and decrypted on read.

## App settings — NIP-78 (kind 30078)

User preferences are stored in an addressable app-data event:

- `kind`: `30078`
- `d` tag: `text-image-app`
- `content`: NIP-44 self-encrypted JSON:

```json
{
  "defaultFormat": "card",
  "defaultSize": "square",
  "defaultTheme": "paper",
  "defaultVisibility": "private"
}
```

When the signer cannot encrypt (or the user is logged out), settings fall
back to `localStorage` under the `text-image:settings` key.
