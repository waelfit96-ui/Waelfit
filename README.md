# Kinora website

1:1 online fitness coaching for women aged 27–70 with Coach Wael.

A plain HTML website with no build step and nothing to install.

| File | What it is |
|---|---|
| `index.html` | The home page (all sections) |
| `shop.html` | The shop: PDF ebooks and workout programs |
| `legal.html` | Imprint, Privacy Policy, Terms & Conditions |
| `404.html` | "Page not found" page |
| `images/` | Photos, logo, icons and the social-share image (`og-image.jpg`, 1200×630) |
| `robots.txt`, `sitemap.xml` | Help Google find the site |

## Your website address

The site is published at **https://kinorafit.online** (domain bought at Namecheap).
The file `CNAME` tells GitHub Pages which domain to use. Do not delete it.

### Publish with GitHub Pages (free)

1. Merge this branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, branch **`main`**, folder **`/ (root)`**, **Save**.
3. Every change you push to `main` updates the live site automatically.

### One-time setup: connect the domain

1. **Namecheap → Domain List → Manage → Advanced DNS.** Delete the default parking records (a `CNAME www` pointing to parking-page, and any `URL Redirect` record), then add these:

   | Type | Host | Value |
   |---|---|---|
   | A Record | `@` | `185.199.108.153` |
   | A Record | `@` | `185.199.109.153` |
   | A Record | `@` | `185.199.110.153` |
   | A Record | `@` | `185.199.111.153` |
   | CNAME Record | `www` | `waelfit96-ui.github.io.` |

   Leave the nameservers on **Namecheap BasicDNS** (the default).
2. **GitHub → Settings → Pages → Custom domain**: enter `kinorafit.online` and **Save**. Wait for the DNS check to pass (a few minutes to a few hours).
3. Tick **Enforce HTTPS** once it becomes available (it can take up to an hour after the DNS check).
4. The old address `waelfit96-ui.github.io/Waelfit` then redirects to the new one automatically.

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

## Selling ebooks and PDF programs (the shop)

The shop page (`shop.html`) shows your products. Payment and PDF delivery are done by **[Payhip](https://payhip.com)**:
no monthly fee (5% per sale on the free plan, plus the card/PayPal fee), buyers pay by card or PayPal,
Payhip emails the PDF automatically and calculates EU VAT for you.

Until you add Payhip links, every **Buy now** button opens WhatsApp with a ready-made message, so the shop already works.

### One-time setup (about 20 minutes)

1. Sign up at **payhip.com** (free plan) with `waelfit01@gmail.com`.
2. **Settings → Payment**: connect **PayPal** and/or **Stripe** (for cards). This is where your money arrives.
3. **Settings → Taxes**: turn on EU VAT handling and choose to include VAT in your prices.
4. For each product: **Add product → Digital product**, upload the PDF, a cover image, the title, the description and the price.
5. Copy the product link Payhip gives you (looks like `https://payhip.com/b/AbC12`).
6. In `shop.html`, find the product's **Buy now** button and paste the link between the quotes of `data-buy=""`:
   `data-buy="https://payhip.com/b/AbC12"`. Commit. That button now opens the Payhip checkout.

### Adding, changing or removing a product

In `shop.html`, under `<!-- Products -->`, each product is one `<article class="product">` block. Copy a block to add a product,
delete one to remove it, and edit the title, text, bullet points and price inside it.

- `data-type="ebook"` or `data-type="program"` sets which filter tab shows it.
- The six products in the shop now are **examples**: rename them, change prices or delete them to match your real PDFs.
- Keep the price on the page the same as the price in Payhip.

## Brand

The brand is **Kinora** (formerly WaelFit). Logo, favicon and share image are in `images/` (`logo.webp`, `favicon.png`, `apple-touch-icon.png`, `og-image.jpg`).
Colours are unchanged: purple `#8B4FD8` with dark `#0B0A10`.

Still using the old name until you change them: the email `waelfit01@gmail.com` and the YouTube channel.
When you have new ones, search for them and replace them.
