# راهنمای کارهای دستیِ Supabase (ادمین)

> نصبِ اولیه **انجام شده**. این فایل فقط کارهاییه که هر از گاهی خودت توی Supabase انجام می‌دی.
> همه‌ی کوئری‌ها رو اینجا اجرا کن: **Supabase → SQL Editor → New query → بچسبون → Run**.
> (ایمیل‌های توی مثال‌ها فیک‌ان — جای `someone@example.com` ایمیلِ واقعی رو بذار.)

---

## ۱) مدیریتِ دسترسی — کی می‌تونه وارد بشه (+ نقشش)
دسترسی **فقط با دعوت**ه. کسی می‌تونه Sign up کنه که ایمیلش توی لیستِ `allowed_emails` باشه. نقشِ هر نفر (`manager` یا `boss`) رو هم همون موقعِ دعوت مشخص می‌کنی.

> 🔧 **فقط یک‌بار لازمه** (برای فعال‌کردنِ نقش هنگامِ دعوت) — این بلوک رو یک‌بار توی SQL Editor اجرا کن:
> ```sql
> -- ستونِ نقش به لیستِ مجاز (پیش‌فرض boss)
> alter table public.allowed_emails
>   add column if not exists role text not null default 'boss'
>   check (role in ('manager','boss'));
>
> -- ثبت‌نام، نقشِ دعوت‌شده رو روی پروفایل بذاره (به‌جای boss ثابت)
> create or replace function public.handle_new_user()
> returns trigger language plpgsql security definer set search_path to 'public'
> as $$
> declare is_allowed boolean; invited_role text;
> begin
>   select true, role into is_allowed, invited_role
>   from public.allowed_emails where lower(email) = lower(new.email) limit 1;
>   if not coalesce(is_allowed, false) then
>     raise exception 'This email is not authorised to sign up. Contact the administrator.';
>   end if;
>   insert into public.profiles (id, email, role)
>   values (new.id, new.email, coalesce(invited_role, 'boss'))
>   on conflict (id) do nothing;
>   return new;
> end; $$;
> ```

**دیدنِ لیستِ افرادِ مجاز + نقششون:**
```sql
select email, role, added_at from public.allowed_emails order by added_at;
```

**اضافه‌کردنِ یه نفرِ جدید + نقشش** (حتماً *قبل* از اینکه Sign up کنه):
```sql
-- مدیر:
insert into public.allowed_emails (email, role) values ('newperson@example.com', 'manager');
-- رئیس (نقش اختیاریه، پیش‌فرض boss):
insert into public.allowed_emails (email) values ('newperson@example.com');
```
> ⚠️ نقش فقط لحظه‌ی **Sign up** روی پروفایلِ طرف می‌نشینه. اگه کسی **قبلاً** ثبت‌نام کرده، نقشش از اینجا عوض نمی‌شه — از بخشِ ۲ تغییرش بده.

**حذفِ دسترسیِ یه نفر** (اکانتش رو هم از **Authentication → Users** پاک کن):
```sql
delete from public.allowed_emails where email = 'someone@example.com';
```

---

## ۲) تغییرِ نقشِ یه کاربرِ موجود (مدیر / رئیس)
نقش رو معمولاً موقعِ دعوت (بخشِ ۱) مشخص می‌کنی. برای عوض‌کردنِ نقشِ کسی که **از قبل ثبت‌نام کرده**:
```sql
update public.profiles set role = 'manager' where email = 'someone@example.com';
-- یا 'boss'
```
> برای سازگاریِ دعوتِ بعدی، توی لیستِ مجاز هم آپدیت کن:
> ```sql
> update public.allowed_emails set role = 'manager' where email = 'someone@example.com';
> ```
> نقش دسترسی رو محدود نمی‌کنه؛ نمای پیش‌فرض (رئیس/مدیر) و برچسبِ صفحه‌ی Activity رو تعیین می‌کنه.

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

**برگردوندنِ داده به یه نسخه‌ی قبلی (Restore) — از طریقِ SQL:**
```sql
update public.workspaces
set data = (select data from public.workspace_history where id = 4)
where id = 'default';
```
> چند ثانیه بعد روی خودِ اپ هم زنده آپدیت می‌شه.

**بازگردانی از داخلِ خودِ اپ (بدونِ SQL):** حالا یه دکمه‌ی **Backups** توی سایدبار → **Data** هست که همین تاریخچه رو نشون می‌ده و با یه کلیک Restore می‌کنه (بازگردانی خودش هم ذخیره می‌شه، پس برگشت‌پذیره).

> 🔧 **فقط یک‌بار لازمه** (تا کاربرانِ واردشده بتونن این تاریخچه رو از داخلِ اپ بخونن) — این بلوک رو توی SQL Editor اجرا کن:
> ```sql
> drop policy if exists wsh_select on public.workspace_history;
> create policy wsh_select on public.workspace_history
>   for select to authenticated using (true);
> grant select on public.workspace_history to authenticated;
> ```
> بعدش توی اپ: **Data → Backups → انتخابِ نسخه → Restore**. تا وقتی این اجرا نشه، لیستِ Backups داخلِ اپ خالی نشون داده می‌شه (دیتات هرچند همچنان server-side بکاپ می‌شه).

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

## ۵) پاک‌کردنِ کاملِ لاگِ فعالیت
لاگِ صفحه‌ی Activity خودش حداکثر **۲۵۰ موردِ آخر** رو نگه می‌داره (قدیمی‌ترها خودکار می‌افتن بیرون، بر اساسِ زمان پاک نمی‌شه). اگه خواستی همه‌شو یکجا خالی کنی:
```sql
update public.workspaces
set data = jsonb_set(data, '{activity}', '[]'::jsonb),
    updated_at = now()
where id = 'default';
```
> چند ثانیه بعد روی خودِ اپ هم زنده خالی می‌شه. اگه نشد، صفحه رو refresh کن.

**بررسی** (باید `0` برگردونه):
```sql
select jsonb_array_length(data->'activity') as log_count
from public.workspaces where id = 'default';
```
⚠️ برگشت‌ناپذیره — کلِ تاریخچه پاک می‌شه، ولی بقیه‌ی دیتات (کارمندها، پروژه‌ها، جلسات…) سالم می‌مونه.

---

## ۶) کارهای داشبوردی (بدونِ SQL)
- **محافظت در برابر پسوردهای لو‌رفته:** Authentication → Passwords → روشنش کن.
- **(اختیاری) بستنِ کاملِ ثبت‌نام:** Authentication → Sign In / Up. (دسترسی الان با allowlist کنترل می‌شه، این فقط یه لایه‌ی اضافه‌ست.)

---

## ۷) سلامتِ پروژه
هر از گاهی یه نگاه به **هشدارهای امنیتی/کارایی** بنداز:
**Supabase → Advisors** (Security و Performance).

---

## ۸) فرمِ درخواست‌ها (Requests)
بخشِ **Requests** توی اپ یه فرمِ عمومی داره که لینکش رو برای تیم می‌فرستی؛ هر کی با لینک، **بدونِ اکانت**، اسم + راهِ ارتباطی + توضیحِ درخواستش رو پر می‌کنه و توی اپ می‌بینیش.

> 🔧 **فقط یک‌بار لازمه** (برای ساختِ جدول + دسترسی‌ها) — این بلوک رو توی SQL Editor اجرا کن:
> ```sql
> create table if not exists public.requests (
>   id uuid primary key default gen_random_uuid(),
>   name text not null,
>   channel text,                         -- WhatsApp / Discord / …
>   contact text,                         -- شناسه/شماره‌ی طرف
>   message text not null,
>   status text not null default 'new',   -- new | done
>   created_at timestamptz not null default now()
> );
> alter table public.requests enable row level security;
>
> -- فرمِ عمومی (ناشناس) فقط می‌تونه درخواست ثبت کنه
> drop policy if exists req_insert on public.requests;
> create policy req_insert on public.requests for insert to anon, authenticated with check (true);
> -- کاربرانِ واردشده (مدیر/رئیس) می‌تونن ببینن و مدیریت کنن
> drop policy if exists req_select on public.requests;
> create policy req_select on public.requests for select to authenticated using (true);
> drop policy if exists req_update on public.requests;
> create policy req_update on public.requests for update to authenticated using (true) with check (true);
> drop policy if exists req_delete on public.requests;
> create policy req_delete on public.requests for delete to authenticated using (true);
>
> grant insert on public.requests to anon;
> grant select, insert, update, delete on public.requests to authenticated;
> ```

**نحوه‌ی استفاده:** برو تبِ **Requests** → دکمه‌ی «Copy form link» → لینک رو برای تیم بفرست. لینک به شکلِ `…/?request=1` هست.

**دیدنِ درخواست‌ها از طریقِ SQL (اختیاری):**
```sql
select created_at, name, channel, contact, status, message
from public.requests order by created_at desc;
```
> ⚠️ چون فرم عمومیه، هر کسی با لینک می‌تونه ثبت کنه (احتمالِ اسپم). اگه زیاد شد، بهم بگو تا یه محدودیتِ ساده (مثلاً rate-limit یا CAPTCHA سبک) اضافه کنیم.
