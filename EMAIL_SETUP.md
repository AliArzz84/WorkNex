# اتصال Gmail به اپ (اسکنِ ایمیل → جلسه)

این فیچر اجازه می‌ده با یه دکمه، ایمیل‌های اخیرِ inboxت اسکن بشن و جلسه‌ها به‌صورتِ پیشنهاد بیان تو اپ.
کلِ کدش آماده‌ست؛ فقط این مرحله‌های یک‌بارهِ ستاپ مونده که باید **خودت** انجام بدی.

> آدرسِ callback که چند جا لازم می‌شه:
> `https://tiqwodvwdpueyeyiybnx.supabase.co/auth/v1/callback`

---

## ۱) Google Cloud — ساختِ اپ OAuth و روشن‌کردنِ Gmail API
۱. برو [console.cloud.google.com](https://console.cloud.google.com) → یه پروژه بساز/انتخاب کن.
۲. **APIs & Services → Library** → «Gmail API» رو سرچ کن → **Enable**.
۳. **APIs & Services → OAuth consent screen** → نوع **External** → اسمِ اپ + ایمیلِ پشتیبانی رو پر کن → Save.
۴. توی **Scopes** این اسکوپ رو اضافه کن: `https://www.googleapis.com/auth/gmail.readonly` (فقط-خواندن).
۵. توی **Test users** ایمیل(های) کاری‌ای که می‌خوای وصل کنی رو اضافه کن. (تو حالتِ Testing تا ۱۰۰ کاربر بدونِ تأییدیه‌ی گوگل کار می‌کنه — برای شما کافیه.)
۶. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URIs** → آدرسِ callbackِ بالا رو بذار.
   - Create → **Client ID** و **Client secret** رو کپی کن.

## ۲) Supabase — فعال‌کردن گوگل + سکرت‌ها
۷. داشبوردِ Supabase → **Authentication → Providers → Google** → روشنش کن → Client ID و Client secret رو پیست کن → Save.
۸. **Authentication → URL Configuration**: مطمئن شو توی **Redirect URLs** این‌ها مجازن:
   - `http://localhost:5173` (برای تستِ لوکال)
   - دامنه‌ی Netlify (وقتی deploy کردی)
۹. **SQL Editor** → محتوای فایلِ `supabase/email_scan.sql` رو پیست کن → **Run**.
۱۰. سکرت‌های تابع رو ست کن (تا تابع بتونه توکنِ تازه بگیره). تو ترمینال، داخلِ پوشه‌ی `nexus`:
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=کلاینت‌آیدیت GOOGLE_CLIENT_SECRET=سکرتت
   ```
   (`ANTHROPIC_API_KEY` رو قبلاً ست کردی — همونه.)
۱۱. تابع رو deploy کن:
   ```bash
   supabase functions deploy scan-email
   ```

## ۳) داخلِ اپ
۱۲. اپ رو رفرش کن → بالای صفحه یه دکمه‌ی **✉️** اومده → بازش کن → **Connect Gmail** → با همون ایمیلی که توی اپ لاگین می‌کنی واردِ گوگل شو و دسترسیِ فقط-خواندن رو تأیید کن.
۱۳. برگشتی به اپ → **Scan recent emails** → جلسه‌های پیداشده میان → ساعت رو تأیید/عوض کن → **Add to Meetings**.

---

### نکته‌ها
- موقعِ اولین اتصال، گوگل صفحه‌ی «اپ تأییدنشده» نشون می‌ده — چون تو حالتِ Testing هستی، روی **Advanced → Continue** بزن (برای خودت/تست‌یوزرها امنه).
- حتماً با **همون ایمیلی** که توی اپ لاگین می‌کنی Gmail رو وصل کن. اگه ایمیلِ دیگه‌ای وصل کردی، اول باید توی `allowed_emails` اضافه شده باشه.
- فقط ۱۵ ایمیلِ اخیرِ inbox (۷ روزِ گذشته) اسکن می‌شن — برای کنترلِ هزینه و حریمِ خصوصی. ایمیلِ تکراری دوباره پیشنهاد نمی‌شه.
- اسکوپ فقط-خواندنه؛ AI نمی‌تونه ایمیل بفرسته یا چیزی رو پاک کنه.
- اگه روزی بعدِ مدتی «reconnect» خواست، یه‌بار دیگه Connect Gmail رو بزن.
