# آنلاین‌کردن (دیپلوی روی Netlify) — تا رئیس از هرجا ببینه

پیش‌نیاز: برنامه لوکال درست کار می‌کنه و SQLهای Supabase رو اجرا کردی
(از جمله قانونِ `ws_write` که اجازه‌ی ویرایش به رئیس می‌ده).

دو راه داری: **A) از روی GitHub (پیشنهادی)** یا **B) درگ‌اند‌دراپِ سریع**.

---

## راه A — از روی GitHub (برای آپدیت‌های بعدی بهتره)

### ۱) کد روی GitHub
1. یه ریپوی **Private** بساز (مثلاً `manager-dashboard`).
2. توی پوشه‌ی پروژه:
   ```bash
   git init
   git add .
   git commit -m "Manager dashboard"
   git branch -M main
   git remote add origin https://github.com/USERNAME/manager-dashboard.git
   git push -u origin main
   ```
   > ✅ `.env.local` آپلود نمی‌شه (توی `.gitignore` هست) — کلیدها امن می‌مونن.

### ۲) Netlify
1. توی **https://app.netlify.com** با GitHub لاگین کن.
2. **Add new site → Import an existing project → GitHub** → ریپوت رو انتخاب کن.
3. تنظیمات build خودکار از `netlify.toml` خونده می‌شه (Build: `npm run build` ، Publish: `dist`). دست نزن.
4. قبل از Deploy، برو **Add environment variables** (یا بعداً Site settings → Environment variables) و این دوتا رو وارد کن:
   ```
   VITE_SUPABASE_URL = https://tiqwodvwdpueyeyiybnx.supabase.co
   VITE_SUPABASE_ANON_KEY = sb_publishable_-CuT-UcxP5ajx_bCtxyr6w_hZg1aWvR
   VITE_EXCHANGERATE_KEY = c5cd7172b9055c12966a69f0756f31dd
   ```
5. **Deploy** بزن. بعد از یکی‌دو دقیقه یه آدرس می‌گیری مثل `https://xxxx.netlify.app`.

> اگه env رو بعد از اولین دیپلوی اضافه کردی، یه‌بار **Deploys → Trigger deploy → Deploy site** بزن تا دوباره با کلیدها build شه.

---

## راه B — درگ‌اند‌دراپ (سریع‌ترین، بدون GitHub)
چون کلیدِ ما عمومیه (publishable)، می‌تونی همین‌جوری بسازی و فایل خروجی رو بکشی توی Netlify:
1. لوکال build بگیر (کلیدها از `.env.local` خونده می‌شن و توی خروجی می‌رن):
   ```bash
   npm run build
   ```
2. برو **https://app.netlify.com/drop**
3. پوشه‌ی **`dist`** (داخل پروژه) رو بکش و رها کن توی اون صفحه.
4. لینک آماده‌ست.
   > عیبش: برای هر آپدیت باید دوباره build بگیری و پوشه‌ی `dist` رو دوباره بندازی.

---

## ۳) تنظیم Supabase برای دامنه‌ی Netlify (مهم)
تا لاگین و تأیید ایمیل درست به سایت آنلاین برگرده (نه localhost):
1. Supabase → **Authentication → URL Configuration**
2. **Site URL** = آدرس Netlify ت (`https://xxxx.netlify.app`)
3. توی **Redirect URLs** هم همون آدرس رو **Add** کن → **Save**.

## ۴) تمام 🎉
- لینک Netlify رو به **رئیست** بده. Sign up می‌کنه و می‌بینه (و می‌تونه ویرایش هم بکنه).
- تغییرات هرکدومتون چند ثانیه بعد رو صفحه‌ی اون‌یکی هم زنده می‌شه.

---

## نکته‌ها
- **آپدیت بعدی (راه A):** هر `git push` → Netlify خودکار دوباره دیپلوی می‌کنه.
- **دامنه‌ی اختصاصی:** Netlify → Site → **Domain management** → دامنه‌ی خودت رو وصل کن.
- اگه بعد از دیپلوی صفحه سفید بود یا لاگین برنگشت → معمولاً مرحله‌ی ۳ (Site URL) انجام نشده.
