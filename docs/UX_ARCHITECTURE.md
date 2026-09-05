# UX ARCHITECTURE — Me vs Me

## الهوية البصرية
- RTL-first، عربي أولًا. Dark / Light / System.
- Indigo (`--accent`) + Gold (`--gold`) على أسطح داكنة عميقة، حدود ناعمة، تدرجات خفيفة.
- شعور: RPG + Personal OS + Journal + Performance Dashboard. ليس Admin Dashboard.
- Tokens في `src/app/globals.css` (`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--accent`, `--gold`, `--danger`, `--ok`).

## Navigation
| مستوى | عناصر | mobile | desktop |
|---|---|---|---|
| Primary | يومي `/day` · أسبوعي `/week` · شهري `/month` | bottom nav (3 أولى) | sidebar أعلى |
| Secondary | التحديات `/challenges` · القرآن `/quran` · التدريب `/training` | bottom nav | sidebar |
| More | القائمة `/menu` · المكتبة `/library` · الذكاء `/ai` · الأهداف `/goals` · أنا `/me` · التعافي `/healing` · تفريغ العقل `/brain-dump` · الإعدادات `/settings` | زر "المزيد" → bottom sheet | sidebar (قسم ثانٍ) |

### Legacy redirects (محفوظة في `src/app/routes.ts`)
`/` → `/day` · `/today` → `/day` · `/myday` → `/day` · `/week`/`/myweek` · `/month`/`/mymonth` · `/recovery`, `/healing` · `/books`, `/reader`, `/courses` → `/library?tab=…` · `/profile` → `/me` · `/assistant` → `/ai` · `/dump` → `/brain-dump` · `/body` → `/goals?tab=body` (Body Tracker داخل Goals كـtab ويُفتح أيضًا من Me) · `/finance` → `/goals?tab=finance`.

## Page hierarchy
- **My Day**: Header(date navigator + ring + XP) → Habits → Tasks → Physical → Deen → Creativity → Shutdown CTA (sticky on mobile).
- **My Week**: Tabs: الخطة · الأهداف · التقرير · المراجعة.
- **My Month**: Tabs: التقرير · الأهداف · المراجعة.
- **Goals**: Tabs: الأهداف · الجسم (summary/record/photos/charts/all) · المال.
- **Healing**: Header sobriety + risk → Tabs: اليوم · SOS · الانتكاسات · المهام · ما فقدته · التحليلات · المرحلة.
- **Quran**: progress → grid 604 (virtualized by juz) → مراجعات مستحقة → تدبر.
- **Library**: Tabs: الكتب · القارئ · الدورات · Drive.
- **Challenges**, **Training**, **Brain Dump**, **Me**, **AI**, **Settings** (فهرس أقسام → قسم).

## Responsive
- < 768px: bottom nav 64px، sticky actions، bottom sheets، forms عمود واحد، touch ≥ 44px، charts ارتفاع 180–220.
- ≥ 1024px: sidebar 260px، grid 2–3 أعمدة، side panels للقارئ، اختصارات لوحة (← → لليوم، `S` للإغلاق، `?` للمساعدة).

## Component system (`components/ui/index.tsx`)
Card, StatCard, ProgressRing, ProgressBar, Section, CollapsibleSection, Modal, Drawer, BottomSheet, Tabs, SegmentedControl, Input, NumberInput, Slider, Select, Textarea, DateNavigator, EmptyState, LoadingState, ErrorState, ConfirmDialog, Toast, ChartCard, GoalCard, HabitRow, TaskRow, XPBadge, RankBadge, Button, Chip, Field.

## Interaction patterns
- Modal: focus trap، Esc، `aria-modal`، إعادة focus للمُشغّل.
- Bottom sheet على mobile يستبدل Modal تلقائيًا (`Modal` يقرر حسب العرض).
- Confirm لكل حذف/إعادة تعيين/AI action.
- Toast للنتائج (XP +10 …) مع `aria-live="polite"`.
- Reduced motion: كل الحركات تحت `@media (prefers-reduced-motion)`.

## States
- Empty: أيقونة + عنوان + وصف + CTA.
- Loading: skeleton/spinner مع نص.
- Error: رسالة + retry + fallback offline.
- Offline: شريط علوي "غير متصل — التغييرات محفوظة محليًا".

## Shutdown flow
Stepper 5 خطوات، مؤشر تقدم، حفظ draft عند كل خطوة (`entries[d].shutdownStep`)، إغلاق آمن (Esc يحفظ)، النتيجة تعرض score وXP والاحتفال، ثم رسالة إغلاق.

## E2E scenarios (مواصفة اختبار قبول)
1. مستخدم جديد → onboarding (اسم/هدف/بداية تعافٍ اختيارية) → يوم فارغ.
2. سير يومي: عادة، مهمة، وجبة، ذكر → تقدم ورينج.
3. Shutdown كامل → يوم مغلق + XP.
4. تخطيط أسبوعي → مهمة تظهر في اليوم.
5. أزمة تعافٍ: SOS → تنفس → craving resisted → XP.
6. قراءة كتاب: رفع PDF → تظليل → تصدير MD.
7. استيراد CSV دورات → إحصاءات.
8. استعادة نسخة قديمة → نفس XP/level.
9. Offline → تعديل → online → sync.
