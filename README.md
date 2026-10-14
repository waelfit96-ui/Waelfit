# WaelFit website

1:1 online fitness coaching for women aged 27–70 with Coach Wael.

A plain HTML website with no build step and nothing to install.

| File | What it is |
|---|---|
| `index.html` | The home page (all sections) |
| `legal.html` | Imprint, Privacy Policy, Terms & Conditions |
| `404.html` | "Page not found" page |
| `images/` | Photos, logo, icons and the social-share image (`og-image.jpg`, 1200×630) |
| `robots.txt`, `sitemap.xml` | Help Google find the site |

## Before you publish: checklist

- [x] **Imprint address**: filled in `legal.html`.
- [ ] **Your own domain (optional)**: if you buy one (e.g. `waelfit.com`), replace `https://waelfit96-ui.github.io/Waelfit/` in `index.html`, `robots.txt` and `sitemap.xml`, and replace `/Waelfit/` in `404.html` with `/`.

## Publish for free with GitHub Pages

1. Merge this branch into `main`.
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch **`main`**, folder **`/ (root)`**, then click **Save**.
4. After 1–2 minutes the site is live at **https://waelfit96-ui.github.io/Waelfit/**.
5. Optional: under **Custom domain**, enter your own domain and follow GitHub's DNS instructions.

Every change you push to `main` updates the live site automatically.

## How to edit the site

You can edit files directly on github.com: open a file, click the pencil icon, make your change, then **Commit changes**.

| I want to change… | Where to look in `index.html` |
|---|---|
| Brand colour | `--accent` at the top of the `<style>` block |
| Top banner text | `<!-- Top bar -->` |
| Headline and intro | `<!-- Hero -->` |
| Programs | `<!-- Programs -->`, one `<article class="program">` per card |
| About text | `<!-- About -->` |
| Prices | `<!-- Pricing -->`; also update the FAQ, the contact form options and `legal.html` → Terms |
| Gallery photos | `<!-- Gallery -->`, one `<figure>` per photo (`g-wide` = landscape photo, `g-tall` = portrait photo) |
| FAQ | `<!-- FAQ -->`, one `<details>` per question |
| WhatsApp number | Search for `5511985636163` and replace every match |
| Email | Search for `waelfit01@gmail.com` and replace every match |

**Swapping a photo:** upload the new image to `images/`, then change the `src="images/..."` that points to it. Keep photos under ~400 KB so the page loads fast on phones.

**Booking buttons:** any link with `data-wa="..."` opens WhatsApp with that message already typed, so you only need to edit the text inside `data-wa`.
