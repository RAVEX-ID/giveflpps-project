# GiveFlpps

لوحة تعرض **أنشط 100 مسابقة (Giveaway) متاحة الآن للدخول** على موقع
[SteamGifts](https://www.steamgifts.com)، مرتبة حسب عدد المشاركين (entries)،
مع نقاط الدخول، الحد الأدنى للمستوى، عدد النسخ، الوقت المتبقي، وعدد
المسابقات النشطة حالياً لنفس اللعبة (إن وُجد أكثر من عرض واحد للعبة نفسها
في نفس الوقت).

الموقع غير رسمي وغير تابع لـ SteamGifts — هو أداة تجميع بيانات (aggregator)
بواجهة مستقلة.

---

## كيف يعمل المشروع

```
giveflpps/
├── netlify.toml                     إعدادات Netlify (النشر + الدوال + الجدولة)
├── package.json
├── netlify/functions/
│   ├── lib/
│   │   ├── scraper.js               محرّك الاستخراج (يقرأ صفحات SteamGifts)
│   │   └── store.js                 طبقة التخزين (Netlify Blobs)
│   ├── sync-giveaways.js            دالة مجدولة تعمل كل 30 دقيقة تقريباً
│   ├── get-giveaways.js             الـ API العام الذي تستدعيه الواجهة
│   └── refresh.js                   تحديث يدوي فوري (محمي بكلمة سرّ)
├── public/
│   ├── index.html / styles.css / app.js   الواجهة الأمامية
└── scripts/test-parser.js           اختبار محرّك الاستخراج بدون إنترنت
```

**الفكرة الأساسية:** دالة مجدولة (`sync-giveaways`) تجلب عدة صفحات من قائمة
مسابقات SteamGifts، تستخرج البيانات، وتخزّن أفضل 100 نتيجة في **Netlify
Blobs** (تخزين مدمج مع Netlify، يعمل تلقائياً بدون أي إعداد إضافي). بعدها،
كل زيارة للموقع تقرأ دالة `get-giveaways` هذه النسخة المخزَّنة فوراً — لا
يحدث أي "سحب مباشر" من SteamGifts عند كل زيارة، وهذا ما يجعل الموقع سريعاً
ولا يُحمِّل SteamGifts بطلبات كثيرة.

### كيف يتم "الاستخراج" (Scraping) تحديداً

بدل الاعتماد على أسماء أصناف CSS (classes) التي قد تتغيّر مع أي تحديث
تصميمي لموقع SteamGifts، يعتمد `scraper.js` على شيء أكثر ثباتاً: **بنية
الروابط**. كل صف مسابقة يحتوي دائماً على رابط لصفحة المسابقة
(`/giveaway/{code}/{slug}`)، ورابط لعدد المشاركين
(`/giveaway/{code}/{slug}/entries`)، ورابط لصفحة اللعبة (`/game/...`)،
ورابط للمستخدم صاحب العرض (`/user/...`). يحدّد الكود صفّ كل مسابقة عبر هذه
الروابط، ثم يقرأ الأرقام مباشرة من النص الظاهر للمستخدم ("507 entries"،
"(30P)"، "Level 2+"، "3 hours remaining"). هذا يجعل الاستخراج أكثر مقاومة
لتغييرات التصميم طالما بقيت بنية الروابط والصياغة كما هي.

> **ملاحظة مهمة وأمانة:** لا يوجد لـ SteamGifts واجهة برمجية (API) رسمية
> عامة، لذا هذا المشروع يعتمد على قراءة صفحاتهم العامة (نفس ما يراه أي
> زائر عادي بدون تسجيل دخول). يُرجى الاطلاع على
> [شروط الاستخدام](https://www.steamgifts.com/legal/terms-of-service)
> الخاصة بهم قبل النشر العلني الواسع، والإبقاء على معدّل الطلبات منخفضاً
> (القيم الافتراضية هنا متحفظة عمداً — راجع قسم "الإعدادات" أدناه). هذا
> المشروع لأغراض شخصية/مجتمعية للاطلاع فقط، وليس بديلاً لحساب SteamGifts
> ولا يقوم بالدخول في المسابقات نيابة عنك.

---

## التشغيل محلياً

```bash
npm install
npm run test:parser   # يتحقق من محرّك الاستخراج بدون إنترنت (اختياري لكن مفيد)
npx netlify dev       # يشغّل الموقع + الدوال محلياً على http://localhost:8888
```

`netlify dev` يحتاج [Netlify CLI](https://docs.netlify.com/cli/get-started/)
(`npm install -g netlify-cli` إن لم يكن مثبّتاً).

---

## النشر على Netlify

### الطريقة الأسهل: عبر GitHub

1. ارفع هذا المجلد إلى مستودع GitHub (أو GitLab/Bitbucket).
2. من لوحة Netlify: **Add new site → Import an existing project** واختر
   المستودع.
3. Netlify سيقرأ `netlify.toml` تلقائياً (مجلد النشر `public`، ومجلد الدوال
   `netlify/functions`) — لا حاجة لتغيير أي إعداد بناء (build settings).
4. بعد أول نشر، اذهب إلى **Site configuration → Environment variables**
   وأضف (اختياري لكن مُستحسن):
   - `SCRAPER_CONTACT` — بريدك الإلكتروني أو رابط تواصل، يُضاف داخل
     الـ User-Agent الذي يرسله البوت (ممارسة مهذّبة تجاه SteamGifts).
   - `REFRESH_SECRET` — كلمة سرّ عشوائية طويلة، لتفعيل مسار التحديث اليدوي
     `/api/refresh?secret=...` (بدونها هذا المسار يبقى معطّلاً تلقائياً).
5. من تبويب **Functions**، تأكد أن `sync-giveaways` تظهر كدالة مجدولة
   (Scheduled). أول تشغيل لها سيكون بعد نشر الموقع بحسب الجدول (كل 30
   دقيقة)، لكن أول زائر للموقع قبل ذلك سيحصل على نتائج فورية لأن
   `get-giveaways` تقوم بعملية استخراج أصغر تلقائياً إن لم تجد بيانات
   مخزَّنة بعد (انظر `BOOTSTRAP_MAX_PAGES`).

### أو عبر Netlify CLI مباشرة من جهازك

```bash
npm install -g netlify-cli
netlify login
netlify init            # يربط المجلد بموقع Netlify جديد أو موجود
netlify deploy --prod
```

### Netlify Blobs

لا حاجة لأي إعداد يدوي — Netlify Blobs مفعّل تلقائياً لأي موقع على
Netlify منذ 2024، ومكتبة `@netlify/blobs` تكتشف بيانات الاتصال تلقائياً
عند التشغيل داخل دالة Netlify فعلية. لا تحتاج مفاتيح API ولا قاعدة بيانات
خارجية.

---

## الإعدادات (Environment Variables) — كلها اختيارية

| المتغيّر | الافتراضي | الوصف |
|---|---|---|
| `SYNC_MAX_PAGES` | `15` | عدد صفحات SteamGifts التي تُفحص في كل مزامنة مجدولة |
| `SYNC_CONCURRENCY` | `3` | عدد الطلبات المتزامنة أثناء الفحص (أقل = أهدأ على SteamGifts، أبطأ لك) |
| `BOOTSTRAP_MAX_PAGES` | `6` | عدد الصفحات في أول تشغيل تلقائي (قبل أول مزامنة مجدولة) — أصغر عمداً لضمان استجابة سريعة |
| `TOP_N` | `100` | عدد النتائج المحفوظة في القائمة |
| `SCRAPER_CONTACT` | (فارغ) | يُضاف داخل الـ User-Agent |
| `REFRESH_SECRET` | (فارغ = معطّل) | كلمة سرّ لتفعيل `/api/refresh` |

> **تنبيه بخصوص جدول التحديث (كل 30 دقيقة):** خلافاً للمتغيّرات أعلاه، لا
> يمكن التحكم بجدول المزامنة عبر environment variable، لأن Netlify يحتاج
> معرفة الجدول وقت البناء (build time) ليسجّله في بنيتها التحتية — وليس
> فقط كسلوك وقت التشغيل. لتغييره: عدّل القيمة الحرفية `"*/30 * * * *"` في
> **مكانين معاً** (يجب أن يتطابقا):
> `netlify/functions/sync-giveaways.js` (داخل استدعاء `schedule(...)`
> مباشرة) و `netlify.toml` (سطر `schedule = ...`)، ثم أعد النشر.

> **حد زمني للدوال:** الخطة المجانية في Netlify تُنهي أي دالة عادية بعد
> ١٠ ثوانٍ تقريباً. القيم الافتراضية أعلاه محسوبة لتبقى ضمن هذا الحد مع
> هامش أمان. إن رفعت `SYNC_MAX_PAGES` كثيراً وبدأت المزامنة تفشل بصمت،
> راجع سجلات الدالة (Function logs) في لوحة Netlify، وقلّل الرقم أو ارفع
> `SYNC_CONCURRENCY` بحذر.

تغيير أي متغيّر: **Site configuration → Environment variables** في لوحة
Netlify، ثم أعد النشر (Redeploy) ليتم تطبيقه.

---

## تحديث فوري يدوي

بعد تعريف `REFRESH_SECRET`:

```
https://your-site.netlify.app/api/refresh?secret=YOUR_SECRET
```

---

## التخصيص

- **الألوان والخطوط:** كل شيء في `public/styles.css` معرّف كمتغيّرات CSS
  أعلى الملف (`--bg-0`, `--ember`, `--teal`, `--font-ui`, `--font-num`...)
  — غيّرها من مكان واحد.
- **معيار الترتيب الافتراضي:** حالياً "الأكثر دخولاً" (entries تنازلياً).
  لتغييره، عدّل الفرز في `netlify/functions/sync-giveaways.js` (المتغيّر
  `top`) و/أو أزرار الفرز في `public/index.html` + `public/app.js`.
- **اسم الموقع:** غيّر "GiveFlpps" في `public/index.html` (العلامة
  والعنوان) — لا يوجد أي مكان آخر يعتمد على الاسم.

---

## لو توقف الاستخراج عن العمل مستقبلاً (SteamGifts غيّرت تصميمهم)

1. شغّل `npm run test:parser` — إن فشل، فهذا يعني أن أحد الأنماط
   (patterns) في `netlify/functions/lib/scraper.js` لم يعد يطابق الصفحة
   الحقيقية.
2. افحص صفحة `https://www.steamgifts.com/giveaways/search` يدوياً (View
   Source)، وقارن بنية الروابط مع الثوابت في أعلى `scraper.js`
   (`TITLE_HREF_RE`, `GAME_HREF_RE`, إلخ) والتعابير النمطية للنصوص
   (`POINTS_RE`, `ENTRIES_TXT_RE`...).
3. حدّث الثوابت المطلوبة فقط، ثم أعد تشغيل `npm run test:parser` مع تحديث
   `fixtures/sample-listing-page.html` إن لزم، للتأكد قبل النشر.
