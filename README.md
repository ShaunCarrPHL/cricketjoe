# cricketjoe.com

Band site for Cricket Joe (Philadelphia). It works like a TV: **↑↓** (or CH+/CH−) changes channels, **0–9** tunes a number, **G** opens the guide.

Song channels play through Bandcamp. When a video exists, put a YouTube id on channel 9 in `channels.json`.

## Local preview

```powershell
npx --yes serve .
```

Then open the URL it prints.

## Update shows

Edit `shows.json`:

```json
{
  "shows": [
    {
      "date": "2026-09-12",
      "venue": "Ortlieb's",
      "city": "Philadelphia, PA",
      "url": "https://example.com/tickets"
    }
  ]
}
```

## Put it on cricketjoe.com

The domain currently has no working DNS. After this repo is on GitHub:

1. Host the folder on [Cloudflare Pages](https://pages.cloudflare.com/) or GitHub Pages.
2. Add `cricketjoe.com` as the custom domain (this repo already has a `CNAME` file).
3. At the registrar, point nameservers to Cloudflare, or add the A/CNAME records the host gives you.

Until DNS is pointed, the site only runs locally.
