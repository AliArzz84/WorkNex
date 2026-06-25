# راهنمای کارهای دستیِ Supabase (ادمین)

> نصبِ اولیه **انجام شده**. این فایل فقط کارهاییه که هر از گاهی خودت توی Supabase انجام می‌دی.
> همه‌ی کوئری‌ها رو اینجا اجرا کن: **Supabase → SQL Editor → New query → بچسبون → Run**.
> (ایمیل‌های توی مثال‌ها فیک‌ان — جای `someone@example.com` ایمیلِ واقعی رو بذار.)

---

## ۱) مدیریتِ دسترسی — کی می‌تونه وارد بشه
دسترسی **فقط با دعوت**ه. کسی می‌تونه Sign up کنه که ایمیلش توی لیستِ `allowed_emails` باشه.

**دیدنِ لیستِ افرادِ مجاز:**
```sql
select email, added_at from public.allowed_emails order by added_at;
```

**اضافه‌کردنِ یه نفرِ جدید** (حتماً *قبل* از اینکه Sign up کنه):
```sql
insert into public.allowed_emails (email) values ('newperson@example.com');
```

**حذفِ دسترسیِ یه نفر** (اکانتش رو هم از **Authentication → Users** پاک کن):
```sql
delete from public.allowed_emails where email = 'someone@example.com';
```

---

## ۲) برچسبِ مدیر / رئیس (اختیاری — فقط نمایشی)
نقش دسترسی رو محدود نمی‌کنه، فقط برچسبیه که توی صفحه‌ی Activity دیده می‌شه.
```sql
update public.profiles set role = 'manager' where email = 'someone@example.com';
-- یا 'boss'
```

---

## ۳) بکاپ‌ها

### الف) تاریخچه‌ی داخلِ دیتابیس (هر تغییر ذخیره می‌شه)
**دیدنِ لیستِ نسخه‌ها:**
```sql
select id, saved_at, saved_by from public.workspace_history order by saved_at desc;
```

**دیدنِ محتوای یه نسخه‌ی خاص:**
```sql
select data from public.workspace_history where id = 4;   -- شماره رو از لیستِ بالا بردار
```

**برگردوندنِ داده به یه نسخه‌ی قبلی (Restore):**
```sql
update public.workspaces
set data = (select data from public.workspace_history where id = 4)
where id = 'default';
```
> چند ثانیه بعد روی خودِ اپ هم زنده آپدیت می‌شه.

### ب) بکاپِ روزانه به Google Drive
فایل‌ها با اسمِ `worknexus-YYYY-MM-DD.json` توی فولدرِ Drive ذخیره می‌شن.

**گرفتنِ یه بکاپِ دستی همین الان:**
```sql
select public.run_gdrive_backup();
```

**دیدنِ نتیجه‌ی آخرین ارسال:**
```sql
select id, status_code, left(content, 200) as content, error_msg
from net._http_response order by id desc limit 1;
```

**دیدنِ زمان‌بندیِ فعلی:**
```sql
select jobname, schedule, active from cron.job;
```

**تغییرِ زمان‌بندی** (هر اسمِ job همونه، فقط زمان عوض می‌شه):
```sql
-- روزی یک‌بار، ۲ بامداد (پیش‌فرض):
select cron.schedule('gdrive-daily-backup', '0 2 * * *',  $$ select public.run_gdrive_backup(); $$);
-- هر ۶ ساعت:
select cron.schedule('gdrive-daily-backup', '0 */6 * * *', $$ select public.run_gdrive_backup(); $$);
-- هر ساعت:
select cron.schedule('gdrive-daily-backup', '0 * * * *',  $$ select public.run_gdrive_backup(); $$);
```

**خاموش‌کردنِ بکاپِ Drive:**
```sql
select cron.unschedule('gdrive-daily-backup');
```

---

## ۴) حذفِ کاملِ یه اکانت
وقتی یه اکانت رو از Auth پاک می‌کنی، ردِّش (لیستِ اکانت‌ها + لاگِ فعالیت) توی صفحه‌ی Activity می‌مونه. برای پاک‌سازیِ کامل سه قدم:

**۱. حذف از Auth:** برو **Authentication → Users** و اکانت رو Delete کن.

**۲. حذف از لیستِ مجاز:**
```sql
delete from public.allowed_emails where email = 'someone@example.com';
```

**۳. پاک‌کردنِ ردِّش از Activity** — اول `userId` ـش رو پیدا کن:
```sql
select key as user_id, value->>'email' as email
from public.workspaces, jsonb_each(data->'seen') where id = 'default';
```
بعد با اون `user_id` این رو اجرا کن (جای `USER_ID_HERE` بذارش):
```sql
update public.workspaces
set data = jsonb_set(
  data #- '{seen,USER_ID_HERE}',
  '{activity}',
  coalesce((
    select jsonb_agg(e order by ord)
    from jsonb_array_elements(data->'activity') with ordinality t(e, ord)
    where e->>'userId' is distinct from 'USER_ID_HERE'
  ), '[]'::jsonb)
)
where id = 'default';
```

---

## ۵) کارهای داشبوردی (بدونِ SQL)
- **محافظت در برابر پسوردهای لو‌رفته:** Authentication → Passwords → روشنش کن.
- **(اختیاری) بستنِ کاملِ ثبت‌نام:** Authentication → Sign In / Up. (دسترسی الان با allowlist کنترل می‌شه، این فقط یه لایه‌ی اضافه‌ست.)

---

## ۶) سلامتِ پروژه
هر از گاهی یه نگاه به **هشدارهای امنیتی/کارایی** بنداز:
**Supabase → Advisors** (Security و Performance).
