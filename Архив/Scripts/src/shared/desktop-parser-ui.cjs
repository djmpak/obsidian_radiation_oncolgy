/**
 * Shared AI Parser and Chat UI
 */
const buildAiPanel = async (context) => {
    const {
        msc, MODAL_ID, modal, _pfDesktopCore, ls, getVal, saveNow,
        _dbMergeDiagnosisText, _npNormalizeLabDateKey,
        _npMatchEcogInText, _npNormalizeEcog, _dbNormalizeHistoryText,
        _dbNormalizeDrugNames, _dbNormalizeDiagnosisText, _dbResolvePatientId,
        draft, getStoredVal, refreshStoredFrontmatter, buildForm, wrap,
        ensureCurrentPatientId: contextEnsureCurrentPatientId
    } = context;
    const normalizeHistoryText = _dbNormalizeHistoryText;
    const normalizeDrugNames = _dbNormalizeDrugNames;
    const normalizeDiagnosisText = _dbNormalizeDiagnosisText;
    const normalizeEcog = _npNormalizeEcog;
    const matchEcogInText = _npMatchEcogInText;
    const normalizeLabDateKey = _npNormalizeLabDateKey;
    const ensureCurrentPatientId = typeof contextEnsureCurrentPatientId === "function" ? contextEnsureCurrentPatientId : async () => "";

    function autoGrow(el) {
        el.style.height = "auto";
        el.style.height = (el.scrollHeight || 36) + "px";
    }

    // ── AI-ПАРСЕР ─────────────────────────────────────────────────────────────
    const AI_COLOR = "#6200ea";
    const AI_KEY_LS = "or_api_key";
    const LITELLM_KEY_LS = "litellm_api_key";
    const PROVIDER_LS = "ai_provider";
    const MODEL_LS = "or_model";
    const MODELS = [
        { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
        { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
        { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
        { id: "qwen/qwen3.6-plus", label: "Qwen 3.6 Plus" },
        { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
    ];
    const AI_PROVIDERS = [
        { id: "openrouter", label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", keyStorage: AI_KEY_LS },
        { id: "litellm", label: "LiteLLM", endpoint: "http://212.86.115.215:4000/v1/chat/completions", keyStorage: LITELLM_KEY_LS }
    ];
    const DEFAULT_MODEL = "google/gemini-3-flash-preview";
    const PARSER_FALLBACK_MODEL = "deepseek/deepseek-v4-flash";
    const _getAiProvider = () => localStorage.getItem(PROVIDER_LS) || "openrouter";
    const _getProviderInfo = (providerId = _getAiProvider()) => AI_PROVIDERS.find(item => item.id === providerId) || AI_PROVIDERS[0];
    const _getProviderKey = (providerId = _getAiProvider()) => localStorage.getItem(_getProviderInfo(providerId).keyStorage) || "";
    const _getProviderModelId = (model, providerId = _getAiProvider()) => {
        const cleanModel = String(model || DEFAULT_MODEL).replace(/^openrouter\//, "");
        return providerId === "litellm" ? `openrouter/${cleanModel}` : cleanModel;
    };
    const _getProviderRequestConfig = (model, providerId = _getAiProvider()) => {
        const provider = _getProviderInfo(providerId);
        return {
            providerId: provider.id,
            endpoint: provider.endpoint,
            key: _getProviderKey(provider.id),
            modelId: _getProviderModelId(model, provider.id)
        };
    };
    const _getOrKey = () => localStorage.getItem(AI_KEY_LS) || "";

    const PARSER_PROMPT = `Ты — медицинский ассистент. Из предоставленного текста извлеки данные и верни ТОЛЬКО JSON-объект без пояснений.
Поля для извлечения:
- "ФИО": полное имя пациента (Фамилия Имя Отчество)
- "Дата_рождения": дата рождения в формате yyyy-MM-dd
- "СНИЛС": номер СНИЛС (формат XXX-XXX-XXX XX)
- "Номер_телефона": номер телефона
- "Email": электронная почта пациента (формат name@domain.com)
- "db_sex": пол пациента: "М" или "Ж"
- "db_tumor_location": точная анатомическая локализация опухоли (например "нижняя доля правого лёгкого", "левая молочная железа")
- "db_histotype": гистологический тип опухоли (например "аденокарцинома", "инфильтрирующий протоковый рак", "глиобластома"). Для рака предстательной железы возвращай просто "аденокарцинома" без слов "ацинарная"/"ацинозная".
- "db_date_dx": дата первичного выявления диагноза в формате yyyy-MM (или yyyy если месяц неизвестен)
- "db_surgery_type": тип выполненной операции (например "нижняя лобэктомия справа с медиастинальной лимфодиссекцией")
- "db_prior_treatment": предшествующее противоопухолевое лечение в хронологическом порядке. Строка через "; ". Формат каждой записи: "дд.мм.гггг событие" или "С мм.гггг по мм.гггг событие" или "С мм.гггг событие". Включай операции, лучевую терапию, химиотерапию, гормонотерапию, таргетную терапию и иммунотерапию. Без дозировок.
- "db_chemo_regimen": химиотерапия в хронологическом порядке. Строка через "; ". Для каждой записи указывай даты, число проведённых курсов и формулировку "ХТ по схеме ...". Без дозировок и без линий терапии. Названия препаратов и схем пиши с Заглавной Буквы. Комбинации оформляй через " + " (например "Этопозид + Карбоплатин"), последовательные схемы в одном интервале — через "→" (например "AC → Паклитаксел").
- "db_rt_method": метод лучевой терапии (например "IMRT", "VMAT", "SBRT", "3D-CRT", "брахитерапия")
- "db_hormonal_drug": препараты гормонотерапии, без дозировок, через "; " если несколько
- "db_targeted_drug": таргетные препараты, без дозировок, через "; " если несколько
- "db_immunotherapy_drug": препараты иммунотерапии, без дозировок, через "; " если несколько
- "db_stage": клиническая стадия (только цифра-буква, например "IIA", "IIIB", "IV"). Заполняй ТОЛЬКО исходную стадию на момент первичного стадирования. Если в тексте описано лечение, а затем прогрессирование/метастазы, НЕ рестадируй заболевание в IV стадию задним числом: оставь исходную стадию, а прогрессирование отрази отдельно.
- "db_t": значение T из TNM (например "2a", "3", "4b", "is") — только цифра/буква после T, без префикса c/p/y/r
- "db_n": значение N из TNM (например "0", "1", "2a", "3") — только цифра/буква после N
- "db_m": значение M из TNM (например "0", "1") — только цифра после M
- "db_grade": степень дифференцировки G (например "1", "2", "3") — только цифра
- "db_mol_subtype": молекулярный подтип — число: 1=Люминальный A, 2=Люминальный B HER2-, 3=Люминальный B HER2+, 4=HER2-позитивный, 5=Тройной негативный (только для РМЖ)
- "db_er": значение ER в баллах (число 0–8, например 7)
- "db_pr": значение PR в баллах (число 0–8, например 5)
- "db_her2": значение HER2 (0, 1, 2, 3 — только цифра)
- "db_ki67": Ki67 процент (число, например 35)
- "db_pdl1": экспрессия PD-L1 — строка (например "TPS 60%", "CPS 15", "0%")
- "db_egfr_mut": статус EGFR — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_alk_status": статус ALK — 0=отрицательно, 1=положительно
- "db_ros1_status": статус ROS1 — 0=отрицательно, 1=положительно
- "db_kras_mut": статус KRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_nras_mut": статус NRAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ras_mut": общий статус RAS — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_braf_mut": статус BRAF — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_idh_mut": статус IDH1/IDH2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_brca_mut": статус BRCA1/BRCA2 — 0=дикий тип/отрицательно, 1=мутация/положительно
- "db_ret_status": статус RET — 0=отрицательно, 1=положительно
- "db_met_status": статус MET — 0=отрицательно, 1=положительно
- "db_ntrk_status": статус NTRK — 0=отрицательно, 1=положительно
- "db_mgmt_meth": метилирование MGMT — строка "метилирован" или "неметилирован"
- "db_msi_status": микросателлитный статус — строка "MSS", "MSI-H", "MSI-L" или "MSI"
- "db_mmr_status": статус MMR — строка "pMMR" или "dMMR"
- "db_gleason": шкала Глисона (например "4+5=9")
- "db_initial_psa": исходный ПСА / PSA (число, например 47.6)
- "db_other_biomarkers": прочие релевантные биомаркеры, не вошедшие в отдельные поля (например "ATRX loss; 1p/19q codeletion; TERT mutation")
- "db_progression": 1 если в документе упомянуто прогрессирование заболевания, 0 если явно указано отсутствие прогрессирования
- "db_date_prog": дата прогрессирования в формате yyyy-MM (только если явно указана)
- "db_prog_type": тип прогрессирования — число: 1=локальное, 2=регионарное, 3=отдалённые метастазы, 4=смешанное
- "МКБ 10": код МКБ-10 (например C50.1)
- "Диагноз": структурированный текст. При нескольких онкологических диагнозах — нумеруй 1) ... 2) ... каждый с новой строки. СТРУКТУРА ОДНОГО ДИАГНОЗА (всё в одну строку, элементы разделены точкой с пробелом): Строка 1: [Гистологический тип] [локализация], [TNM с префиксом c/p/y/r], G[степень], [стадия]. Строка 2 (если есть ИГХ/молекулярные маркеры): маркеры на английском (ER Xб, PR Xб, HER2 X+, Ki67 X%, PD-L1 TPS X%, EGFR, ALK, KRAS, IDH, MSS и т.д.) + подтип СТРОГО НА РУССКОМ (Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный). Строки лечения: разовое — "дд.мм.гггг Событие." (без тире); диапазон — "С мм.гггг по мм.гггг Событие."; начато и продолжается — "С мм.гггг Событие.". ПРАВИЛА ЛЕЧЕНИЯ: НЕ писать "Состояние после". НЕ упоминать номера линий терапии. Лучевую терапию (ДЛТ, ХЛТ, брахитерапия, стереотаксис) — **жирным**, без дозировки СОД. Стереотаксическую радиохирургию писать как **Стереотаксическая радиохирургия**. ХТ: только название схемы/комбинации без дозировок, без линий, без числа курсов; комбинации оформляй через "+", последовательные режимы — через "→". Гормонотерапию, таргетную терапию и иммунотерапию — только название препарата, без дозировок. Прогрессирование — отдельной записью: "мм.гггг Прогрессирование, [описание].". СТАДИЯ И TNM В ДИАГНОЗЕ ФИКСИРУЮТСЯ ТОЛЬКО ОДИН РАЗ — на момент первичного стадирования. После начала противоопухолевого лечения НЕ переписывай первую строку диагноза в IV стадию по факту прогрессирования или появления отдалённых метастазов; такие события указывай только отдельными строками прогрессирования. СТРОЖАЙШИЙ ФИЛЬТР: в Диагноз включать ИСКЛЮЧИТЕЛЬНО онкологическое лечение (операции на опухоли, ХТ, ЛТ, гормонотерапия, таргетная терапия, иммунотерапия). Если данные не верифицированы — пиши "предположительно" или "клинически". КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО включать в Диагноз запланированное/рекомендованное лечение из протоколов консилиумов, решений ОК или назначений врача — только ФАКТИЧЕСКИ ПРОВЕДЁННОЕ лечение с реальными датами начала/окончания. Решения консилиума, рекомендации и планируемые курсы → поле "Решение_консилиума", НЕ в "Диагноз". Для рака предстательной железы не используй формулировку "ацинарная/ацинозная аденокарцинома" — пиши просто "Аденокарцинома". ПРИМЕРЫ: "Инфильтрирующий протоковый рак левой молочной железы, pT2N3cM0, G2, IIIC стадия. ER 7б, PR 5б, HER2 0+, Ki67 35%. Люминальный B, HER2-отрицательный. 15.01.2021 Органосохраняющая операция слева с лимфодиссекцией. С 03.2021 по 07.2021 ПХТ AC → Паклитаксел. С 08.2021 по 10.2021 **ДЛТ на молочную железу и зоны регионарного метастазирования**. С 11.2021 Гормонотерапия Тамоксифен. 05.2023 Прогрессирование, метастазы в кости (L2–L4, таз). С 06.2023 по 11.2023 МХТ Капецитабин. 12.2023 Прогрессирование. С 12.2023 Палбоциклиб + Летрозол." | "Аденокарцинома нижней доли правого лёгкого, cT2aN2M0, G2, IIIA стадия. EGFR del19+, ALK отрицательный, PD-L1 TPS 60%. 15.03.2022 Нижняя лобэктомия справа с медиастинальной лимфодиссекцией. С 05.2022 Гефитиниб. 11.2023 Прогрессирование, метастазы в головной мозг. 12.2023 **Стереотаксическая радиохирургия**. С 01.2024 Осимертиниб." | "Аденокарцинома прямой кишки, cT3N1bM0, G2, IIIB стадия. KRAS дикий тип, BRAF дикий тип, MSS. С 01.2024 по 03.2024 **ХЛТ (Капецитабин + ДЛТ)**. 15.04.2024 Низкая передняя резекция прямой кишки. С 06.2024 по 10.2024 ПХТ FOLFOX." | "Аденокарцинома предстательной железы, cT3aN0M0, G3, IIIB стадия. Gleason 4+5=9. Initial PSA 47.6. 20.02.2024 Биопсия простаты. С 03.2024 АДТ Дегареликс. С 04.2024 по 05.2024 **ДЛТ на простату и регионарные лимфоузлы**."
- "Решение_консилиума": решение консилиума, рекомендуемая тактика. Обязательно указывай учреждение, дату и номер консилиума/ОК, если номер есть в документе.
- "Жалобы": жалобы пациента
- "Анамнез_заболевания": история болезни в формате хронологического тайм-лайна. Каждое событие — отдельная строка: "дд.мм.гггг Описание события;" Включай: первичные обращения, выставление диагноза, операции, курсы ХТ/ЛТ, консилиумы, госпитализации, ключевые изменения состояния, прогрессирование. Для консилиумов обязательно указывай номер консилиума/ОК, если он есть в документе: "дд.мм.гггг Онкоконсилиум №XXXX, [учреждение]: [краткое решение];". Гистологические исследования включай в краткой форме: "дд.мм.гггг ПГИ №XXXXXX: [краткое заключение];" и "дд.мм.гггг ИГХ №XXXXXX: [ключевые маркеры];" и "дд.мм.гггг МГИ №XXXXXX: [молекулярный результат];" Из лабораторных данных включай ТОЛЬКО значения онкомаркеров (ПСА, РЭА, СА 19-9, СА 125, АФП, СА 15-3) с датой. НЕ включай ОАК, биохимию, коагулограмму, анализ мочи — они идут в "Лабораторные". Если дата неизвестна — указывай год или мм.гггг.
- "Анамнез_жизни": анамнез жизни: сопутствующие заболевания, наследственность, аллергии. Если в документе явно упомянуты препараты постоянного приёма по сопутствующим заболеваниям — добавь в конце отдельным блоком: "● [Название препарата], [дозировка], [режим]." для каждого препарата. ВАЖНО: вноси ТОЛЬКО препараты, прямо указанные в документе, ничего не додумывать.
- "Описания_исследований": результаты всех исследований в хронологическом порядке. Каждое исследование — отдельная строка с датой и номером протокола (если есть): "дд.мм.гггг ПГИ №XXXXXXX: [полное морфологическое описание без сокращений]." "дд.мм.гггг ИГХ №XXXXXXX: [все маркеры с результатами]." "дд.мм.гггг МГИ №XXXXXXX: [молекулярно-генетические данные]." "дд.мм.гггг УЗИ [область]: [описание]." "дд.мм.гггг КТ [область]: [описание]." "дд.мм.гггг МРТ [область]: [описание]." Сохраняй ВСЕ показатели подробно (ER/PR, Ki67, грейд G, размеры, метастазы). При отсутствии номера протокола — только дата и тип исследования.
- "Сопутствующие_заболевания": сопутствующие диагнозы
- "ECOG_статус": функциональный статус ECOG (целое число 0-4)
- "Лабораторные": массив объектов. Каждый объект — анализы за одну дату взятия биоматериала. Формат: {"Дата":"yyyy-MM-dd","Лейкоциты":число,"Нейтрофилы":число,"Лимфоциты":число,"Моноциты":число,"Эозинофилы":число,"Базофилы":число,"Эритроциты":число,"Гемоглобин":число,"Гематокрит":число,"Тромбоциты":число,"СОЭ":число,"АЛТ":число,"АСТ":число,"ЩФ":число,"ГГТ":число,"Билирубин":число,"Бил_прям":число,"Общий_белок":число,"Мочевина":число,"Креатинин":число,"Глюкоза":число,"Натрий":число,"Калий":число,"МНО":число,"АЧТВ":число,"ТВ":число,"ПТВ":число,"Д_димер":число,"ПСА":число,"РЭА":число,"СА_19_9":число,"СА_125":число,"АФП":число,"СА_15_3":число,"Уробилиноген_м":число,"Удельный_вес_м":число,"pH_мочи":число,"Лейкоциты_мочи":число,"Белок_мочи":число,"Билирубин_мочи":"строка","Глюкоза_мочи":"строка","Кровь_мочи":"строка","Кетоны_мочи":"строка","Нитриты_мочи":"строка"}. МАППИНГ РУССКИХ НАЗВАНИЙ: "Щелочная фосфатаза"→"ЩФ", "гамма-ГТ"/"ГГТ"→"ГГТ", "Билирубин прямой"/"Билирубин конъюгированный"→"Бил_прям", "Общий белок"→"Общий_белок", "D-димер"/"Д-димер"→"Д_димер", "Тромбиновое время"→"ТВ", "Протромбиновое время (с)"→"ПТВ", "CA 19-9"/"СА 19-9"→"СА_19_9", "CA 125"→"СА_125", "CA 15-3"→"СА_15_3", "РЭА"/"CEA"→"РЭА", "АФП"→"АФП", "СКО"/"Гематокрит"→"Гематокрит". АНАЛИЗ МОЧИ: "Уробилиноген" (моча)→"Уробилиноген_м" (число), "Удельный вес" (моча)→"Удельный_вес_м" (число, напр. 1.020), "pH" (моча)→"pH_мочи" (число), "Лейкоциты" (моча, полуколичественно)→"Лейкоциты_мочи" (число), "Белок" (моча)→"Белок_мочи" (число, если есть числовое значение), "Билирубин" (моча, кач.)→"Билирубин_мочи" (строка: "не обнаружен" или числовое значение как строка), "Глюкоза" (моча, кач.)→"Глюкоза_мочи" (строка), "Кровь" (моча)→"Кровь_мочи" (строка), "Кетоновые тела"→"Кетоны_мочи" (строка), "Нитриты"→"Нитриты_мочи" (строка). ВАЖНО: Не путай показатели МОЧИ с показателями КРОВИ — Лейкоциты в крови→"Лейкоциты" (число), Лейкоциты в моче→"Лейкоциты_мочи". Для клеток крови (лейкоциты, нейтрофилы, лимфоциты, эозинофилы, базофилы, моноциты, эритроциты, тромбоциты) ИЩИ И ИЗВЛЕКАЙ ТОЛЬКО АБСОЛЮТНЫЕ ЗНАЧЕНИЯ (например: "Абсолютное количество нейтрофилов 6,12" → 6.12). СТРОГО ИГНОРИРУЙ относительные значения в процентах (%). Бери цифру ТОЛЬКО из колонки "Результат", строго игнорируя колонку "Норма". Если в одном документе несколько дат (разные биоматериалы или разные исследования) — создавай отдельный объект для каждой уникальной даты и объединяй все показатели за эту дату в один объект.

ВАЖНЫЕ ПРАВИЛА:
1. ИСПРАВЛЯЙ опечатки во всех полях, переноси данные структурировано. Не ставь null. Если данных нет или они не упомянуты — не включай поле в JSON.
2. КОНФЛИКТЫ: Если в текстах встречаются противоречивые данные для поля, верни массив строк со всеми вариантами: ["вариант 1", "вариант 2"]. Если данные совпадают — верни строку.
3. ЛУЧЕВАЯ ТЕРАПИЯ: Жирным текстом (с помощью **маркдаун-звёздочек**) выделяй ЛЮБОЕ упоминание проведения ЛУЧЕВОЙ ТЕРАПИИ (ДЛТ, СЛТ, ХЛТ, брахитерапия) в полях "Диагноз", "Анамнез_заболевания" и "Анамнез_жизни".
4. ПОРЯДОК В ДИАГНОЗЕ: строго соблюдай последовательность — [гистотип + локализация] → [TNM] → [G] → [стадия] → [маркеры ER/PR/HER2/Ki67/мутации] → [подтип по-русски] → [лечение хронологически]. Не добавляй заголовки разделов.
5. МОЛЕКУЛЯРНЫЕ ПОДТИПЫ — ТОЛЬКО НА РУССКОМ. Маркеры (ER, PR, HER2, Ki67, EGFR, ALK, KRAS, NRAS, BRAF, IDH, BRCA, MET, RET, NTRK, MGMT, PD-L1, MSS/MSI и т.д.) — на английском. Подтип описывать по-русски: Люминальный A / Люминальный B HER2-отрицательный / Люминальный B HER2-положительный / HER2-положительный / Тройной негативный.
6. БИОМАРКЕРЫ: каждый маркер извлекай НЕЗАВИСИМО. У одного пациента могут одновременно быть положительными несколько маркеров или альтераций (например EGFR и ALK). Для бинарных полей используй: 1 = положительно / мутация / перестройка / амплификация, 0 = отрицательно / дикий тип. Если маркер не исследовался или нет явного результата — НЕ включай поле в JSON.
7. ХИМИОТЕРАПИЯ ДЛЯ БД: поле "db_chemo_regimen" заполняй в хронологическом порядке с датами, числом проведённых курсов и схемой. Форматируй как "С дд.мм.гггг по дд.мм.гггг проведено N курсов ХТ по схеме Название + Название" или "С мм.гггг проведено N курсов ХТ по схеме Название + Название", если известен только месяц. Не включай дозировки, мг/м2 и номера линий терапии.
8. ПРЕДШЕСТВУЮЩЕЕ ЛЕЧЕНИЕ ДЛЯ БД: поле "db_prior_treatment" заполняй по всей фактически проведённой противоопухолевой терапии в хронологии. Включай операции, ЛТ, ХТ, гормонотерапию, таргетную терапию, иммунотерапию. Не включай рекомендации и планы.
9. ДОПОЛНЕНИЕ ДАННЫХ: Если в сообщении есть раздел "=== ТЕКУЩИЕ ДАННЫЕ КАРТЫ ===" — произведи итоговую объединённую версию каждого поля. Не дублируй уже имеющиеся события, препараты или диагнозы. Для "Диагноз" — добавь новые события лечения хронологически к существующим. Для "Анамнез_жизни" — дополни список препаратов, не повторяй уже указанные. Для "Сопутствующие_заболевания" — объедини оба перечня без дублирования. Нельзя терять уже подтверждённые данные карты, если новый документ их не опровергает.
10. TNM И СТАДИЯ: если в документе явно указаны T, N, M или их можно надёжно извлечь из сформированного диагноза, обязательно заполни db_t, db_n, db_m и db_stage. Для рака предстательной железы при наличии T/N/M и данных Gleason и/или PSA постарайся определить стадию максимально точно.
11. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" — любое НЕ-онкологическое лечение и события: кардиология (стентирование, АКШ, кардиостимулятор, антикоагулянты), неврология (инсульт, ОНМК), сосудистая хирургия (ТЭЛА, тромбэктомия, имплантация кава-фильтра), ортопедия (эндопротезирование, остеосинтез), офтальмология, стоматология, дерматология, эндокринология (инсулинотерапия, тиреоидэктомия по поводу узлового зоба), гастроэнтерология (холецистэктомия по поводу ЖКБ), урология (ТУР аденомы простаты — НЕ онко; ТУР опухоли мочевого пузыря — ДА, это онко) и т.д. Все перечисленное → "Анамнез_заболевания" или "Анамнез_жизни", НИКОГДА в "Диагноз". В "Диагноз" идут ТОЛЬКО: резекции/удаление опухоли и лимфодиссекции, ПХТ/МХТ, ДЛТ/ХЛТ/брахитерапия/СРХ, гормонотерапия опухоли, таргетная терапия, иммунотерапия, прогрессирование.
12. ❌ ЗАПРЕЩЕНО ВКЛЮЧАТЬ В "Диагноз" запланированное лечение: решения консилиумов, рекомендации врачей, назначения, которые ещё НЕ начаты. Только ФАКТИЧЕСКИ проведённое лечение с датами. План лечения → "Решение_консилиума".
13. ФОРМАТ ДИАГНОЗА: для одного онкологического диагноза ВСЕ части и ВСЕ события пиши в ОДНУ непрерывную строку без переводов строк. Гистология, локализация, TNM, стадия, маркеры и далее все события лечения/прогрессирования должны идти последовательно по хронологии и разделяться точкой с пробелом.
14. ФОРМАТ ХТ В ДИАГНОЗЕ: химиотерапию оформляй как отдельное предложение в той же строке диагноза. Обязательно указывай период лечения, число курсов и формулировку "ХТ по схеме ...". Названия препаратов и схем пиши с Заглавной Буквы. Пример: "С 12.02.2025 по 29.05.2025 проведено 4 курса ХТ по схеме Этопозид + Карбоплатин."`; 

    const PARSER_PROMPT_VERSION = "2026-04-21-stage-immutability-v1";
    const PARSER_REVIEW_THRESHOLD = 0.82;
    const PARSER_ALLOWED_KEYS = [
        "ФИО","Дата_рождения","СНИЛС","Номер_телефона","Email",
        "db_sex","db_tumor_location","db_histotype","db_date_dx","db_surgery_type",
        "db_prior_treatment","db_chemo_regimen","db_rt_method","db_hormonal_drug",
        "db_targeted_drug","db_immunotherapy_drug","db_stage","db_t","db_n","db_m",
        "db_grade","db_mol_subtype","db_er","db_pr","db_her2","db_ki67","db_pdl1",
        "db_egfr_mut","db_alk_status","db_ros1_status","db_kras_mut","db_nras_mut",
        "db_ras_mut","db_braf_mut","db_idh_mut","db_brca_mut","db_ret_status",
        "db_met_status","db_ntrk_status","db_mgmt_meth","db_msi_status","db_mmr_status",
        "db_gleason","db_initial_psa","db_other_biomarkers","db_progression",
        "db_date_prog","db_prog_type","db_vital_status","db_date_death",
        "db_date_last_contact","db_ecog_last","МКБ 10","Диагноз","Решение_консилиума",
        "Жалобы","Анамнез_заболевания","Анамнез_жизни","Описания_исследований",
        "Сопутствующие_заболевания","ECOG_статус"
    ];
    const PARSER_LABELS = {
        "db_sex": "Пол",
        "db_tumor_location": "Локализация опухоли",
        "db_histotype": "Гистотип",
        "db_date_dx": "Дата диагноза",
        "db_surgery_type": "Тип операции",
        "db_prior_treatment": "Предшествующее лечение",
        "db_chemo_regimen": "Химиотерапия",
        "db_rt_method": "Метод ЛТ",
        "db_hormonal_drug": "Гормонотерапия",
        "db_targeted_drug": "Таргетная терапия",
        "db_immunotherapy_drug": "Иммунотерапия",
        "db_stage": "Стадия",
        "db_t": "T",
        "db_n": "N",
        "db_m": "M",
        "db_grade": "Grade",
        "db_mol_subtype": "Молекулярный подтип",
        "db_er": "ER",
        "db_pr": "PR",
        "db_her2": "HER2",
        "db_ki67": "Ki67",
        "db_pdl1": "PD-L1",
        "db_egfr_mut": "EGFR",
        "db_alk_status": "ALK",
        "db_ros1_status": "ROS1",
        "db_kras_mut": "KRAS",
        "db_nras_mut": "NRAS",
        "db_ras_mut": "RAS",
        "db_braf_mut": "BRAF",
        "db_idh_mut": "IDH",
        "db_brca_mut": "BRCA",
        "db_ret_status": "RET",
        "db_met_status": "MET",
        "db_ntrk_status": "NTRK",
        "db_mgmt_meth": "MGMT",
        "db_msi_status": "MSI/MSS",
        "db_mmr_status": "MMR",
        "db_gleason": "Gleason",
        "db_initial_psa": "Initial PSA",
        "db_other_biomarkers": "Прочие биомаркеры",
        "db_progression": "Прогрессирование",
        "db_date_prog": "Дата прогрессирования",
        "db_prog_type": "Тип прогрессирования",
        "db_vital_status": "Витальный статус",
        "db_date_death": "Дата смерти",
        "db_date_last_contact": "Последний контакт",
        "db_ecog_last": "ECOG последний",
        "ECOG_статус": "ECOG",
        "МКБ 10": "МКБ-10"
    };
    const PARSER_TEXTAREA_KEYS = new Set([
        "Диагноз","Решение_консилиума","Жалобы","Анамнез_заболевания","Анамнез_жизни",
        "Описания_исследований","Сопутствующие_заболевания","db_prior_treatment",
        "db_chemo_regimen","db_other_biomarkers"
    ]);
    const PARSER_INTEGER_KEYS = new Set([
        "db_mol_subtype","db_er","db_pr","db_her2","db_ki67","db_egfr_mut","db_alk_status",
        "db_ros1_status","db_kras_mut","db_nras_mut","db_ras_mut","db_braf_mut",
        "db_idh_mut","db_brca_mut","db_ret_status","db_met_status","db_ntrk_status",
        "db_progression","db_prog_type","db_vital_status","ECOG_статус","db_ecog_last"
    ]);
    const PARSER_FLOAT_KEYS = new Set(["db_initial_psa"]);
    const PARSER_BINARY_KEYS = new Set([
        "db_egfr_mut","db_alk_status","db_ros1_status","db_kras_mut","db_nras_mut",
        "db_ras_mut","db_braf_mut","db_idh_mut","db_brca_mut","db_ret_status",
        "db_met_status","db_ntrk_status","db_progression","db_vital_status"
    ]);
    const PARSER_SELECT_OPTIONS = {
        "db_sex": ["", "М", "Ж"],
        "db_mol_subtype": ["", "1", "2", "3", "4", "5"],
        "db_progression": ["", "0", "1"],
        "db_prog_type": ["", "1", "2", "3", "4"],
        "db_vital_status": ["", "0", "1"],
        "ECOG_статус": ["", "0", "1", "2", "3", "4"],
        "db_ecog_last": ["", "0", "1", "2", "3", "4"],
        "db_msi_status": ["", "MSS", "MSI-H", "MSI-L", "MSI"],
        "db_mmr_status": ["", "pMMR", "dMMR"],
        "db_mgmt_meth": ["", "метилирован", "неметилирован"]
    };
    const PARSER_SLOT_META_KEY = "AI_Парсер_слоты_meta_json";
    const PARSER_IDENTITY_KEYS = new Set([
        "ФИО","Дата_рождения","СНИЛС","Номер_телефона","Email","db_sex"
    ]);
    const PARSER_MERGEABLE_NARRATIVE_KEYS = new Set([
        "Диагноз","Решение_консилиума","Жалобы","Анамнез_заболевания",
        "Анамнез_жизни","Описания_исследований","Сопутствующие_заболевания",
        "db_prior_treatment","db_chemo_regimen","db_other_biomarkers"
    ]);
    const PARSER_SAFE_AUTOFILL_KEYS = new Set([
        "db_surgery_type","db_rt_method","db_hormonal_drug","db_targeted_drug",
        "db_immunotherapy_drug"
    ]);
    const parserGetRiskLevel = (key) => {
        if (PARSER_IDENTITY_KEYS.has(key)) return "identity";
        if (PARSER_MERGEABLE_NARRATIVE_KEYS.has(key)) return "mergeable_narrative";
        if (PARSER_SAFE_AUTOFILL_KEYS.has(key)) return "safe_autofill";
        return "critical_clinical";
    };
    const parserGetRiskLabel = (riskLevel) => ({
        identity: "identity",
        critical_clinical: "critical clinical",
        mergeable_narrative: "mergeable narrative",
        safe_autofill: "safe autofill"
    }[riskLevel] || riskLevel || "unknown");
    const parserRequiresManualReview = (key) => parserGetRiskLevel(key) !== "safe_autofill";
    const parserGetSourceTypeScore = (label) => {
        const text = String(label || "").trim().toLowerCase();
        if (!text) return 0.65;
        if (/ручн|ревью|review/.test(text)) return 1;
        if (/диагноз документа|лаборатор|морфолог|игх|мги/.test(text)) return 0.95;
        if (/вставлен|документ|эпикриз|выписк|протокол|заключен/.test(text)) return 0.85;
        if (/пересч[её]т tnm9|tnm9/.test(text)) return 0.55;
        if (/шаблонн|regex|fallback/.test(text)) return 0.4;
        return 0.7;
    };
    const parserEscapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parserNormalizeCompareText = (value) => String(value || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const parserBuildStagePhraseRegex = (value) => new RegExp(`(?:^|[^A-Za-zА-Яа-яЁё0-9])${parserEscapeRegExp(value)}\\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)`, "i");
    const parserBuildTnmPartRegex = (key, value) => {
        const escapedValue = parserEscapeRegExp(value);
        if (key === "db_t") return new RegExp(`[cpyr]?T${escapedValue}(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
        if (key === "db_n") return new RegExp(`N${escapedValue}(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
        return new RegExp(`M${escapedValue}(?=[^A-Za-zА-Яа-яЁё0-9]|$)`, "i");
    };
    const PARSER_STAGE_PHRASE_CAPTURE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])((?:I|II|III|IV)(?:A|B|C)?)\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
    const PARSER_STAGE_PHRASE_RE = /(?:^|[^A-Za-zА-Яа-яЁё0-9])(?:I|II|III|IV)(?:A|B|C)?\s+стадия(?:[^A-Za-zА-Яа-яЁё]|$)/i;
    const parserHasExactQuoteSupport = (key, value, fragment) => {
        const text = String(fragment || "").trim();
        if (!text) return false;
        const valueText = parserValueToString(value);
        if (!valueText) return false;
        const normalizedText = parserNormalizeCompareText(text);
        const normalizedValue = parserNormalizeCompareText(valueText);
        if (!normalizedText || !normalizedValue) return false;
        if (key === "ECOG_статус" || key === "db_ecog_last") {
            return new RegExp(`(?:ECOG(?:\\s*[-/–]?\\s*PS)?|ЭКОГ|WHO\\s*PS)[^0-4]{0,24}${parserEscapeRegExp(valueText)}`, "i").test(text);
        }
        if (key === "db_stage") {
            return parserBuildStagePhraseRegex(valueText).test(text) || normalizedText.includes(normalizedValue);
        }
        if (key === "db_vital_status") {
            if (valueText === "1") return /умер|умерла|умерло|скончал(?:ся|ась)|летальн|deceased|died|dead/i.test(text);
            if (valueText === "0") return /(?:^|[^A-Za-zА-Яа-яЁё])жив(?:а|ой)?(?:[^A-Za-zА-Яа-яЁё]|$)|alive|цензур|под наблюдением|на контроле/i.test(text);
        }
        if (key === "db_t" || key === "db_n" || key === "db_m") {
            return parserBuildTnmPartRegex(key, valueText).test(text);
        }
        if (key === "Дата_рождения" || key === "db_date_dx" || key === "db_date_prog" || key === "db_date_death" || key === "db_date_last_contact") {
            return normalizedText.includes(normalizedValue);
        }
        if (PARSER_INTEGER_KEYS.has(key) || PARSER_FLOAT_KEYS.has(key) || PARSER_SELECT_OPTIONS[key]) {
            return new RegExp(`(^|[^\\d])${parserEscapeRegExp(valueText)}([^\\d]|$)`, "i").test(text) || normalizedText.includes(normalizedValue);
        }
        return normalizedText.includes(normalizedValue);
    };
    const parserNormalizeSourceDate = (raw) => {
        const value = String(raw || "").trim();
        if (!value) return "";
        const m = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
        if (!m) return "";
        const year = Number(m[1]);
        const month = m[2] ? Number(m[2]) : 0;
        const day = m[3] ? Number(m[3]) : 0;
        if (!year) return "";
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };
    const parserCompareSourceDates = (left, right) => {
        const a = parserNormalizeSourceDate(left);
        const b = parserNormalizeSourceDate(right);
        if (!a || !b) return null;
        if (a === b) return 0;
        return a > b ? 1 : -1;
    };
    const parserParseJsonSafe = (raw, fallback = {}) => {
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(String(raw));
            return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    };
    const parserGetSlotMetaMap = (getter) => parserParseJsonSafe(getter ? getter(PARSER_SLOT_META_KEY) : "", {});
    const parserGetFreshnessAssessment = ({ key, sourceDate, slotMetaMap }) => {
        const currentMeta = slotMetaMap?.[`field:${key}`] || slotMetaMap?.[key] || null;
        const currentSourceDate = currentMeta?.source_date || "";
        const cmp = parserCompareSourceDates(sourceDate, currentSourceDate);
        if (cmp === null) return { status: "unknown", note: "" };
        if (cmp < 0) return { status: "older", note: `Источник старше текущего значения (${sourceDate || "без даты"} < ${currentSourceDate || "без даты"})` };
        if (cmp > 0) return { status: "newer", note: `Источник новее текущего значения (${sourceDate || "без даты"} > ${currentSourceDate || "без даты"})` };
        return { status: "same", note: currentSourceDate ? `Источник той же даты (${currentSourceDate})` : "" };
    };
    const parserComputeAutoApproveScore = ({
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false,
        noConflict = true
    }) => (
        (((parserClampConfidence(extractConfidence) + parserClampConfidence(mergeConfidence)) / 2) * 0.55)
        + (Math.max(0, Math.min(1, Number(sourceTypeScore) || 0)) * 0.25)
        + ((exactQuoteSupport ? 1 : 0) * 0.15)
        + ((noConflict ? 1 : 0) * 0.05)
    );
    const parserCanAutoApplyField = ({
        key,
        riskLevel = parserGetRiskLevel(key),
        hasCurrent = false,
        sameAsCurrent = false,
        reviewRequired = false,
        warnings = [],
        freshnessStatus = "unknown",
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false
    }) => {
        if (!key || hasCurrent || sameAsCurrent) return false;
        if (reviewRequired || (warnings || []).length) return false;
        if (freshnessStatus === "older") return false;
        if (riskLevel !== "safe_autofill") return false;
        if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
        if (sourceTypeScore < 0.75) return false;
        return parserComputeAutoApproveScore({
            extractConfidence,
            mergeConfidence,
            sourceTypeScore,
            exactQuoteSupport,
            noConflict: !hasCurrent && !sameAsCurrent
        }) >= 0.9;
    };
    const parserCanAutoApplyLab = ({
        sameDateExists = false,
        reviewRequired = false,
        warnings = [],
        extractConfidence = 0,
        mergeConfidence = 0,
        sourceTypeScore = 0,
        exactQuoteSupport = false
    }) => {
        if (sameDateExists || reviewRequired || (warnings || []).length) return false;
        if (extractConfidence < PARSER_REVIEW_THRESHOLD || mergeConfidence < PARSER_REVIEW_THRESHOLD) return false;
        if (sourceTypeScore < 0.8) return false;
        return parserComputeAutoApproveScore({
            extractConfidence,
            mergeConfidence,
            sourceTypeScore,
            exactQuoteSupport,
            noConflict: true
        }) >= 0.88;
    };
    const PARSER_RESPONSE_SCHEMA = {
        type: "object",
        additionalProperties: false,
        properties: {
            fields: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        key: { type: "string", enum: PARSER_ALLOWED_KEYS },
                        string_value: { type: ["string", "null"] },
                        number_value: { type: ["number", "null"] },
                        extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                        merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                        evidence: { type: "string" },
                        source_label: { type: "string" },
                        source_fragment: { type: "string" },
                        source_date: { type: ["string", "null"] },
                        note: { type: ["string", "null"] },
                        review_required: { type: "boolean" }
                    },
                    required: ["key", "string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
                }
            },
            conflicts: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        key: { type: "string", enum: PARSER_ALLOWED_KEYS },
                        reason: { type: "string" },
                        suggested_index: { type: "integer", minimum: 0 },
                        options: {
                            type: "array",
                            minItems: 2,
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    string_value: { type: ["string", "null"] },
                                    number_value: { type: ["number", "null"] },
                                    extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                                    merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                                    evidence: { type: "string" },
                                    source_label: { type: "string" },
                                    source_fragment: { type: "string" },
                                    source_date: { type: ["string", "null"] },
                                    note: { type: ["string", "null"] }
                                },
                                required: ["string_value", "number_value", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note"]
                            }
                        }
                    },
                    required: ["key", "reason", "suggested_index", "options"]
                }
            },
            lab_batches: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        date: { type: "string" },
                        json_payload: { type: "string" },
                        extract_confidence: { type: "number", minimum: 0, maximum: 1 },
                        merge_confidence: { type: "number", minimum: 0, maximum: 1 },
                        evidence: { type: "string" },
                        source_label: { type: "string" },
                        source_fragment: { type: "string" },
                        source_date: { type: ["string", "null"] },
                        note: { type: ["string", "null"] },
                        review_required: { type: "boolean" }
                    },
                    required: ["date", "json_payload", "extract_confidence", "merge_confidence", "evidence", "source_label", "source_fragment", "source_date", "note", "review_required"]
                }
            },
            warnings: {
                type: "array",
                items: { type: "string" }
            }
        },
        required: ["fields", "conflicts", "lab_batches", "warnings"]
    };
    const TNM_STAGE_REVIEW_SCHEMA = {
        type: "object",
        additionalProperties: false,
        properties: {
            suggested_stage: { type: ["string", "null"] },
            updated_diagnosis: { type: ["string", "null"] },
            reason: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            review_required: { type: "boolean" }
        },
        required: ["suggested_stage", "updated_diagnosis", "reason", "confidence", "review_required"]
    };
    const PARSER_REVIEW_APPENDIX = `

    ФОРМАТ ОТВЕТА:
    1. Верни объект строго по JSON Schema.
    2. Поле fields: только извлечённые и реально найденные поля. Не добавляй поле, если оно не определялось.
    3. Для каждого элемента fields:
    - key: имя поля
    - string_value: строковое значение, если поле строковое/текстовое/дата
    - number_value: числовое значение, если поле числовое
    - extract_confidence: число от 0 до 1, насколько точно значение извлечено из документа
    - merge_confidence: число от 0 до 1, насколько безопасно объединять/записывать это значение в текущую карту
    - evidence: короткое пояснение, почему выбрано именно это значение
    - source_label: кратко укажи источник, например "вставленный документ", "диагноз документа", "лабораторный блок"
    - source_fragment: короткая дословная цитата из текста документа, на которой основан вывод
    - source_date: дата документа/события/исследования, если её можно понять
    - note: краткое пояснение или null
    - review_required: true, если есть сомнение, конфликт контекста, неполная дата или двусмысленность
    4. Поле conflicts: только реальные противоречия, которые нельзя безопасно разрешить.
    5. Поле lab_batches: по одной записи на каждую дату лабораторных данных. json_payload должен быть строкой с JSON-объектом анализов за эту дату.
    6. Если уверенность низкая, но значение всё же вероятно, верни его в fields с review_required=true.
7. Для дат соблюдай форматы:
- yyyy-MM-dd для полной даты
- yyyy-MM или yyyy для db_date_dx и db_date_prog
8. Не возвращай лишних полей.`;
    const PARSER_SYSTEM_PROMPT = `${PARSER_PROMPT}\n${PARSER_REVIEW_APPENDIX}`;
    const getParserFieldLabel = (key) => PARSER_LABELS[key] || key;
    const parseOpenRouterJsonContent = (messageContent) => {
        if (typeof messageContent === "string") return JSON.parse(messageContent);
        if (Array.isArray(messageContent)) {
            const text = messageContent.map(part => typeof part === "string" ? part : (part?.text || "")).join("").trim();
            return JSON.parse(text);
        }
        if (messageContent && typeof messageContent === "object") return messageContent;
        throw new Error("Пустой ответ модели");
    };
    const parserValueToString = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        return JSON.stringify(value, null, 2);
    };
    const parserNormalizeKey = (key) => {
        if (key === "ECOG" || key === "ecog" || key === "ECOG статус" || key === "ECOG_status") return "ECOG_статус";
        return key;
    };
    const parserValueEquals = (a, b) => {
        const sa = parserValueToString(a).replace(/\s+/g, " ").trim();
        const sb = parserValueToString(b).replace(/\s+/g, " ").trim();
        return sa === sb;
    };
    const parserClampConfidence = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(1, n));
    };
    const parserGetExtractConfidence = (item, fallback = 0) => {
        const legacy = parserClampConfidence(item?.confidence, fallback);
        return parserClampConfidence(item?.extract_confidence, legacy);
    };
    const parserGetMergeConfidence = (item, fallback = 0) => {
        const extract = parserGetExtractConfidence(item, fallback);
        return parserClampConfidence(item?.merge_confidence, extract);
    };
    const parserNormalizeSourceLabel = (value) => {
        const text = String(value || "").trim();
        return text || "Вставленный документ";
    };
    const parserNormalizeSourceFragment = (fragment, evidence = "") => {
        const text = String(fragment || "").trim();
        if (text) return text;
        return String(evidence || "").trim();
    };
    const parserMetaFromRaw = (rawItem) => {
        const extractConfidence = parserGetExtractConfidence(rawItem, 0);
        const mergeConfidence = parserGetMergeConfidence(rawItem, extractConfidence);
        return {
            extract_confidence: extractConfidence,
            merge_confidence: mergeConfidence,
            confidence: extractConfidence,
            evidence: String(rawItem?.evidence || "").trim(),
            source_label: parserNormalizeSourceLabel(rawItem?.source_label),
            source_fragment: parserNormalizeSourceFragment(rawItem?.source_fragment, rawItem?.evidence),
            source_date: rawItem?.source_date ? String(rawItem.source_date).trim() : "",
            note: rawItem?.note ? String(rawItem.note).trim() : "",
            review_required: !!rawItem?.review_required
        };
    };
    const parserNormalizeProstateTerminology = (value) => String(value || "")
        .replace(/\bАцинарная\s+аденокарцинома\b/gi, "Аденокарцинома")
        .replace(/\bАцинозная\s+аденокарцинома\b/gi, "Аденокарцинома");
    const parserCoerceValue = (key, rawValue) => {
        if (rawValue === null || rawValue === undefined || rawValue === "") return null;
        let value = rawValue;
        if (typeof value === "string") value = value.trim();
        if (key === "ECOG_статус" || key === "db_ecog_last") return normalizeEcog(value);
        if (PARSER_INTEGER_KEYS.has(key)) {
            const n = Number(String(value).replace(",", "."));
            return Number.isFinite(n) ? Math.round(n) : value;
        }
        if (PARSER_FLOAT_KEYS.has(key)) {
            const n = Number(String(value).replace(",", "."));
            return Number.isFinite(n) ? n : value;
        }
        if (key === "db_chemo_regimen") return normalizeHistoryText(value, "chemo");
        if (key === "db_prior_treatment") return normalizeHistoryText(value, "generic");
        if (key === "db_hormonal_drug" || key === "db_targeted_drug" || key === "db_immunotherapy_drug") return normalizeDrugNames(value);
        if (key === "db_other_biomarkers") return normalizeHistoryText(value, "generic");
        if (key === "db_histotype") return parserNormalizeProstateTerminology(value);
        if (key === "Диагноз") return normalizeDiagnosisText(parserNormalizeProstateTerminology(value));
        return value;
    };
    const parserValidateValue = (key, value) => {
        const warnings = [];
        let next = value;
        if (next === null || next === undefined || next === "") return { value: null, warnings };
        const s = String(next);
        const num = Number(String(next).replace(",", "."));
        const pushWarn = (msg) => warnings.push(msg);
        if (key === "Дата_рождения" || key === "db_date_death" || key === "db_date_last_contact") {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) pushWarn("Ожидался формат yyyy-MM-dd");
        }
        if (key === "db_date_dx" || key === "db_date_prog") {
            if (!/^\d{4}(?:-\d{2})?$/.test(s)) pushWarn("Ожидался формат yyyy-MM или yyyy");
        }
        if (key === "db_stage" && !/^(?:I|II|III|IV)(?:A|B|C)?$/i.test(s)) pushWarn("Необычный формат стадии");
        if (key === "db_t" && !/^(?:is|x|[0-4][a-c]?)$/i.test(s)) pushWarn("Необычный формат T");
        if (key === "db_n" && !/^(?:x|[0-3][a-c]?)$/i.test(s)) pushWarn("Необычный формат N");
        if (key === "db_m" && !/^(?:x|[01][a-c]?)$/i.test(s)) pushWarn("Необычный формат M");
        if (key === "db_er" || key === "db_pr") {
            if (!Number.isFinite(num) || num < 0 || num > 8) pushWarn("ER/PR должны быть в диапазоне 0–8");
        }
        if (key === "db_her2") {
            if (!Number.isFinite(num) || num < 0 || num > 3) pushWarn("HER2 должен быть 0–3");
        }
        if (key === "db_ki67") {
            if (!Number.isFinite(num) || num < 0 || num > 100) pushWarn("Ki67 должен быть в диапазоне 0–100");
        }
        if (key === "ECOG_статус" || key === "db_ecog_last") {
            if (!Number.isFinite(num) || num < 0 || num > 4) pushWarn("ECOG должен быть в диапазоне 0–4");
        }
        if (PARSER_BINARY_KEYS.has(key)) {
            if (!Number.isFinite(num) || ![0, 1].includes(Math.round(num))) pushWarn("Ожидалось значение 0 или 1");
            else next = Math.round(num);
        }
        if (key === "db_prog_type") {
            if (!Number.isFinite(num) || num < 1 || num > 4) pushWarn("Тип прогрессирования должен быть 1–4");
        }
        if (key === "db_mol_subtype") {
            if (!Number.isFinite(num) || num < 1 || num > 5) pushWarn("Подтип должен быть 1–5");
        }
        if (key === "db_chemo_regimen" || key === "db_prior_treatment") {
            if (/\b\d+(?:[.,]\d+)?\s*(?:мг\/м2|мг|г|мкг|мл)\b/i.test(s)) pushWarn("Обнаружены дозировки — проверьте нормализацию");
        }
        return { value: next, warnings };
    };
    const parserParseLabBatch = (batch) => {
        const raw = String(batch?.json_payload || "").trim();
        if (!raw) throw new Error("Пустой JSON лабораторных");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Лабораторные должны быть JSON-объектом");
        const clean = {};
        Object.entries(parsed).forEach(([k, v]) => {
            if (v === null || v === "") return;
            clean[k] = v;
        });
        const date = normalizeLabDateKey(batch?.date || clean.Дата);
        if (!date) throw new Error("Не удалось определить дату лабораторных");
        clean.Дата = date;
        return clean;
    };
    const runStructuredParserRequest = async ({ model, messages, schemaName, schema }) => {
        const providerCfg = _getProviderRequestConfig(model);
        const headers = { "Authorization": `Bearer ${providerCfg.key}`, "Content-Type": "application/json" };
        const basePayload = {
            model: providerCfg.modelId,
            temperature: 0,
            messages,
            provider: {
                require_parameters: true,
                data_collection: "deny"
            },
            plugins: [{ id: "response-healing" }]
        };
        const toResult = (json, responseMode, strictError = "") => {
            const content = json?.choices?.[0]?.message?.content;
            return {
                data: parseOpenRouterJsonContent(content),
                meta: {
                    model: json?.model || model,
                    parsed_at: new Date().toISOString(),
                    system_fingerprint: json?.system_fingerprint || "",
                    service_tier: json?.service_tier || "",
                    usage: json?.usage || null,
                    response_mode: responseMode,
                    strict_error: strictError,
                    source: providerCfg.providerId
                }
            };
        };

        const strictResp = await fetch(providerCfg.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...basePayload,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: schemaName,
                        strict: true,
                        schema
                    }
                }
            })
        });
        if (strictResp.ok) {
            const json = await strictResp.json();
            return toResult(json, "json_schema");
        }

        const strictErrTxt = await strictResp.text();
        const canFallback = strictResp.status >= 400 && /json_schema|response_format|schema|structured/i.test(strictErrTxt);
        if (!canFallback) throw new Error(`HTTP ${strictResp.status}: ${strictErrTxt.slice(0, 300)}`);

        const fallbackResp = await fetch(providerCfg.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...basePayload,
                response_format: { type: "json_object" }
            })
        });
        if (!fallbackResp.ok) {
            const fallbackErrTxt = await fallbackResp.text();
            throw new Error(`HTTP ${fallbackResp.status}: ${fallbackErrTxt.slice(0, 300)}`);
        }
        const fallbackJson = await fallbackResp.json();
        return toResult(fallbackJson, "json_object_fallback", strictErrTxt.slice(0, 300));
    };
    const AI_PANEL_KEY = 'pf-ai-open-' + (typeof cur !== 'undefined' && cur && cur.file ? cur.file.path : (typeof draft !== 'undefined' && draft && draft['ID_пациента'] ? 'patient-' + draft['ID_пациента'] : 'new-patient'));
    const aiWrap = modal.ownerDocument.createElement("div");
    aiWrap.style.cssText = "margin-bottom:8px; border-radius:8px; transition:box-shadow .2s ease;";

    const renderAiPanel = () => {
        aiWrap.innerHTML = "";
        const isOpen = !!window[AI_PANEL_KEY];

        // Заголовок-кнопка
        const hdr = modal.ownerDocument.createElement("button");
        hdr.style.cssText = `width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:${isOpen ? "8px 8px 0 0" : "8px"};color:var(--text-normal);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;cursor:pointer;touch-action:manipulation;transition:all .2s ease;`;
        hdr.innerHTML = `<span style="display:flex;align-items:center;gap:8px;"><span style="font-size:15px;line-height:1;">🤖</span> <span style="background:linear-gradient(90deg, ${AI_COLOR}, #b388ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AI-ПАРСЕР</span></span><span style="font-size:11px;opacity:.7;transition:transform .2s ease;transform:${isOpen ? 'rotate(180deg)' : 'none'}">▼</span>`;
        hdr.onmouseenter = () => { hdr.style.background = "var(--background-modifier-hover)"; aiWrap.style.boxShadow = `0 0 0 1px var(--interactive-accent)`; };
        hdr.onmouseleave = () => { hdr.style.background = "var(--background-primary)"; aiWrap.style.boxShadow = "none"; };
        hdr.onclick = () => { window[AI_PANEL_KEY] = !isOpen; renderAiPanel(); };
        aiWrap.appendChild(hdr);

        if (!isOpen) return;

        // Тело панели
        const body = modal.ownerDocument.createElement("div");
        body.style.cssText = `border:1px solid var(--background-modifier-border);border-top:none;border-radius:0 0 8px 8px;padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--background-primary);box-sizing:border-box;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);`;

        const hint = modal.ownerDocument.createElement("div");
        hint.style.cssText = "font-size:11px;color:var(--text-muted);line-height:1.4;";
        hint.textContent = "Вставьте неструктурированный текст — ИИ извлечёт данные, а затем откроет окно ревью перед сохранением.";
        body.appendChild(hint);

        const ta = modal.ownerDocument.createElement("textarea");
        ta.placeholder = "Вставьте выписку, направление или любой медицинский текст…";
        ta.style.cssText = "width:100%;box-sizing:border-box;min-height:100px;resize:vertical;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:16px;font-family:var(--font-interface);outline:none;transition:border-color .15s;line-height:1.4;";
        ta.onfocus = () => ta.style.borderColor = AI_COLOR;
        ta.onblur  = () => ta.style.borderColor = "var(--background-modifier-border)";
        body.appendChild(ta);

        const status = modal.ownerDocument.createElement("div");
        status.style.cssText = "font-size:12px;min-height:18px;display:none;";
        const showStatus = (msg, color) => {
            status.textContent = msg;
            status.style.color = color || "var(--text-normal)";
            status.style.display = "block";
        };
        const getDraftValue = (key) => Object.prototype.hasOwnProperty.call(ls, key) ? ls[key] : getVal(key);
        const getSuspiciousLabValues = (entries) => {
            const labRefCheck = {
                Лейкоциты: 9, Нейтрофилы: 7.7, Лимфоциты: 4.5, Эозинофилы: 0.54, Базофилы: 0.08,
                Эритроциты: 5.5, Гемоглобин: 160, Тромбоциты: 400, МНО: 1.07, АЧТВ: 36,
                ТВ: 16.6, ПТВ: 12.2, АЛТ: 40, АСТ: 40, ЩФ: 120, ГГТ: 61, Билирубин: 20.5,
                Креатинин: 115, Мочевина: 7.2, Глюкоза: 6.1
            };
            const suspicious = [];
            (entries || []).forEach(entry => {
                Object.entries(entry || {}).forEach(([k, v]) => {
                    if (k === "Дата" || typeof v !== "number") return;
                    const maxRef = labRefCheck[k];
                    if (maxRef && v > maxRef * 8) suspicious.push(`${k}=${v}`);
                });
            });
            return suspicious;
        };
        const createReviewInput = (key, initialValue, opts = {}) => {
            const doc = modal.ownerDocument;
            const textValue = parserValueToString(initialValue);
            const selectOptions = opts.forceText ? null : PARSER_SELECT_OPTIONS[key];
            let control;

            if (selectOptions) {
                control = doc.createElement("select");
                control.style.cssText = "width:100%;box-sizing:border-box;min-height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:6px 8px;font-size:13px;outline:none;";
                if (textValue && !selectOptions.includes(textValue)) {
                    const customOpt = doc.createElement("option");
                    customOpt.value = textValue;
                    customOpt.textContent = `${textValue} (введено)`;
                    control.appendChild(customOpt);
                }
                selectOptions.forEach(optValue => {
                    const opt = doc.createElement("option");
                    opt.value = optValue;
                    opt.textContent = optValue || "—";
                    control.appendChild(opt);
                });
                control.value = textValue;
            } else if (PARSER_TEXTAREA_KEYS.has(key) || opts.multiline) {
                control = doc.createElement("textarea");
                control.value = textValue;
                control.rows = opts.rows || 4;
                control.style.cssText = "width:100%;box-sizing:border-box;min-height:86px;resize:vertical;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:8px 10px;font-size:13px;line-height:1.45;outline:none;";
                if (typeof autoGrow === "function") autoGrow(control);
            } else {
                control = doc.createElement("input");
                control.type = "text";
                control.value = textValue;
                control.style.cssText = "width:100%;box-sizing:border-box;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;";
            }
            control.placeholder = opts.placeholder || "";
            control.onfocus = () => { control.style.borderColor = AI_COLOR; };
            control.onblur = () => { control.style.borderColor = "var(--background-modifier-border)"; };

            return {
                el: control,
                setValue: (value) => {
                    control.value = parserValueToString(value);
                    if (control.tagName === "TEXTAREA" && typeof autoGrow === "function") autoGrow(control);
                },
                getValue: () => {
                    const raw = typeof control.value === "string" ? control.value.trim() : control.value;
                    if (opts.raw) return raw;
                    return parserCoerceValue(key, raw);
                }
            };
        };
        const askFioMismatchApproval = (docFio) => new Promise(resolve => {
            const _ov = modal.ownerDocument.createElement("div");
            _ov.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:100;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const _box = modal.ownerDocument.createElement("div");
            _box.style.cssText = "background:var(--background-primary);border:2px solid #e53935;border-radius:12px;padding:20px 24px;box-shadow:0 10px 40px rgba(0,0,0,0.4);max-width:480px;width:90%;display:flex;flex-direction:column;gap:14px;";
            const _hdr = modal.ownerDocument.createElement("div");
            _hdr.style.cssText = "display:flex;align-items:flex-start;gap:10px;";
            _hdr.innerHTML = `<span style="font-size:28px;line-height:1;flex-shrink:0;">⚠️</span><div><div style="font-weight:700;font-size:15px;color:#e53935;">ФИО не совпадает!</div><div style="font-size:12px;color:var(--text-muted);margin-top:3px;">Возможно, документ относится к другому пациенту</div></div>`;
            const _info = modal.ownerDocument.createElement("div");
            _info.style.cssText = "background:var(--background-secondary);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:13px;";
            _info.innerHTML = `<div><span style="color:var(--text-muted);">В карте:</span> <strong style="color:var(--text-normal);">${escapeHtml(String(getStoredVal("ФИО") || ""))}</strong></div><div><span style="color:var(--text-muted);">В документе:</span> <strong style="color:#e53935;">${escapeHtml(String(docFio || ""))}</strong></div>`;
            const _btns = modal.ownerDocument.createElement("div");
            _btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";
            const _cancelBtn = modal.ownerDocument.createElement("button");
            _cancelBtn.textContent = "Отмена";
            _cancelBtn.style.cssText = "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;";
            const _applyBtn = modal.ownerDocument.createElement("button");
            _applyBtn.textContent = "Продолжить с ревью";
            _applyBtn.style.cssText = "padding:8px 16px;border:none;border-radius:6px;background:#e53935;color:#fff;cursor:pointer;font-size:13px;font-weight:600;";
            _cancelBtn.onclick = () => { _ov.remove(); resolve(false); };
            _applyBtn.onclick = () => { _ov.remove(); resolve(true); };
            _btns.appendChild(_cancelBtn);
            _btns.appendChild(_applyBtn);
            _box.appendChild(_hdr);
            _box.appendChild(_info);
            _box.appendChild(_btns);
            _ov.appendChild(_box);
            modal.appendChild(_ov);
        });
        const askParserRetryOrFallback = ({ primaryModel, fallbackModel, errorText, isEmptyResult = false }) => new Promise(resolve => {
            const _ov = modal.ownerDocument.createElement("div");
            _ov.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.56);z-index:105;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const _box = modal.ownerDocument.createElement("div");
            _box.style.cssText = "background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.35);max-width:680px;width:94%;display:flex;flex-direction:column;gap:12px;";

            const _title = modal.ownerDocument.createElement("div");
            _title.style.cssText = "font-weight:700;font-size:15px;color:#ef6c00;";
            _title.textContent = isEmptyResult
                ? `Ответ от ${primaryModel} получился неполным`
                : `Ошибка запроса к ${primaryModel}`;

            const _desc = modal.ownerDocument.createElement("div");
            _desc.style.cssText = "font-size:12px;color:var(--text-muted);line-height:1.5;";
            _desc.textContent = isEmptyResult
                ? "Модель вернула почти пустой структурированный результат. Выберите, что сделать дальше."
                : "Похоже, большой запрос не прошёл. Можно повторить этот же запрос или перейти на резервную модель.";

            const _err = modal.ownerDocument.createElement("div");
            _err.style.cssText = "max-height:180px;overflow:auto;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.45;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;";
            _err.textContent = String(errorText || "Подробности не получены").slice(0, 2500);

            const _btns = modal.ownerDocument.createElement("div");
            _btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";

            const _cancelBtn = modal.ownerDocument.createElement("button");
            _cancelBtn.textContent = "Отмена";
            _cancelBtn.style.cssText = "padding:8px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;";
            _cancelBtn.onclick = () => { _ov.remove(); resolve("cancel"); };

            const _retryBtn = modal.ownerDocument.createElement("button");
            _retryBtn.textContent = "Попробовать ещё раз";
            _retryBtn.style.cssText = "padding:8px 14px;border:1px solid var(--interactive-accent);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:13px;";
            _retryBtn.onclick = () => { _ov.remove(); resolve("retry"); };

            const _fallbackBtn = modal.ownerDocument.createElement("button");
            _fallbackBtn.textContent = `Использовать ${fallbackModel}`;
            _fallbackBtn.style.cssText = "padding:8px 14px;border:none;border-radius:6px;background:#ef6c00;color:#fff;cursor:pointer;font-size:13px;font-weight:600;";
            _fallbackBtn.onclick = () => { _ov.remove(); resolve("fallback"); };

            _btns.appendChild(_cancelBtn);
            _btns.appendChild(_retryBtn);
            _btns.appendChild(_fallbackBtn);
            _box.appendChild(_title);
            _box.appendChild(_desc);
            _box.appendChild(_err);
            _box.appendChild(_btns);
            _ov.appendChild(_box);
            modal.appendChild(_ov);
        });
        const prepareParserReviewPayload = (payload, sourceText, meta) => {
            let warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean).map(v => String(v).trim()).filter(Boolean) : [];
            if (meta?.response_mode === "json_object_fallback") warnings.unshift("Строгая JSON Schema недоступна у текущего роутинга, использован резервный режим json_object.");
            if (meta?.strict_error) warnings.push(`Причина резервного режима: ${meta.strict_error}`);
            const slotMetaMap = parserGetSlotMetaMap(getDraftValue);

            const groupedFields = new Map();
            let fields = [];
            let conflicts = [];
            const labs = [];
            let policyTrace = [];
            const scoreSlot = (item) => (parserGetExtractConfidence(item) * 0.7) + (parserGetMergeConfidence(item) * 0.3);
            const pushField = (rawItem) => {
                const key = parserNormalizeKey(rawItem?.key || "");
                if (!PARSER_ALLOWED_KEYS.includes(key)) return;
                const candidate = rawItem?.string_value !== null && rawItem?.string_value !== undefined && rawItem?.string_value !== "" ? rawItem.string_value : rawItem?.number_value;
                const validated = parserValidateValue(key, parserCoerceValue(key, candidate));
                if (validated.value === null || validated.value === undefined || validated.value === "") return;
                if (!groupedFields.has(key)) groupedFields.set(key, []);
                groupedFields.get(key).push({
                    key,
                    value: validated.value,
                    ...parserMetaFromRaw(rawItem),
                    warnings: validated.warnings
                });
            };
            (payload?.fields || []).forEach(pushField);

            groupedFields.forEach((items, key) => {
                const currentValue = getDraftValue(key);
                const hasCurrent = !(currentValue === null || currentValue === undefined || currentValue === "");
                if (items.length === 1 || items.every(item => parserValueEquals(items[0].value, item.value))) {
                    const best = items.reduce((acc, item) => scoreSlot(item) > scoreSlot(acc) ? item : acc, items[0]);
                    const sameAsCurrent = hasCurrent && parserValueEquals(currentValue, best.value);
                    const riskLevel = parserGetRiskLevel(key);
                    const freshness = parserGetFreshnessAssessment({ key, sourceDate: best.source_date, slotMetaMap });
                    const sourceTypeScore = parserGetSourceTypeScore(best.source_label);
                    const exactQuoteSupport = parserHasExactQuoteSupport(key, best.value, best.source_fragment);
                    const itemWarnings = [...new Set(items.flatMap(item => item.warnings))];
                    if (hasCurrent && !sameAsCurrent) itemWarnings.unshift("В карте уже есть другое значение");
                    if (freshness.status === "older" && freshness.note) itemWarnings.unshift(freshness.note);
                    const reviewRequired = !!best.review_required || parserRequiresManualReview(key) || freshness.status === "older";
                    const autoApplyScore = parserComputeAutoApproveScore({
                        extractConfidence: best.extract_confidence,
                        mergeConfidence: best.merge_confidence,
                        sourceTypeScore,
                        exactQuoteSupport,
                        noConflict: !hasCurrent && !sameAsCurrent
                    });
                    fields.push({
                        ...best,
                        risk_level: riskLevel,
                        source_type_score: sourceTypeScore,
                        exact_quote_support: exactQuoteSupport,
                        freshness_status: freshness.status,
                        freshness_note: freshness.note || "",
                        auto_apply_score: autoApplyScore,
                        review_required: reviewRequired,
                        current_value: hasCurrent ? currentValue : null,
                        same_as_current: sameAsCurrent,
                        warnings: [...new Set(itemWarnings)],
                        auto_apply: parserCanAutoApplyField({
                            key,
                            riskLevel,
                            hasCurrent,
                            sameAsCurrent,
                            reviewRequired,
                            warnings: itemWarnings,
                            freshnessStatus: freshness.status,
                            extractConfidence: best.extract_confidence,
                            mergeConfidence: best.merge_confidence,
                            sourceTypeScore,
                            exactQuoteSupport
                        })
                    });
                    return;
                }
                const suggestedIndex = items.reduce((bestIdx, item, idx, arr) => scoreSlot(item) > scoreSlot(arr[bestIdx]) ? idx : bestIdx, 0);
                conflicts.push({
                    key,
                    risk_level: parserGetRiskLevel(key),
                    reason: "Модель вернула несколько разных значений для одного поля",
                    suggested_index: suggestedIndex,
                    current_value: hasCurrent ? currentValue : null,
                    options: items.map(item => ({
                        value: item.value,
                        extract_confidence: item.extract_confidence,
                        merge_confidence: item.merge_confidence,
                        confidence: item.extract_confidence,
                        evidence: item.evidence,
                        source_label: item.source_label,
                        source_fragment: item.source_fragment,
                        source_date: item.source_date,
                        note: item.note,
                        warnings: item.warnings,
                        risk_level: parserGetRiskLevel(key),
                        source_type_score: parserGetSourceTypeScore(item.source_label),
                        exact_quote_support: parserHasExactQuoteSupport(key, item.value, item.source_fragment)
                    }))
                });
            });

            (payload?.conflicts || []).forEach(conflict => {
                const key = parserNormalizeKey(conflict?.key || "");
                if (!PARSER_ALLOWED_KEYS.includes(key)) return;
                const options = (conflict?.options || []).map(opt => {
                    const candidate = opt?.string_value !== null && opt?.string_value !== undefined && opt?.string_value !== "" ? opt.string_value : opt?.number_value;
                    const validated = parserValidateValue(key, parserCoerceValue(key, candidate));
                    const freshness = parserGetFreshnessAssessment({ key, sourceDate: opt?.source_date, slotMetaMap });
                    return {
                        value: validated.value,
                        ...parserMetaFromRaw(opt),
                        warnings: [...new Set([...(validated.warnings || []), ...(freshness.status === "older" && freshness.note ? [freshness.note] : [])])],
                        freshness_status: freshness.status,
                        freshness_note: freshness.note || "",
                        risk_level: parserGetRiskLevel(key),
                        source_type_score: parserGetSourceTypeScore(opt?.source_label),
                        exact_quote_support: parserHasExactQuoteSupport(key, validated.value, opt?.source_fragment)
                    };
                }).filter(opt => opt.value !== null && opt.value !== undefined && opt.value !== "");
                if (options.length < 2) return;
                conflicts.push({
                    key,
                    risk_level: parserGetRiskLevel(key),
                    reason: String(conflict?.reason || "Найдены разные значения").trim(),
                    suggested_index: Number.isFinite(Number(conflict?.suggested_index)) ? Math.min(Math.max(Number(conflict.suggested_index), 0), options.length - 1) : 0,
                    current_value: (() => {
                        const currentValue = getDraftValue(key);
                        return currentValue === null || currentValue === undefined || currentValue === "" ? null : currentValue;
                    })(),
                    options
                });
            });

            (payload?.lab_batches || []).forEach((batch, idx) => {
                const date = normalizeLabDateKey(batch?.date);
                const itemWarnings = [];
                try {
                    const parsed = parserParseLabBatch(batch);
                    itemWarnings.push(...getSuspiciousLabValues([parsed]).map(msg => `Подозрительное значение: ${msg}`));
                } catch (err) {
                    itemWarnings.push(err.message);
                }
                const existingLabs = Array.isArray(getDraftValue("Лабораторные")) ? getDraftValue("Лабораторные") : [];
                const sameDateExists = !!date && existingLabs.some(entry => normalizeLabDateKey(entry?.Дата) === date);
                const batchMeta = parserMetaFromRaw(batch);
                const sourceTypeScore = parserGetSourceTypeScore(batchMeta.source_label);
                const exactQuoteSupport = !!String(batchMeta.source_fragment || batchMeta.evidence || "").trim();
                const autoApplyScore = parserComputeAutoApproveScore({
                    extractConfidence: batchMeta.extract_confidence,
                    mergeConfidence: batchMeta.merge_confidence,
                    sourceTypeScore,
                    exactQuoteSupport,
                    noConflict: !sameDateExists
                });
                labs.push({
                    key: `lab_${idx}`,
                    date: date || String(batch?.date || ""),
                    json_payload: String(batch?.json_payload || "").trim(),
                    ...batchMeta,
                    risk_level: "critical_clinical",
                    source_type_score: sourceTypeScore,
                    exact_quote_support: exactQuoteSupport,
                    auto_apply_score: autoApplyScore,
                    review_required: !!batchMeta.review_required,
                    warnings: [...new Set(itemWarnings)],
                    same_date_exists: sameDateExists,
                    auto_apply: parserCanAutoApplyLab({
                        sameDateExists,
                        reviewRequired: !!batchMeta.review_required,
                        warnings: itemWarnings,
                        extractConfidence: batchMeta.extract_confidence,
                        mergeConfidence: batchMeta.merge_confidence,
                        sourceTypeScore,
                        exactQuoteSupport
                    })
                });
            });

            const hasFieldKey = (key) => fields.some(item => item.key === key) || conflicts.some(item => item.key === key);
            const diagnosisCandidate = (() => {
                const direct = fields.find(item => item.key === "Диагноз" && !item.same_as_current)?.value
                    || fields.find(item => item.key === "Диагноз")?.value;
                if (direct) return String(direct);
                const conflict = conflicts.find(item => item.key === "Диагноз");
                return conflict ? String(conflict.options[Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1)]?.value || "") : "";
            })();
            const diagnosisSummary = extractDiagnosisTnmStage(diagnosisCandidate);
            [
                ["db_t", diagnosisSummary.tVal],
                ["db_n", diagnosisSummary.nVal],
                ["db_m", diagnosisSummary.mVal],
                ["db_stage", diagnosisSummary.stage]
            ].forEach(([key, value]) => {
                if (!value || hasFieldKey(key)) return;
                const currentValue = getDraftValue(key);
                const hasCurrent = !(currentValue === null || currentValue === undefined || currentValue === "");
                const sameAsCurrent = hasCurrent && parserValueEquals(currentValue, value);
                const itemWarnings = [];
                if (hasCurrent && !sameAsCurrent) itemWarnings.push("В карте уже есть другое значение");
                const riskLevel = parserGetRiskLevel(key);
                const sourceTypeScore = parserGetSourceTypeScore("Диагноз документа");
                const exactQuoteSupport = parserHasExactQuoteSupport(key, value, diagnosisSummary.firstLine || diagnosisCandidate);
                fields.push({
                    key,
                    value,
                    extract_confidence: 0.995,
                    merge_confidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                    confidence: 0.995,
                    evidence: "Извлечено из первой строки структурированного диагноза",
                    source_label: "Диагноз документа",
                    source_fragment: diagnosisSummary.firstLine || diagnosisCandidate,
                    source_date: "",
                    note: "Автодополнение полей TNM/стадии по сформированному диагнозу",
                    review_required: parserRequiresManualReview(key),
                    risk_level: riskLevel,
                    source_type_score: sourceTypeScore,
                    exact_quote_support: exactQuoteSupport,
                    freshness_status: "unknown",
                    freshness_note: "",
                    auto_apply_score: parserComputeAutoApproveScore({
                        extractConfidence: 0.995,
                        mergeConfidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                        sourceTypeScore,
                        exactQuoteSupport,
                        noConflict: !hasCurrent && !sameAsCurrent
                    }),
                    current_value: hasCurrent ? currentValue : null,
                    same_as_current: sameAsCurrent,
                    warnings: itemWarnings,
                    auto_apply: parserCanAutoApplyField({
                        key,
                        riskLevel,
                        hasCurrent,
                        sameAsCurrent,
                        reviewRequired: parserRequiresManualReview(key),
                        warnings: itemWarnings,
                        freshnessStatus: "unknown",
                        extractConfidence: 0.995,
                        mergeConfidence: hasCurrent && !sameAsCurrent ? 0.25 : 0.995,
                        sourceTypeScore,
                        exactQuoteSupport
                    })
                });
            });

            const hasEcog = fields.some(item => item.key === "ECOG_статус") || conflicts.some(item => item.key === "ECOG_статус");
            if (!hasEcog) {
                const currentEcog = getDraftValue("ECOG_статус");
                if (currentEcog === null || currentEcog === undefined || currentEcog === "") {
                    const ecogMatch = matchEcogInText(sourceText);
                    if (ecogMatch && ecogMatch.value !== null) {
                        fields.push({
                            key: "ECOG_статус",
                            value: ecogMatch.value,
                            extract_confidence: 0.55,
                            merge_confidence: 0.55,
                            confidence: 0.55,
                            evidence: ecogMatch.fragment || "ECOG извлечён шаблонным поиском",
                            source_label: "Шаблонный поиск",
                            source_fragment: ecogMatch.fragment || "",
                            source_date: "",
                            note: "Добавлено резервным шаблонным поиском",
                            review_required: true,
                            risk_level: parserGetRiskLevel("ECOG_статус"),
                            source_type_score: parserGetSourceTypeScore("Шаблонный поиск"),
                            exact_quote_support: true,
                            freshness_status: "unknown",
                            freshness_note: "",
                            auto_apply_score: parserComputeAutoApproveScore({
                                extractConfidence: 0.55,
                                mergeConfidence: 0.55,
                                sourceTypeScore: parserGetSourceTypeScore("Шаблонный поиск"),
                                exactQuoteSupport: true,
                                noConflict: true
                            }),
                            current_value: null,
                            same_as_current: false,
                            warnings: ["Проверьте вручную: значение получено шаблонным поиском"],
                            auto_apply: false
                        });
                    }
                }
            }

            const getResolvedValue = (key) => {
                const direct = fields.find(item => item.key === key && !item.same_as_current)?.value
                    ?? fields.find(item => item.key === key)?.value;
                if (direct !== null && direct !== undefined && direct !== "") return direct;
                const conflict = conflicts.find(item => item.key === key);
                if (conflict?.options?.length) {
                    const idx = Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1);
                    const conflictValue = conflict.options[idx]?.value;
                    if (conflictValue !== null && conflictValue !== undefined && conflictValue !== "") return conflictValue;
                }
                const currentValue = getDraftValue(key);
                return currentValue ?? "";
            };
            const prostateContext = [
                sourceText,
                parserValueToString(getResolvedValue("Диагноз")),
                parserValueToString(getResolvedValue("db_tumor_location")),
                parserValueToString(getResolvedValue("db_histotype"))
            ].join("\n");
            if (/предстат|простаты|prostate/i.test(prostateContext)) {
                const resolvedT = String(getResolvedValue("db_t") || "").trim();
                const resolvedN = String(getResolvedValue("db_n") || "").trim();
                const resolvedM = String(getResolvedValue("db_m") || "").trim();
                const resolvedStage = String(getResolvedValue("db_stage") || "").trim();
                const resolvedGleason = String(getResolvedValue("db_gleason") || "").trim();
                const resolvedPsa = String(getResolvedValue("db_initial_psa") || "").trim();
                const resolvedDiagnosis = String(getResolvedValue("Диагноз") || "").trim();
                const firstDiagLine = resolvedDiagnosis.split("\n").map(line => line.trim()).find(Boolean) || resolvedDiagnosis;
                const hasPrefixedTnm = /\b[cpyr]T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i.test(firstDiagLine);
                const hasGleasonMention = /gleason|глисон/i.test(String(sourceText || ""));
                const hasPsaMention = /(?:^|[^a-zа-яё])(psa|пса)(?:[^a-zа-яё]|$)/i.test(String(sourceText || ""));
                if (!(resolvedT && resolvedN && resolvedM)) warnings.push("Простата: обязательны T, N и M. Проверьте, что все три поля заполнены.");
                if ((resolvedT || resolvedN || resolvedM) && !resolvedStage) warnings.push("Простата: при наличии TNM проверьте и явно укажите стадию.");
                if (resolvedT && !hasPrefixedTnm) warnings.push("Простата: в диагнозе проверьте префикс стадирования c/p/y/r перед T.");
                if (hasGleasonMention && !resolvedGleason) warnings.push("Простата: в тексте упомянут Gleason, но поле db_gleason не заполнено.");
                if (hasPsaMention && !resolvedPsa) warnings.push("Простата: в тексте упомянут PSA, но поле db_initial_psa не заполнено.");
            }

            const historicalGuard = parserApplyHistoricalStageGuard({
                fields,
                conflicts,
                warnings,
                sourceText,
                getCurrentValue: getDraftValue
            });
            fields = historicalGuard.fields;
            conflicts = historicalGuard.conflicts;
            warnings = [...new Set(historicalGuard.warnings || warnings)];
            policyTrace = [...(historicalGuard.policy_trace || [])];

            return { warnings: [...new Set(warnings)], fields, conflicts, labs, policy_trace: policyTrace };
        };
        const upsertSelectedField = (items, key, value, extra = {}) => {
            const next = Array.isArray(items) ? [...items] : [];
            const idx = next.findIndex(item => item?.key === key);
            if (value === null || value === undefined || value === "") {
                if (idx >= 0) next.splice(idx, 1);
                return next;
            }
            if (idx >= 0) next[idx] = { ...next[idx], key, value, ...extra };
            else next.push({ key, value, ...extra });
            return next;
        };
        const extractDiagnosisTnmStage = (diagnosisText) => {
            const text = String(diagnosisText || "").trim();
            const firstLine = text.split("\n").map(line => line.trim()).find(Boolean) || text;
            const compactTnm = firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))\s*N([0-3X][a-c]?)\s*M([01X][a-c]?)/i);
            const tFull = compactTnm?.[1] || firstLine.match(/([cpyr]?T(?:is|[0-4X][a-c]?))(?=N|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const tPrefix = tFull.match(/^([cpyr]?)/i)?.[1] || "";
            const tVal = tFull ? tFull.replace(/^[cpyr]?T/i, "") : "";
            const nVal = compactTnm?.[2] || firstLine.match(/N([0-3X][a-c]?)(?=M|[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const mVal = compactTnm?.[3] || firstLine.match(/M([01X][a-c]?)(?=[^A-Za-zА-Яа-яЁё0-9]|$)/i)?.[1] || "";
            const stage = firstLine.match(PARSER_STAGE_PHRASE_CAPTURE_RE)?.[1] || "";
            return { firstLine, tPrefix, tVal, nVal, mVal, stage };
        };
        const patchDiagnosisTnmStage = (diagnosisText, nextState) => {
            const text = String(diagnosisText || "").trim();
            if (!text) return "";
            const lines = text.split("\n");
            const firstIdx = lines.findIndex(line => String(line).trim());
            if (firstIdx < 0) return text;
            let firstLine = String(lines[firstIdx] || "").trim();
            const prefix = nextState?.prefix ?? extractDiagnosisTnmStage(firstLine).tPrefix ?? "c";
            const tnmParts = [];
            if (nextState?.t) tnmParts.push(`${prefix}T${nextState.t}`);
            if (nextState?.n) tnmParts.push(`N${nextState.n}`);
            if (nextState?.m) tnmParts.push(`M${nextState.m}`);
            const nextTnm = tnmParts.join("");
            if (nextTnm) {
                if (/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i.test(firstLine)) {
                    firstLine = firstLine.replace(/\b[cpyr]?T(?:is|[0-4X][a-c]?)[^.\n,;]*N(?:[0-3X][a-c]?)[^.\n,;]*M(?:[01X][a-c]?)\b/i, nextTnm);
                } else if (/,?\s*G[1-4]\b/i.test(firstLine)) {
                    firstLine = firstLine.replace(/,?\s*G[1-4]\b/i, `, ${nextTnm}, $&`.replace(", ,", ","));
                } else {
                    firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextTnm}`;
                }
            }
            if (nextState?.stage) {
                if (PARSER_STAGE_PHRASE_RE.test(firstLine)) {
                    firstLine = firstLine.replace(PARSER_STAGE_PHRASE_RE, match => match.replace(/(?:I|II|III|IV)(?:A|B|C)?/i, `${nextState.stage}`));
                } else {
                    firstLine = `${firstLine.replace(/\.+$/, "")}, ${nextState.stage} стадия`;
                }
            }
            lines[firstIdx] = firstLine;
            return lines.join("\n");
        };
        const parserHasTreatmentEvidence = (text) => /(?:^|[^A-Za-zА-Яа-яЁё])(?:ПХТ|МХТ|ХТ|ЛТ|ДЛТ|ХЛТ|АДТ)(?:[^A-Za-zА-Яа-яЁё]|$)|лучев[а-я\s-]*терап|брахитерап|стереотакс|операц|резекц|лобэктом|лимфодиссекц|мастэктом|биопси|гормонотерап|таргетн|иммунотерап|дегареликс|гозерелин|тамоксифен|летрозол|палбоциклиб|осимертиниб|гефитиниб|капецитабин|цисплатин|карбоплатин|паклитаксел|folfox|folfiri|folfirinox/i.test(String(text || ""));
        const parserHasProgressionEvidence = (text) => /(?:прогрессир|прогрессия|прогрессирование|отдал[её]нн[а-я\s-]*метаст|метастаз[а-я\s-]*в|множественн[а-я\s-]*метаст|новые\s+метаст|дистанционн[а-я\s-]*метаст)/i.test(String(text || ""));
        const parserPreserveInitialDiagnosisLine = (currentDiagnosis, incomingDiagnosis) => {
            const currentParts = splitDiagnosisSentences(currentDiagnosis);
            const incomingParts = splitDiagnosisSentences(incomingDiagnosis);
            if (!currentParts.length) return buildDiagnosisText(incomingParts);
            if (!incomingParts.length) return buildDiagnosisText(currentParts);
            const currentSplit = splitDiagnosisHeadAndEvents(currentParts);
            const incomingSplit = splitDiagnosisHeadAndEvents(incomingParts);
            const header = currentSplit.head.length ? currentSplit.head : currentParts.slice(0, 1);
            const mergedEvents = mergeDistinctSegments(currentSplit.events, incomingSplit.events)
                .map((part, index) => ({ part, index, stamp: diagnosisEventStamp(part) ?? Number.MAX_SAFE_INTEGER }))
                .sort((left, right) => left.stamp === right.stamp ? left.index - right.index : left.stamp - right.stamp)
                .map(item => item.part);
            return buildDiagnosisText([...header, ...mergedEvents]);
        };
        const parserShouldKeepHistoricalStage = ({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText }) => {
            const hasCurrentStage = !!String(currentState?.stage || currentState?.t || currentState?.n || currentState?.m || "").trim();
            if (!hasCurrentStage) return false;
            const changed = ["t", "n", "m", "stage"].some(key => !parserValueEquals(proposedState?.[key], currentState?.[key]));
            if (!changed) return false;
            const treatmentStarted = !!String(getStoredVal("Дата_начала_лечения") || "").trim()
                || parserHasTreatmentEvidence(currentDiagnosis)
                || parserHasTreatmentEvidence(proposedDiagnosis)
                || parserHasTreatmentEvidence(sourceText)
                || !!String(getStoredVal("db_prior_treatment") || "").trim()
                || !!String(getStoredVal("db_chemo_regimen") || "").trim();
            const progressionMentioned = parserHasProgressionEvidence(sourceText)
                || parserHasProgressionEvidence(proposedDiagnosis)
                || parserHasProgressionEvidence(currentDiagnosis)
                || Number(getStoredVal("db_progression")) === 1;
            return treatmentStarted && progressionMentioned;
        };
        const parserApplyHistoricalStageGuard = ({ fields, conflicts, warnings, sourceText, getCurrentValue }) => {
            const currentDiagnosis = String(getCurrentValue("Диагноз") || "");
            const currentState = {
                t: String(getCurrentValue("db_t") || extractDiagnosisTnmStage(currentDiagnosis).tVal || ""),
                n: String(getCurrentValue("db_n") || extractDiagnosisTnmStage(currentDiagnosis).nVal || ""),
                m: String(getCurrentValue("db_m") || extractDiagnosisTnmStage(currentDiagnosis).mVal || ""),
                stage: String(getCurrentValue("db_stage") || extractDiagnosisTnmStage(currentDiagnosis).stage || "")
            };
            const diagnosisField = fields.find(item => item.key === "Диагноз");
            const proposedDiagnosis = String(diagnosisField?.value || "");
            const proposedState = {
                t: String(fields.find(item => item.key === "db_t")?.value || currentState.t || ""),
                n: String(fields.find(item => item.key === "db_n")?.value || currentState.n || ""),
                m: String(fields.find(item => item.key === "db_m")?.value || currentState.m || ""),
                stage: String(fields.find(item => item.key === "db_stage")?.value || currentState.stage || "")
            };
            if (!parserShouldKeepHistoricalStage({ currentState, proposedState, currentDiagnosis, proposedDiagnosis, sourceText })) {
                return { fields, conflicts, warnings, policy_trace: [] };
            }
            const stageKeys = new Set(["db_t", "db_n", "db_m", "db_stage"]);
            const nextWarnings = [...new Set([...(warnings || []), "Историческое стадирование сохранено: после начала лечения и прогрессирования парсер не рестадирует диагноз, а оставляет исходные TNM/стадию."])];
            const nextFields = (fields || []).map(item => {
                if (!item?.key) return item;
                if (stageKeys.has(item.key)) {
                    const currentValue = currentState[item.key === "db_stage" ? "stage" : item.key.replace("db_", "")];
                    if (currentValue && !parserValueEquals(item.value, currentValue)) return null;
                    return item;
                }
                if (item.key === "Диагноз" && currentDiagnosis) {
                    return {
                        ...item,
                        value: parserPreserveInitialDiagnosisLine(currentDiagnosis, item.value),
                        note: [item.note, "Историческая преамбула диагноза сохранена из исходного стадирования."].filter(Boolean).join(" "),
                        warnings: [...new Set([...(item.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
                    };
                }
                return item;
            }).filter(Boolean);
            const nextConflicts = (conflicts || []).map(conflict => {
                if (!conflict?.key) return conflict;
                if (stageKeys.has(conflict.key)) return null;
                if (conflict.key === "Диагноз" && currentDiagnosis) {
                    return {
                        ...conflict,
                        options: (conflict.options || []).map(opt => ({
                            ...opt,
                            value: parserPreserveInitialDiagnosisLine(currentDiagnosis, opt.value),
                            warnings: [...new Set([...(opt.warnings || []), "Историческая преамбула диагноза сохранена без рестадирования"])]
                        }))
                    };
                }
                return conflict;
            }).filter(Boolean);
            return {
                fields: nextFields,
                conflicts: nextConflicts,
                warnings: nextWarnings,
                policy_trace: [{
                    type: "historical_stage_guard",
                    action: "preserve_initial_stage",
                    reason: "После начала лечения и прогрессирования стадия/TNM остаются историческими, прогрессирование отражается отдельно.",
                    current_state: currentState,
                    blocked_keys: ["db_t", "db_n", "db_m", "db_stage"]
                }]
            };
        };
        const runTnmStageSuggestion = async ({ model, payload }) => {
            const prompt = [
                "Ты медицинский ассистент по онкологическому стадированию.",
                "Нужно после подтверждённого изменения T/N/M предложить обновление стадии по TNM9 и текста поля \"Диагноз\".",
                "Правила:",
                "- Используй только данные из переданного JSON.",
                "- Не придумывай лечение, даты, исследования и маркеры.",
                "- Онкологическая стадия и TNM фиксируются только на момент первичного стадирования. Если после лечения описано прогрессирование или появление отдалённых метастазов, не рестадируй диагноз в IV стадию задним числом.",
                "- Если меняешь \"Диагноз\", максимально сохрани существующий текст лечения, меняй только фрагменты TNM/стадии и связанные с этим формулировки.",
                "- suggested_stage должен содержать только значение стадии, например IIIA или IV.",
                "- Если стадия по TNM9 не определяется надёжно, верни suggested_stage=null и review_required=true.",
                "- updated_diagnosis верни только если можешь уверенно обновить диагноз без потери клинической информации.",
                "- Для опухолей простаты учитывай Gleason и PSA, если они даны.",
                "- Ничего не выдумывай."
            ].join("\n");
            return runStructuredParserRequest({
                model,
                schemaName: "tnm_stage_review",
                schema: TNM_STAGE_REVIEW_SCHEMA,
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: JSON.stringify(payload, null, 2) }
                ]
            });
        };
        const applyInlineTnmStageSuggestion = async ({ reviewPayload, rawText, model }) => {
            const selectedMap = Object.fromEntries((reviewPayload?.fields || []).map(item => [item.key, item.value]));
            const changedKeys = ["db_t", "db_n", "db_m", "db_stage"].filter(key => Object.prototype.hasOwnProperty.call(selectedMap, key) && !parserValueEquals(selectedMap[key], getStoredVal(key)));
            if (!changedKeys.length) return reviewPayload;

            const currentDiagnosis = String(getStoredVal("Диагноз") || "");
            const selectedDiagnosis = String(selectedMap["Диагноз"] ?? currentDiagnosis);
            const diagSummary = extractDiagnosisTnmStage(currentDiagnosis);
            const selectedDiagSummary = extractDiagnosisTnmStage(selectedDiagnosis);
            const currentState = {
                t: String(getStoredVal("db_t") || diagSummary.tVal || ""),
                n: String(getStoredVal("db_n") || diagSummary.nVal || ""),
                m: String(getStoredVal("db_m") || diagSummary.mVal || ""),
                stage: String(getStoredVal("db_stage") || diagSummary.stage || ""),
                prefix: String(diagSummary.tPrefix || "c"),
                diagnosis: currentDiagnosis
            };
            const proposedState = {
                t: String(selectedMap["db_t"] ?? currentState.t ?? selectedDiagSummary.tVal ?? ""),
                n: String(selectedMap["db_n"] ?? currentState.n ?? selectedDiagSummary.nVal ?? ""),
                m: String(selectedMap["db_m"] ?? currentState.m ?? selectedDiagSummary.mVal ?? ""),
                stage: String(selectedMap["db_stage"] ?? currentState.stage ?? selectedDiagSummary.stage ?? ""),
                prefix: String(selectedDiagSummary.tPrefix || currentState.prefix || "c"),
                diagnosis: selectedDiagnosis
            };

            let suggestion = { suggested_stage: proposedState.stage || null, updated_diagnosis: proposedState.diagnosis || null, reason: "Изменены значения TNM/стадии.", confidence: 0, review_required: true };
            const suggestionPayload = {
                tumor_location: selectedMap["db_tumor_location"] ?? getStoredVal("db_tumor_location") ?? "",
                histotype: selectedMap["db_histotype"] ?? getStoredVal("db_histotype") ?? "",
                icd10: selectedMap["МКБ 10"] ?? getStoredVal("МКБ 10") ?? "",
                sex: selectedMap["db_sex"] ?? getStoredVal("db_sex") ?? "",
                grade: selectedMap["db_grade"] ?? getStoredVal("db_grade") ?? "",
                gleason: selectedMap["db_gleason"] ?? getStoredVal("db_gleason") ?? "",
                initial_psa: selectedMap["db_initial_psa"] ?? getStoredVal("db_initial_psa") ?? "",
                markers: {
                    er: selectedMap["db_er"] ?? getStoredVal("db_er") ?? "",
                    pr: selectedMap["db_pr"] ?? getStoredVal("db_pr") ?? "",
                    her2: selectedMap["db_her2"] ?? getStoredVal("db_her2") ?? "",
                    ki67: selectedMap["db_ki67"] ?? getStoredVal("db_ki67") ?? "",
                    pdl1: selectedMap["db_pdl1"] ?? getStoredVal("db_pdl1") ?? "",
                    msi: selectedMap["db_msi_status"] ?? getStoredVal("db_msi_status") ?? ""
                },
                current_state: currentState,
                proposed_state: proposedState,
                source_excerpt: String(rawText || "").slice(0, 12000)
            };
            try {
                const tnmResp = await runTnmStageSuggestion({ model, payload: suggestionPayload });
                suggestion = tnmResp?.data || suggestion;
            } catch (err) {
                return {
                    ...reviewPayload,
                    warnings: [...new Set([...(reviewPayload.warnings || []), `Не удалось автоматически подготовить пересчёт TNM9: ${err.message}`])]
                };
            }

            const fallbackDiagnosis = patchDiagnosisTnmStage(proposedState.diagnosis || currentState.diagnosis, {
                t: proposedState.t,
                n: proposedState.n,
                m: proposedState.m,
                stage: suggestion?.suggested_stage || proposedState.stage || currentState.stage || "",
                prefix: proposedState.prefix || currentState.prefix || "c"
            });
            const confidence = parserClampConfidence(suggestion?.confidence, suggestion?.review_required ? 0.75 : 0.9);
            const commonMeta = {
                evidence: suggestion?.reason || "Пересчёт TNM9 после изменения T/N/M/стадии",
                source_label: "Пересчёт TNM9",
                source_fragment: suggestion?.updated_diagnosis || fallbackDiagnosis || proposedState.diagnosis || "",
                source_date: "",
                extract_confidence: confidence,
                merge_confidence: confidence,
                confidence,
                auto_apply: confidence >= 0.999 && !suggestion?.review_required,
                review_required: !!suggestion?.review_required,
                warnings: suggestion?.review_required ? ["Проверьте пересчёт TNM9 перед сохранением"] : []
            };
            const nextFields = upsertSelectedField(
                upsertSelectedField(reviewPayload.fields, "db_stage", suggestion?.suggested_stage || proposedState.stage || currentState.stage || "", {
                    ...commonMeta,
                    note: "Строка добавлена в общее ревью после пересчёта TNM9"
                }),
                "Диагноз",
                suggestion?.updated_diagnosis || fallbackDiagnosis || proposedState.diagnosis || currentState.diagnosis || "",
                {
                    ...commonMeta,
                    note: "Диагноз синхронизирован с выбранными T/N/M/стадией в общем ревью"
                }
            );
            return {
                ...reviewPayload,
                fields: nextFields,
                warnings: [...new Set([...(reviewPayload.warnings || []), "Пересчёт TNM9 добавлен в основное окно ревью одной из строк."])],
                tnm_stage_trace: {
                    action: "inline_tnm9_recalculation",
                    reason: suggestion?.reason || "Стадия и диагноз пересчитаны перед общим ревью.",
                    current_state: currentState,
                    proposed_state: proposedState,
                    suggested_stage: suggestion?.suggested_stage || "",
                    suggested_diagnosis: suggestion?.updated_diagnosis || fallbackDiagnosis || ""
                }
            };
        };
        const showParserReviewModal = ({ warnings, fields, conflicts, labs, meta }) => new Promise(resolve => {
            const doc = modal.ownerDocument;
            const overlay = doc.createElement("div");
            overlay.style.cssText = "position:absolute;inset:0;background:rgba(0,0,0,0.56);z-index:110;display:flex;align-items:center;justify-content:center;border-radius:inherit;";
            const box = doc.createElement("div");
            box.style.cssText = "background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:14px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,0.35);width:min(980px,96%);max-height:90%;display:flex;flex-direction:column;gap:12px;";
            const mk = (tag, css, text) => { const el = doc.createElement(tag); if (css) el.style.cssText = css; if (text !== undefined) el.textContent = text; return el; };
            const addLine = (parent, text, color = "var(--text-muted)") => { if (!text) return; const el = mk("div", `font-size:11px;color:${color};line-height:1.45;white-space:pre-wrap;word-break:break-word;`, text); parent.appendChild(el); };
            const addBlock = (parent, title, value, muted = false) => {
                if (value === null || value === undefined || value === "") return;
                const wrap = mk("div", `width:100%;box-sizing:border-box;border:1px solid var(--background-modifier-border);border-radius:8px;padding:8px 10px;background:${muted ? "var(--background-secondary)" : "var(--background-primary)"};`);
                wrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);margin-bottom:4px;", title));
                wrap.appendChild(mk("div", "font-size:12px;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;line-height:1.45;", value));
                parent.appendChild(wrap);
            };
            const badge = (text, bg, color) => { const el = mk("span", `display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;white-space:nowrap;`, text); return el; };
            const fmtPct = (value) => `${Math.round(parserClampConfidence(value) * 100)}%`;
            const confidenceTone = (value) => parserClampConfidence(value) >= PARSER_REVIEW_THRESHOLD
                ? { bg: "#e3f2fd", color: "#1565c0" }
                : { bg: "#fff3e0", color: "#ef6c00" };
            const appendConfidenceBadges = (parent, item) => {
                const extractTone = confidenceTone(item?.extract_confidence);
                const mergeTone = confidenceTone(item?.merge_confidence);
                parent.appendChild(badge(`извлечение ${fmtPct(item?.extract_confidence)}`, extractTone.bg, extractTone.color));
                parent.appendChild(badge(`слияние ${fmtPct(item?.merge_confidence)}`, mergeTone.bg, mergeTone.color));
            };
            const appendSourceBlocks = (parent, item) => {
                addLine(parent, item?.source_label ? `Источник: ${item.source_label}` : "");
                addLine(parent, item?.source_date ? `Дата документа/источника: ${item.source_date}` : "");
                addBlock(parent, "Фрагмент текста", item?.source_fragment || "", true);
                addLine(parent, item?.evidence ? `Обоснование: ${item.evidence}` : "");
            };
            const buildManualSelection = (key, value, currentValue, noteText) => ({
                key,
                value,
                current_value: currentValue ?? null,
                extract_confidence: 1,
                merge_confidence: 1,
                confidence: 1,
                evidence: "Значение изменено вручную в окне ревью",
                source_label: "Ручная корректировка в ревью",
                source_fragment: "",
                source_date: "",
                note: noteText || "Значение введено вручную пользователем",
                review_required: false,
                warnings: []
            });
            const parserMergeValue = (key, currentValue, nextValue) => {
                const currentText = parserValueToString(currentValue).trim();
                const nextText = parserValueToString(nextValue).trim();
                if (!currentText) return nextText;
                if (!nextText || parserValueEquals(currentText, nextText)) return currentText;
                const parts = `${currentText}\n${nextText}`
                    .split(/\n+/g)
                    .map(part => part.trim())
                    .filter(Boolean);
                return Array.from(new Set(parts)).join("\n");
            };
            const parserReviewGroupOrder = [
                { id: "identity", title: "Идентификация", test: key => ["ФИО", "Дата_рождения", "db_sex", "Номер_телефона", "СНИЛС"].includes(key) },
                { id: "diagnosis", title: "Диагноз/TNM", test: key => key === "Диагноз" || key === "МКБ 10" || /^db_(?:t|n|m|stage|tumor_location|histotype|grade|gleason|initial_psa|er|pr|her2|ki67|pdl1|msi_status|other_biomarkers)/.test(key) },
                { id: "treatment", title: "Лечение", test: key => key === "Решение_консилиума" || /^db_(?:chemo|rt|surgery|prior_treatment|progression|date_dx|date_last_contact)/.test(key) },
                { id: "labs", title: "Анализы", test: key => key === "__lab__" },
                { id: "admin", title: "Административное", test: () => true }
            ];
            const getParserReviewGroup = (key) => parserReviewGroupOrder.find(group => group.test(key)) || parserReviewGroupOrder[parserReviewGroupOrder.length - 1];
            const appendReviewGroup = (parent, title, nodes) => {
                if (!nodes.length) return;
                parent.appendChild(mk("div", "font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0;margin:8px 0 -4px;", title));
                nodes.forEach(node => parent.appendChild(node));
            };
            const appendGroupedReviewNodes = (parent, entries) => {
                parserReviewGroupOrder.forEach(group => appendReviewGroup(
                    parent,
                    group.title,
                    entries.filter(entry => entry.groupId === group.id).map(entry => entry.node)
                ));
            };

            const header = mk("div", "display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;");
            const titleWrap = mk("div");
            titleWrap.appendChild(mk("div", "font-size:18px;font-weight:700;color:var(--text-normal);", "Ревью парсинга"));
            titleWrap.appendChild(mk("div", "font-size:12px;color:var(--text-muted);margin-top:3px;line-height:1.45;", `Модель: ${meta?.model || DEFAULT_MODEL} · полей: ${fields.length} · конфликтов: ${conflicts.length} · лабораторий: ${labs.length}`));
            header.appendChild(titleWrap);
            const hdrBadges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
            if (warnings.length) hdrBadges.appendChild(badge(`предупреждения: ${warnings.length}`, "#fff3e0", "#ef6c00"));
            if (conflicts.length) hdrBadges.appendChild(badge(`конфликты: ${conflicts.length}`, "#ffebee", "#c62828"));
            hdrBadges.appendChild(badge("финальная запись", "#e3f2fd", "#1565c0"));
            header.appendChild(hdrBadges);
            box.appendChild(header);

            if (warnings.length) {
                const warnBox = mk("div", "border:1px solid #ffcc80;background:#fff8e1;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;");
                warnBox.appendChild(mk("div", "font-size:12px;font-weight:700;color:#ef6c00;", "Предупреждения парсера"));
                warnings.forEach(msg => addLine(warnBox, `• ${msg}`, "#8d6e63"));
                box.appendChild(warnBox);
            }

            const errorBox = mk("div", "display:none;border:1px solid #ef9a9a;background:#ffebee;color:#c62828;border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.45;");
            box.appendChild(errorBox);

            const scroll = mk("div", "overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px;");
            const fieldCtrls = [];
            const conflictCtrls = [];
            const labCtrls = [];
            const applyBoxes = [];
            const decisionTrace = { fields: [], conflicts: [], labs: [] };
            const isFullConfidenceAutoField = (item) => parserClampConfidence(item?.extract_confidence) >= 0.999
                && parserClampConfidence(item?.merge_confidence) >= 0.999;
            const isFullConfidenceAutoLab = (item) => parserClampConfidence(item?.extract_confidence) >= 0.999
                && parserClampConfidence(item?.merge_confidence) >= 0.999;
            const isHiddenAutoField = (item) => isFullConfidenceAutoField(item);
            const isHiddenAutoLab = (item) => isFullConfidenceAutoLab(item);
            const renderFieldCard = (item) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", getParserFieldLabel(item.key)));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                appendConfidenceBadges(badges, item);
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                if (item.review_required || item.warnings.length) badges.appendChild(badge("проверить", "#fff3e0", "#ef6c00"));
                if (parserRequiresManualReview(item.key)) badges.appendChild(badge("ручной апрув", "#f3e5f5", "#8e24aa"));
                if (item.same_as_current) badges.appendChild(badge("уже в карте", "#eceff1", "#546e7a"));
                if (isHiddenAutoField(item)) badges.appendChild(badge("100% автоподтверждение", "#e8f5e9", "#2e7d32"));
                top.appendChild(badges);
                card.appendChild(top);
                const input = createReviewInput(item.key, item.value);
                const preview = mk("div", "display:grid;grid-template-columns:1fr;gap:8px;width:100%;");
                addBlock(preview, "Было", parserValueToString(item.current_value), true);
                addBlock(preview, "Станет", parserValueToString(item.value), false);
                card.appendChild(preview);
                const inputWrap = mk("div", "display:flex;flex-direction:column;gap:6px;");
                inputWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Новое значение"));
                inputWrap.appendChild(input.el);
                card.appendChild(inputWrap);
                const actionRow = mk("div", "display:flex;gap:6px;flex-wrap:wrap;");
                const mkAction = (text, onClick) => {
                    const btn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", text);
                    btn.onclick = onClick;
                    actionRow.appendChild(btn);
                };
                appendSourceBlocks(card, item);
                addLine(card, item.freshness_note ? `Свежесть источника: ${item.freshness_note}` : "");
                addLine(card, item.exact_quote_support ? "Точная цитата подтверждает значение." : "Точная цитата не подтверждена.");
                addLine(card, item.note ? `Пояснение: ${item.note}` : "");
                item.warnings.forEach(msg => addLine(card, `Предупреждение: ${msg}`, "#ef6c00"));
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = !!(item.auto_apply || isFullConfidenceAutoField(item));
                applyBoxes.push(applyBox);
                mkAction("Оставить старое", () => { applyBox.checked = false; input.setValue?.(item.current_value ?? ""); });
                mkAction("Принять новое", () => { applyBox.checked = true; input.setValue?.(item.value ?? ""); });
                if (PARSER_TEXTAREA_KEYS.has(item.key)) {
                    mkAction("Объединить", () => {
                        applyBox.checked = true;
                        input.setValue?.(parserMergeValue(item.key, item.current_value, item.value));
                    });
                }
                card.appendChild(actionRow);
                applyRow.appendChild(applyBox);
                applyRow.appendChild(mk("span", "", item.auto_apply ? "Применить автоматически" : "Применить это значение"));
                card.appendChild(applyRow);
                fieldCtrls.push({
                    key: item.key,
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => ({ ...item, value: input.getValue() })
                });
                return card;
            };
            const hiddenAutoFields = fields.filter(isHiddenAutoField);
            const visibleFields = fields.filter(item => !isHiddenAutoField(item));
            const hiddenAutoLabs = labs.filter(isHiddenAutoLab);
            const visibleLabs = labs.filter(item => !isHiddenAutoLab(item));
            const hiddenAutoTotal = hiddenAutoFields.length + hiddenAutoLabs.length;
            if (hiddenAutoTotal) hdrBadges.appendChild(badge(`автоподтверждено: ${hiddenAutoTotal}`, "#e8f5e9", "#2e7d32"));

            const conflictNodes = [];
            conflicts.forEach((item, idx) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", `${getParserFieldLabel(item.key)}: конфликт`));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                badges.appendChild(badge(`${item.options.length} варианта`, "#ffebee", "#c62828"));
                badges.appendChild(badge("нужен выбор", "#fff3e0", "#ef6c00"));
                top.appendChild(badges);
                card.appendChild(top);
                addLine(card, item.reason || "Найдены разные значения", "#ef6c00");
                addBlock(card, "Текущее значение в карте", parserValueToString(item.current_value), true);
                let selectedIndex = Math.min(Math.max(Number(item.suggested_index) || 0, 0), item.options.length - 1);
                item.options.forEach((opt, optIdx) => {
                    const label = mk("label", "display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary);cursor:pointer;");
                    const radio = mk("input"); radio.type = "radio"; radio.name = `parser_conflict_${idx}`; radio.checked = optIdx === selectedIndex; radio.style.marginTop = "2px"; radio.onchange = () => { selectedIndex = optIdx; };
                    const bodyWrap = mk("div", "display:flex;flex-direction:column;gap:4px;min-width:0;");
                    bodyWrap.appendChild(mk("div", "font-size:13px;color:var(--text-normal);white-space:pre-wrap;word-break:break-word;", parserValueToString(opt.value)));
                    addLine(bodyWrap, `Извлечение: ${fmtPct(opt.extract_confidence)} · Слияние: ${fmtPct(opt.merge_confidence)}`);
                    appendSourceBlocks(bodyWrap, opt);
                    addLine(bodyWrap, opt.note ? `Пояснение: ${opt.note}` : "");
                    opt.warnings.forEach(msg => addLine(bodyWrap, `Предупреждение: ${msg}`, "#ef6c00"));
                    label.appendChild(radio); label.appendChild(bodyWrap); card.appendChild(label);
                });
                const custom = createReviewInput(item.key, "", { multiline: PARSER_TEXTAREA_KEYS.has(item.key) });
                const customWrap = mk("div", "display:flex;flex-direction:column;gap:6px;");
                customWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Или ввести своё значение"));
                customWrap.appendChild(custom.el);
                card.appendChild(customWrap);
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = false;
                applyBoxes.push(applyBox);
                const actionRow = mk("div", "display:flex;gap:6px;flex-wrap:wrap;");
                const keepOldBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Оставить старое");
                keepOldBtn.onclick = () => { applyBox.checked = false; custom.setValue?.(item.current_value ?? ""); };
                const acceptNewBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Принять новое");
                acceptNewBtn.onclick = () => { applyBox.checked = true; custom.setValue?.(""); };
                actionRow.appendChild(keepOldBtn);
                actionRow.appendChild(acceptNewBtn);
                if (PARSER_TEXTAREA_KEYS.has(item.key)) {
                    const mergeBtn = mk("button", "padding:5px 9px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:12px;", "Объединить");
                    mergeBtn.onclick = () => {
                        const selected = item.options[selectedIndex] || {};
                        applyBox.checked = true;
                        custom.setValue?.(parserMergeValue(item.key, item.current_value, selected.value));
                    };
                    actionRow.appendChild(mergeBtn);
                }
                card.appendChild(actionRow);
                applyRow.appendChild(applyBox); applyRow.appendChild(mk("span", "", "Применить выбранный вариант")); card.appendChild(applyRow);
                conflictCtrls.push({
                    key: item.key,
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => {
                        const customValue = custom.getValue();
                        if (customValue !== null && customValue !== undefined && customValue !== "") {
                            return {
                                ...buildManualSelection(item.key, customValue, item.current_value, "Пользователь вручную скорректировал конфликтное значение"),
                                selection_type: "manual",
                                rejected_candidates: (item.options || []).map((opt, optIdx) => ({
                                    index: optIdx,
                                    value: opt.value,
                                    reason: "Отклонено в ревью: пользователь ввёл своё значение"
                                }))
                            };
                        }
                        const selected = item.options[selectedIndex] || null;
                        return selected ? {
                            key: item.key,
                            current_value: item.current_value,
                            ...selected,
                            selection_type: "option",
                            selected_index: selectedIndex,
                            rejected_candidates: (item.options || []).map((opt, optIdx) => optIdx === selectedIndex ? null : ({
                                index: optIdx,
                                value: opt.value,
                                reason: `Отклонено в ревью: выбран вариант ${selectedIndex + 1}`
                            })).filter(Boolean)
                        } : null;
                    }
                });
                conflictNodes.push(card);
            });
            if (conflictNodes.length) {
                scroll.appendChild(mk("div", "font-size:12px;font-weight:800;color:#c62828;text-transform:uppercase;letter-spacing:0;margin:8px 0 -4px;", "Конфликты требуют решения"));
                conflictNodes.forEach(node => scroll.appendChild(node));
            }

            appendGroupedReviewNodes(scroll, visibleFields.map(item => ({
                groupId: getParserReviewGroup(item.key).id,
                node: renderFieldCard(item)
            })));

            const renderLabCard = (item, idx) => {
                const card = mk("div", "border:1px solid var(--background-modifier-border);border-radius:10px;padding:12px;background:var(--background-secondary);display:flex;flex-direction:column;gap:10px;");
                const top = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap;");
                top.appendChild(mk("div", "font-size:14px;font-weight:700;color:var(--text-normal);", `Лабораторные: ${item.date || `блок ${idx + 1}`}`));
                const badges = mk("div", "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;");
                appendConfidenceBadges(badges, item);
                badges.appendChild(badge(parserGetRiskLabel(item.risk_level), "#ede7f6", "#6a1b9a"));
                if (item.review_required || item.warnings.length) badges.appendChild(badge("проверить", "#fff3e0", "#ef6c00"));
                if (item.same_date_exists) badges.appendChild(badge("дата уже есть", "#eceff1", "#546e7a"));
                if (isHiddenAutoLab(item)) badges.appendChild(badge("100% автоподтверждение", "#e8f5e9", "#2e7d32"));
                top.appendChild(badges); card.appendChild(top);
                const dateInput = createReviewInput("db_date_death", item.date || "", { forceText: true, placeholder: "yyyy-MM-dd" });
                appendSourceBlocks(card, item);
                addLine(card, item.exact_quote_support ? "Есть привязка к исходному фрагменту." : "Без явной цитаты источника.");
                const dateWrap = mk("div", "display:flex;flex-direction:column;gap:6px;"); dateWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "Дата блока")); dateWrap.appendChild(dateInput.el); card.appendChild(dateWrap);
                const jsonInput = createReviewInput("db_other_biomarkers", item.json_payload, { multiline: true, rows: 8, raw: true, placeholder: "{\"Дата\":\"2026-01-01\",\"Гемоглобин\":120}" });
                const jsonWrap = mk("div", "display:flex;flex-direction:column;gap:6px;"); jsonWrap.appendChild(mk("div", "font-size:11px;color:var(--text-muted);", "JSON анализов за дату")); jsonWrap.appendChild(jsonInput.el); card.appendChild(jsonWrap);
                addLine(card, item.note ? `Пояснение: ${item.note}` : "");
                item.warnings.forEach(msg => addLine(card, `Предупреждение: ${msg}`, "#ef6c00"));
                const applyRow = mk("label", "display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-normal);cursor:pointer;");
                const applyBox = mk("input"); applyBox.type = "checkbox"; applyBox.checked = !!(item.auto_apply || isFullConfidenceAutoLab(item));
                applyBoxes.push(applyBox);
                applyRow.appendChild(applyBox); applyRow.appendChild(mk("span", "", item.auto_apply ? "Применить автоматически" : "Применить этот блок")); card.appendChild(applyRow);
                labCtrls.push({
                    item,
                    apply: () => applyBox.checked,
                    getSelection: () => ({
                        ...item,
                        batch: {
                            date: String(dateInput.getValue() || "").trim(),
                            json_payload: String(jsonInput.getValue() || "").trim()
                        }
                    })
                });
                return card;
            };

            appendGroupedReviewNodes(scroll, visibleLabs.map((item, idx) => ({
                groupId: "labs",
                node: renderLabCard(item, idx)
            })));

            if (hiddenAutoTotal) {
                const details = mk("details", "border:1px solid var(--background-modifier-border);border-radius:10px;background:var(--background-secondary);overflow:hidden;");
                const summary = mk("summary", "cursor:pointer;list-style:none;padding:12px 14px;font-size:13px;font-weight:700;color:var(--text-normal);display:flex;align-items:center;justify-content:space-between;gap:10px;");
                summary.appendChild(mk("span", "", `Автоподтверждённые слоты (${hiddenAutoTotal})`));
                summary.appendChild(badge("скрыто по умолчанию", "#e8f5e9", "#2e7d32"));
                details.appendChild(summary);
                const hiddenBody = mk("div", "padding:0 12px 12px;display:flex;flex-direction:column;gap:10px;");
                hiddenAutoFields.forEach(item => hiddenBody.appendChild(renderFieldCard(item)));
                hiddenAutoLabs.forEach((item, idx) => hiddenBody.appendChild(renderLabCard(item, idx)));
                details.appendChild(hiddenBody);
                details.addEventListener("toggle", () => {
                    if (!details.open) return;
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        const scrollRect = scroll.getBoundingClientRect();
                        const bodyRect = hiddenBody.getBoundingClientRect();
                        if (bodyRect.bottom > scrollRect.bottom) {
                            scroll.scrollTo({
                                top: scroll.scrollTop + (bodyRect.bottom - scrollRect.bottom) + 12,
                                behavior: "smooth"
                            });
                        } else if (bodyRect.top < scrollRect.top) {
                            scroll.scrollTo({
                                top: Math.max(0, scroll.scrollTop - (scrollRect.top - bodyRect.top) - 12),
                                behavior: "smooth"
                            });
                        }
                    }));
                });
                scroll.appendChild(details);
            }

            if (!fields.length && !conflicts.length && !labs.length) scroll.appendChild(mk("div", "border:1px dashed var(--background-modifier-border);border-radius:10px;padding:18px;text-align:center;color:var(--text-muted);font-size:13px;", "Модель не вернула структурированных данных. Можно закрыть окно и уточнить текст документа."));
            box.appendChild(scroll);

            const footer = mk("div", "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;");
            footer.appendChild(mk("div", "font-size:11px;color:var(--text-muted);line-height:1.45;", hiddenAutoTotal ? "100% автоподтверждённые слоты уже скрыты под спойлером. Это финальный экран перед записью." : "Это финальный экран перед записью в карту."));
            const btnWrap = mk("div", "display:flex;gap:8px;flex-wrap:wrap;");
            const applyAllBtn = mk("button", "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);cursor:pointer;font-size:13px;", "Применить все");
            const cancelBtn = mk("button", "padding:8px 16px;border:1px solid var(--background-modifier-border);border-radius:6px;background:none;color:var(--text-normal);cursor:pointer;font-size:13px;", "Отмена");
            const applyBtn = mk("button", `padding:8px 16px;border:none;border-radius:6px;background:${AI_COLOR};color:#fff;cursor:pointer;font-size:13px;font-weight:600;`, "Записать выбранное");
            applyAllBtn.onclick = () => { applyBoxes.forEach(box => { box.checked = true; }); };
            btnWrap.appendChild(applyAllBtn); btnWrap.appendChild(cancelBtn); btnWrap.appendChild(applyBtn); footer.appendChild(btnWrap); box.appendChild(footer);

            applyBtn.onclick = () => {
                const errors = [];
                const selectedFields = [];
                const selectedLabs = [];
                const selectedWarnings = [];
                fieldCtrls.forEach(ctrl => {
                    const selected = ctrl.getSelection();
                    if (!ctrl.apply()) {
                        decisionTrace.fields.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "skipped",
                            reason: "Поле не отмечено для применения",
                            candidate_value: ctrl.item?.value ?? null
                        });
                        return;
                    }
                    const validated = parserValidateValue(ctrl.key, selected?.value);
                    if (validated.value === null || validated.value === undefined || validated.value === "") {
                        errors.push(`Поле "${getParserFieldLabel(ctrl.key)}" отмечено, но осталось пустым.`);
                        decisionTrace.fields.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "После ревью поле осталось пустым"
                        });
                        return;
                    }
                    selectedFields.push({
                        ...selected,
                        value: validated.value,
                        warnings: [...new Set([...(selected?.warnings || []), ...validated.warnings])]
                    });
                    decisionTrace.fields.push({
                        key: ctrl.key,
                        risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                        action: "applied",
                        reason: ctrl.item?.auto_apply ? "Подтверждено из предвыбранного значения" : "Пользователь вручную подтвердил применение",
                        selected_value: validated.value
                    });
                    validated.warnings.forEach(msg => selectedWarnings.push(`${getParserFieldLabel(ctrl.key)}: ${msg}`));
                });
                conflictCtrls.forEach(ctrl => {
                    const selected = ctrl.getSelection();
                    if (!ctrl.apply()) {
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "skipped",
                            reason: "Конфликт не отмечен для применения",
                            rejected_candidates: (ctrl.item?.options || []).map((opt, optIdx) => ({
                                index: optIdx,
                                value: opt.value,
                                reason: "Конфликт оставлен без применения"
                            }))
                        });
                        return;
                    }
                    if (!selected) {
                        errors.push(`Для "${getParserFieldLabel(ctrl.key)}" не выбран вариант.`);
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "Для конфликтного поля не выбран вариант"
                        });
                        return;
                    }
                    const validated = parserValidateValue(ctrl.key, selected.value);
                    if (validated.value === null || validated.value === undefined || validated.value === "") {
                        errors.push(`Для "${getParserFieldLabel(ctrl.key)}" не выбран вариант.`);
                        decisionTrace.conflicts.push({
                            key: ctrl.key,
                            risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                            action: "error",
                            reason: "После валидации конфликтное значение оказалось пустым"
                        });
                        return;
                    }
                    selectedFields.push({
                        ...selected,
                        value: validated.value,
                        warnings: [...new Set([...(selected?.warnings || []), ...validated.warnings])]
                    });
                    decisionTrace.conflicts.push({
                        key: ctrl.key,
                        risk_level: selected?.risk_level || ctrl.item?.risk_level || parserGetRiskLevel(ctrl.key),
                        action: "applied",
                        reason: selected?.selection_type === "manual" ? "Пользователь ввёл своё значение" : `Выбран вариант ${Number(selected?.selected_index ?? 0) + 1}`,
                        selected_value: validated.value,
                        rejected_candidates: selected?.rejected_candidates || []
                    });
                    validated.warnings.forEach(msg => selectedWarnings.push(`${getParserFieldLabel(ctrl.key)}: ${msg}`));
                });
                labCtrls.forEach((ctrl, idx) => {
                    if (!ctrl.apply()) {
                        decisionTrace.labs.push({
                            key: ctrl.item?.key || `lab_${idx}`,
                            risk_level: ctrl.item?.risk_level || "critical_clinical",
                            action: "skipped",
                            reason: "Лабораторный блок не отмечен для применения",
                            date: ctrl.item?.date || ""
                        });
                        return;
                    }
                    try {
                        const selected = ctrl.getSelection();
                        const parsed = parserParseLabBatch(selected.batch);
                        const suspicious = getSuspiciousLabValues([parsed]).map(msg => `Подозрительное значение: ${msg}`);
                        selectedLabs.push({
                            ...selected,
                            date: parsed.Дата,
                            json_payload: String(selected?.batch?.json_payload || "").trim(),
                            parsed_entry: parsed,
                            warnings: [...new Set([...(selected?.warnings || []), ...suspicious])]
                        });
                        decisionTrace.labs.push({
                            key: selected?.key || `lab_${idx}`,
                            risk_level: selected?.risk_level || "critical_clinical",
                            action: "applied",
                            reason: selected?.auto_apply ? "Подтверждено из предвыбранного лабораторного блока" : "Пользователь подтвердил лабораторный блок",
                            date: parsed.Дата
                        });
                        getSuspiciousLabValues([parsed]).forEach(msg => selectedWarnings.push(`Лабораторные ${parsed.Дата}: ${msg}`));
                    } catch (err) {
                        errors.push(`Лабораторный блок ${idx + 1}: ${err.message}`);
                        decisionTrace.labs.push({
                            key: ctrl.item?.key || `lab_${idx}`,
                            risk_level: ctrl.item?.risk_level || "critical_clinical",
                            action: "error",
                            reason: err.message,
                            date: ctrl.item?.date || ""
                        });
                    }
                });
                if (errors.length) {
                    errorBox.style.display = "block";
                    errorBox.textContent = errors.join(" ");
                    return;
                }
                overlay.remove();
                resolve({
                    fields: selectedFields,
                    labs: selectedLabs,
                    warnings: [...new Set([...(warnings || []), ...selectedWarnings])],
                    decision_trace: decisionTrace
                });
            };
            cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
            overlay.appendChild(box);
            modal.appendChild(overlay);
        });
        const mergeDiagnosisText = (existingText, nextText) => {
            const splitParts = (text) => String(text || "")
                .split(/\.\s+|\n+/g)
                .map(part => part.trim().replace(/\.$/, ""))
                .filter(Boolean);
            const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const currentParts = splitParts(existingText);
            const incomingParts = splitParts(nextText);
            if (!incomingParts.length) return currentParts.length ? `${currentParts.join(". ")}.` : "";
            if (!currentParts.length) return `${incomingParts.join(". ")}.`;
            const result = [...currentParts];
            const resultNorms = result.map(normalize);
            incomingParts.forEach(part => {
                const norm = normalize(part);
                if (!norm) return;
                const idx = resultNorms.findIndex(existing => existing === norm || existing.includes(norm) || norm.includes(existing));
                if (idx < 0) {
                    result.push(part);
                    resultNorms.push(norm);
                } else if (norm.length > resultNorms[idx].length) {
                    result[idx] = part;
                    resultNorms[idx] = norm;
                }
            });
            return result.length ? `${result.join(". ")}.` : "";
        };
        const mergeTimelineText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const toLines = text => String(text).split("\n").map(line => line.trim()).filter(Boolean);
            const toStamp = line => {
                const match = line.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
                return match ? parseInt(`${match[3]}${match[2]}${match[1]}`, 10) : 0;
            };
            const existingLines = toLines(currentText);
            const normalized = new Set(existingLines.map(line => line.replace(/\s+/g, " ").toLowerCase()));
            const toAdd = toLines(incomingText).filter(line => !normalized.has(line.replace(/\s+/g, " ").toLowerCase()));
            return toAdd.length ? [...existingLines, ...toAdd].sort((a, b) => toStamp(a) - toStamp(b)).join("\n") : currentText;
        };
        const mergeDistinctParagraphText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const currentNorm = normalize(currentText);
            const incomingNorm = normalize(incomingText);
            if (!currentNorm) return incomingText;
            if (!incomingNorm) return currentText;
            if (currentNorm === incomingNorm || currentNorm.includes(incomingNorm)) return currentText;
            if (incomingNorm.includes(currentNorm)) return incomingText;
            const splitBlocks = (text) => String(text).split(/\n{2,}|\n/).map(part => part.trim()).filter(Boolean);
            const existingBlocks = splitBlocks(currentText);
            const existingNorms = existingBlocks.map(normalize);
            const toAdd = splitBlocks(incomingText).filter(block => {
                const norm = normalize(block);
                if (!norm) return false;
                return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
            });
            return toAdd.length ? [...existingBlocks, ...toAdd].join("\n") : (incomingNorm.length > currentNorm.length ? incomingText : currentText);
        };
        const mergeDistinctListText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const splitItems = (text) => String(text)
                .split(/\n|;|●/g)
                .map(item => item.trim())
                .filter(Boolean);
            const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const existingItems = splitItems(currentText);
            const existingNorms = existingItems.map(normalize);
            const toAdd = splitItems(incomingText).filter(item => {
                const norm = normalize(item);
                if (!norm) return false;
                return !existingNorms.some(existingNorm => existingNorm === norm || existingNorm.includes(norm) || norm.includes(existingNorm));
            });
            return toAdd.length ? [...existingItems, ...toAdd].join("\n") : currentText;
        };
        const mergePhoneText = (existingText, nextText) => {
            const currentText = String(existingText || "").trim();
            const incomingText = String(nextText || "").trim();
            if (!incomingText) return currentText;
            if (!currentText) return incomingText;
            const normalizePhone = value => String(value || "").replace(/\D/g, "");
            const existingPhones = currentText.split(" / ").map(part => part.trim()).filter(Boolean);
            const existingNorms = new Set(existingPhones.map(normalizePhone));
            const incomingPhones = incomingText.split(/[,;]|\s+\/\s+|\//).map(part => part.trim()).filter(Boolean);
            const toAdd = incomingPhones.filter(phone => phone && !existingNorms.has(normalizePhone(phone)));
            return toAdd.length ? [...existingPhones, ...toAdd].join(" / ") : currentText;
        };
            const mergeLabEntries = (incomingEntries) => {
                const existing = Array.isArray(getDraftValue("Лабораторные")) ? [...getDraftValue("Лабораторные")] : [];
                const newDates = [];
                const mergedDates = [];
                const suspicious = [];
                incomingEntries.forEach(entry => {
                    const sourceEntry = entry?.parsed_entry ? entry.parsed_entry : entry;
                    const nextDate = normalizeLabDateKey(sourceEntry?.Дата);
                    if (!nextDate) return;
                    const cleanEntry = { ...sourceEntry, Дата: nextDate };
                    suspicious.push(...getSuspiciousLabValues([cleanEntry]));
                    const idx = existing.findIndex(item => normalizeLabDateKey(item?.Дата) === nextDate);
                    if (idx >= 0) {
                        existing[idx] = { ...existing[idx], ...cleanEntry };
                        mergedDates.push(nextDate);
                    } else {
                        existing.push(cleanEntry);
                        newDates.push(nextDate);
                    }
                });
            const normalizedEntries = existing
                .map(entry => ({ ...entry, Дата: normalizeLabDateKey(entry?.Дата) }))
                .sort((a, b) => normalizeLabDateKey(b?.Дата).localeCompare(normalizeLabDateKey(a?.Дата)));
            return {
                entries: normalizedEntries,
                summary: { newDates, mergedDates },
                warning: suspicious.length ? `Подозрительные значения лабораторных: ${[...new Set(suspicious)].join(", ")}` : ""
            };
        };
        const buildParserSavePlan = ({ fields, labs }) => {
            const updates = {};
            const changeEntries = [];
            const slotTrace = [];
            const planField = (item) => {
                const key = item?.key;
                const value = item?.value;
                if (!key || value === null || value === undefined || value === "") return;
                const currentValue = getDraftValue(key);
                let finalValue = value;
                let changeType = "replace";
                if (key === "Анамнез_заболевания" || key === "Описания_исследований") {
                    finalValue = mergeTimelineText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Диагноз") {
                    finalValue = mergeDiagnosisText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Решение_консилиума" || key === "Анамнез_жизни") {
                    finalValue = mergeDistinctParagraphText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Сопутствующие_заболевания") {
                    finalValue = mergeDistinctListText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else if (key === "Номер_телефона") {
                    finalValue = mergePhoneText(currentValue, value);
                    changeType = currentValue ? (parserValueEquals(finalValue, currentValue) ? "same" : "merge") : "add";
                } else {
                    if (currentValue === null || currentValue === undefined || currentValue === "") changeType = "add";
                    else if (parserValueEquals(currentValue, value)) changeType = "same";
                    else changeType = "replace";
                }
                slotTrace.push({
                    kind: "field",
                    ...item,
                    current_value: currentValue ?? null,
                    final_value: finalValue,
                    change_type: changeType
                });
                if (changeType !== "same" && !parserValueEquals(currentValue, finalValue)) {
                    updates[key] = finalValue;
                    changeEntries.push({
                        kind: "field",
                        key,
                        label: getParserFieldLabel(key),
                        risk_level: item?.risk_level || parserGetRiskLevel(key),
                        current_value: currentValue ?? null,
                        incoming_value: value,
                        final_value: finalValue,
                        change_type: changeType,
                        source_label: item?.source_label || "",
                        source_fragment: item?.source_fragment || "",
                        source_date: item?.source_date || "",
                        freshness_status: item?.freshness_status || "",
                        exact_quote_support: !!item?.exact_quote_support,
                        warnings: item?.warnings || []
                    });
                }
            };
            (fields || []).forEach(planField);

            if ((labs || []).length) {
                const existingLabs = Array.isArray(getDraftValue("Лабораторные")) ? getDraftValue("Лабораторные") : [];
                const labResult = mergeLabEntries(labs);
                updates["Лабораторные"] = labResult.entries;
                updates._labSummary = labResult.summary;
                if (labResult.warning) updates._labWarning = labResult.warning;
                (labs || []).forEach(item => {
                    const parsedEntry = item?.parsed_entry ? item.parsed_entry : null;
                    const date = normalizeLabDateKey(item?.date || parsedEntry?.Дата);
                    const currentEntry = date ? existingLabs.find(entry => normalizeLabDateKey(entry?.Дата) === date) || null : null;
                    const changeType = currentEntry ? "lab_merge" : "lab_add";
                    slotTrace.push({
                        kind: "lab",
                        ...item,
                        current_value: currentEntry,
                        final_value: parsedEntry,
                        change_type: changeType
                    });
                    changeEntries.push({
                        kind: "lab",
                        key: "Лабораторные",
                        label: `Лабораторные: ${date || item?.date || "без даты"}`,
                        risk_level: item?.risk_level || "critical_clinical",
                        current_value: currentEntry,
                        incoming_value: parsedEntry,
                        final_value: parsedEntry,
                        change_type: changeType,
                        source_label: item?.source_label || "",
                        source_fragment: item?.source_fragment || "",
                        source_date: item?.source_date || date || "",
                        freshness_status: item?.freshness_status || "",
                        exact_quote_support: !!item?.exact_quote_support,
                        warnings: item?.warnings || []
                    });
                });
            }

            return {
                updates,
                clinicalKeys: Object.keys(updates).filter(key => !key.startsWith("_")),
                changeEntries,
                slotTrace
            };
        };
        const finalizeParserSave = async ({ fields, labs, warnings, meta, review_trace, savePlan }) => {
            const planned = savePlan || buildParserSavePlan({ fields, labs });
            const updates = { ...(planned?.updates || {}) };
            const assignValue = (key, value) => {
                ls[key] = value;
                updates[key] = value;
            };
            Object.entries(updates).forEach(([key, value]) => {
                if (!String(key).startsWith("_")) ls[key] = value;
            });

            const clinicalKeys = Array.isArray(planned?.clinicalKeys)
                ? planned.clinicalKeys
                : Object.keys(updates).filter(key => !key.startsWith("_"));
            if (!clinicalKeys.length) {
                showStatus("ℹ️ Вы ничего не выбрали для сохранения", "#1565c0");
                return;
            }

            const parserWarnings = [...new Set([...(warnings || []), updates._labWarning].filter(Boolean))];
            const nextSlotMeta = { ...parserGetSlotMetaMap(getVal) };
            (planned?.slotTrace || []).forEach(slot => {
                if (slot?.kind === "field" && slot?.key && slot.change_type !== "same" && !String(slot.key).startsWith("AI_")) {
                    nextSlotMeta[`field:${slot.key}`] = {
                        kind: "field",
                        key: slot.key,
                        source_date: slot.source_date || "",
                        parsed_at: meta?.parsed_at || "",
                        risk_level: slot.risk_level || parserGetRiskLevel(slot.key),
                        source_label: slot.source_label || "",
                        final_value: parserValueToString(slot.final_value),
                        freshness_status: slot.freshness_status || "",
                        exact_quote_support: !!slot.exact_quote_support
                    };
                }
                if (slot?.kind === "lab") {
                    const labDate = normalizeLabDateKey(slot?.final_value?.Дата || slot?.date);
                    if (!labDate) return;
                    nextSlotMeta[`lab:${labDate}`] = {
                        kind: "lab",
                        date: labDate,
                        source_date: slot.source_date || labDate,
                        parsed_at: meta?.parsed_at || "",
                        source_label: slot.source_label || "",
                        risk_level: slot.risk_level || "critical_clinical"
                    };
                }
            });
            const parserMeta = {
                "AI_Парсер_модель": meta?.model || (localStorage.getItem(MODEL_LS) || DEFAULT_MODEL),
                "AI_Парсер_версия_промпта": PARSER_PROMPT_VERSION,
                "AI_Парсер_дата": meta?.parsed_at || new Date().toISOString(),
                "AI_Парсер_источник": meta?.source || "openrouter",
                "AI_Парсер_service_tier": meta?.service_tier || "",
                "AI_Парсер_system_fingerprint": meta?.system_fingerprint || "",
                "AI_Парсер_usage_json": meta?.usage ? JSON.stringify(meta.usage) : "",
                "AI_Парсер_предупреждения": parserWarnings.join(" | "),
                "AI_Парсер_ревью_json": review_trace ? JSON.stringify(review_trace) : "",
                "AI_Парсер_слоты_json": planned?.slotTrace ? JSON.stringify(planned.slotTrace) : "",
                "AI_Парсер_diff_json": planned?.changeEntries ? JSON.stringify(planned.changeEntries) : "",
                [PARSER_SLOT_META_KEY]: JSON.stringify(nextSlotMeta)
            };
            Object.entries(parserMeta).forEach(([key, value]) => assignValue(key, value));

            await saveNow(Object.fromEntries(Object.entries(updates).filter(([key]) => !key.startsWith("_"))));

            if (!getVal("ID_пациента") && getVal("ФИО") && getVal("Дата_рождения")) {
                await ensureCurrentPatientId();
            }

            const savedClinicalKeys = clinicalKeys.filter(key => !String(key).startsWith("AI_Парсер_"));
            let message = `✅ Сохранено ${savedClinicalKeys.length} ${savedClinicalKeys.length === 1 ? "поле" : savedClinicalKeys.length < 5 ? "поля" : "полей"}`;
            if (getVal("ID_пациента")) message += ` · ID: ${getVal("ID_пациента")}`;
            if (updates._labSummary) {
                if (updates._labSummary.newDates.length) message += ` · новые анализы: ${updates._labSummary.newDates.join(", ")}`;
                if (updates._labSummary.mergedDates.length) message += ` · объединены даты: ${updates._labSummary.mergedDates.join(", ")}`;
            }
            if (parserWarnings.length) message += ` · предупреждений: ${parserWarnings.length}`;
            showStatus(message, parserWarnings.length ? "#f57c00" : "#2e7d32");
            setTimeout(() => { buildForm(); }, 300);
        };

        const showConflictsModal = (conflicts, onComplete) => {
            const _cov = modal.ownerDocument.createElement('div');
            _cov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);z-index:90;display:flex;align-items:center;justify-content:center;border-radius:inherit;';
            const _cbox = modal.ownerDocument.createElement('div');
            _cbox.style.cssText = 'background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,0.3);max-width:600px;width:92%;max-height:85%;display:flex;flex-direction:column;gap:12px;';
            
            const _chdr = modal.ownerDocument.createElement('div');
            _chdr.style.cssText = 'font-weight:700;font-size:16px;color:var(--text-normal);margin-bottom:8px;';
            _chdr.textContent = '⚠️ Найдены конфликты в данных';
            
            const _desc = modal.ownerDocument.createElement('div');
            _desc.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:4px;';
            _desc.textContent = 'Для некоторых полей найдены разные данные в тексте. Выберите правильный вариант:';
            
            const _scroll = modal.ownerDocument.createElement('div');
            _scroll.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px;padding-right:8px;';
            
            const results = {};
            conflicts.forEach(c => {
                const _cw = modal.ownerDocument.createElement('div');
                _cw.style.cssText = 'border:1px solid var(--background-modifier-border);border-radius:8px;padding:10px;background:var(--background-secondary);';
                const _ctitle = modal.ownerDocument.createElement('div');
                _ctitle.style.cssText = 'font-weight:700;font-size:13px;color:var(--text-accent);margin-bottom:8px;';
                _ctitle.textContent = c.key;
                _cw.appendChild(_ctitle);
                
                let selIdx = 0;
                c.options.forEach((opt, i) => {
                    const _lbl = modal.ownerDocument.createElement('label');
                    _lbl.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer;font-size:13px;color:var(--text-normal);background:var(--background-primary);border:1px solid var(--background-modifier-border);padding:8px;border-radius:6px;transition:border-color 0.2s;';
                    _lbl.onmouseenter = () => _lbl.style.borderColor = 'var(--interactive-accent)';
                    _lbl.onmouseleave = () => { if (selIdx !== i) _lbl.style.borderColor = 'var(--background-modifier-border)'; };
                    
                    const _rad = modal.ownerDocument.createElement('input');
                    _rad.type = 'radio';
                    _rad.name = 'conf_' + c.key;
                    _rad.value = i;
                    _rad.style.marginTop = '2px';
                    if (i === 0) { _rad.checked = true; _lbl.style.borderColor = 'var(--interactive-accent)'; }
                    _rad.onchange = () => { 
                        selIdx = i;
                        Array.from(_cw.querySelectorAll('label')).forEach(l => l.style.borderColor = 'var(--background-modifier-border)');
                        _lbl.style.borderColor = 'var(--interactive-accent)';
                    };
                    
                    const _txt = modal.ownerDocument.createElement('div');
                    _txt.style.cssText = 'word-break:break-word;line-height:1.45;white-space:pre-wrap;';
                    _txt.textContent = opt;
                    
                    _lbl.appendChild(_rad); _lbl.appendChild(_txt);
                    _cw.appendChild(_lbl);
                });
                
                results[c.key] = () => c.options[selIdx];
                _scroll.appendChild(_cw);
            });
            
            const _btnRow = modal.ownerDocument.createElement('div');
            _btnRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px;';
            const _saveBtn = modal.ownerDocument.createElement('button');
            _saveBtn.textContent = 'Сохранить выбранное';
            _saveBtn.style.cssText = `padding:8px 16px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;`;
            _saveBtn.onmouseenter = () => _saveBtn.style.opacity = '0.85';
            _saveBtn.onmouseleave = () => _saveBtn.style.opacity = '1';
            _saveBtn.onclick = () => {
                const finalRes = {};
                for (const k in results) finalRes[k] = results[k]();
                _cov.remove();
                onComplete(finalRes);
            };
            
            _btnRow.appendChild(_saveBtn);
            _cbox.appendChild(_chdr); _cbox.appendChild(_desc); _cbox.appendChild(_scroll); _cbox.appendChild(_btnRow);
            _cov.appendChild(_cbox);
            modal.appendChild(_cov);
        };

        const btnRow = modal.ownerDocument.createElement("div");
        btnRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:center;";

        const providerSel = modal.ownerDocument.createElement("select");
        providerSel.title = "Провайдер ИИ";
        providerSel.style.cssText = "flex:0 0 auto;height:34px;padding:0 8px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;cursor:pointer;";
        AI_PROVIDERS.forEach(provider => {
            const opt = modal.ownerDocument.createElement("option");
            opt.value = provider.id;
            opt.textContent = provider.label;
            if (_getAiProvider() === provider.id) opt.selected = true;
            providerSel.appendChild(opt);
        });
        providerSel.onchange = () => localStorage.setItem(PROVIDER_LS, providerSel.value);

        const parseBtn = modal.ownerDocument.createElement("button");
        parseBtn.textContent = "Распознать";
        parseBtn.style.cssText = `flex:1 1 auto;min-height:36px;padding:0 16px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;touch-action:manipulation;transition:opacity .15s;`;
        parseBtn.onmouseenter = () => parseBtn.style.opacity = ".85";
        parseBtn.onmouseleave = () => parseBtn.style.opacity = "1";

        const changeKeyBtn = modal.ownerDocument.createElement("button");
        changeKeyBtn.textContent = "Изменить ключ";
        changeKeyBtn.style.cssText = "flex:0 0 auto;min-height:36px;padding:0 12px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;font-size:12px;color:var(--text-muted);cursor:pointer;touch-action:manipulation;";
        changeKeyBtn.onclick = () => {
            const existing = body.querySelector(".ai-key-editor");
            if (existing) { existing.remove(); return; }
            const keyRow = modal.ownerDocument.createElement("div");
            keyRow.className = "ai-key-editor";
            keyRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
            const keyInput = modal.ownerDocument.createElement("input");
            keyInput.type = "text"; keyInput.value = _getProviderKey(providerSel.value); keyInput.placeholder = providerSel.value === "litellm" ? "LiteLLM API key…" : "sk-or-v1-…";
            keyInput.style.cssText = "flex:1 1 120px;min-width:0;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;font-family:monospace;outline:none;box-sizing:border-box;";
            const saveKeyBtn = modal.ownerDocument.createElement("button");
            saveKeyBtn.textContent = "Сохранить";
            saveKeyBtn.style.cssText = `flex:0 0 auto;height:34px;padding:0 12px;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;`;
            saveKeyBtn.onclick = () => { const v = keyInput.value.trim(); if (v) { localStorage.setItem(_getProviderInfo(providerSel.value).keyStorage, v); showStatus("✅ Ключ сохранён", "#2e7d32"); } keyRow.remove(); };
            keyRow.appendChild(keyInput); keyRow.appendChild(saveKeyBtn);
            btnRow.parentNode.insertBefore(keyRow, btnRow.nextSibling);
            keyInput.focus(); keyInput.select();
        };

        parseBtn.onclick = async () => {
            const _typedText = ta.value.trim();
            const _ONKO_SOURCE_FIELDS = [
                ["Описания_исследований", "Онко"],
                ["Анамнез_заболевания", "Анамнез заболевания"],
                ["Решение_консилиума", "Решение консилиума"],
            ];
            const _fallbackParts = _ONKO_SOURCE_FIELDS
                .map(([key, label]) => {
                    const v = getVal(key);
                    return (v && String(v).trim()) ? `${label}:\n${String(v).trim()}` : null;
                })
                .filter(Boolean);
            const rawText = _typedText || _fallbackParts.join("\n\n");
            if (!rawText) { showStatus("⚠️ Вставьте текст для распознавания или заполните раздел онко", "#f57c00"); return; }
            const key = _getProviderKey();
            if (!key) { showStatus("⚠️ API-ключ не задан", "#f57c00"); return; }

            // Инъекция существующих данных карты для комбинирования
            const _COMB_FIELDS = [
                "Диагноз",
                "Анамнез_заболевания",
                "Анамнез_жизни",
                "Описания_исследований",
                "Решение_консилиума",
                "Сопутствующие_заболевания",
                "Номер_телефона"
            ];
            const _existCtxLines = _COMB_FIELDS
                .map(f => { const v = getVal(f); return (v && String(v).trim()) ? `${f}: ${String(v).trim()}` : null; })
                .filter(Boolean);
            const userContent = _existCtxLines.length > 0
                ? `${rawText}\n\n=== ТЕКУЩИЕ ДАННЫЕ КАРТЫ ===\nИспользуй эти данные как уже подтверждённую базу: дополняй, комбинируй и расширяй без потери существующей информации.\n\n${_existCtxLines.join('\n\n')}`
                : rawText;

            parseBtn.disabled = true;
            parseBtn.textContent = "Обработка…";
            showStatus("🔍 Структурированный разбор документа и подготовка окна ревью…", "#2196f3");
            try {
                await refreshStoredFrontmatter();
                const model = localStorage.getItem(MODEL_LS) || DEFAULT_MODEL;
                const buildParserMessages = (modelId) => modelId.startsWith("google/")
                    ? [
                        {
                            role: "system",
                            content: [{ type: "text", text: PARSER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]
                        },
                        { role: "user", content: userContent }
                    ]
                    : [
                        { role: "system", content: PARSER_SYSTEM_PROMPT },
                        { role: "user", content: userContent }
                    ];
                const runParserPass = async (modelId) => runStructuredParserRequest({
                    model: modelId,
                    schemaName: "oncology_patient_parser",
                    schema: PARSER_RESPONSE_SCHEMA,
                    messages: buildParserMessages(modelId)
                });
                let parsed;
                let reviewPayload;
                const runFallbackPass = async (reasonMsg, reasonCode = "primary_error") => {
                    showStatus(`↪ Переключаюсь на резервную модель ${PARSER_FALLBACK_MODEL}…`, "#f57c00");
                    const fallbackParsed = await runParserPass(PARSER_FALLBACK_MODEL);
                    const fallbackPayload = prepareParserReviewPayload(fallbackParsed.data, rawText, fallbackParsed.meta);
                    const reasonText = String(reasonMsg || "").trim() || "причина не уточнена";
                    fallbackParsed.meta = {
                        ...fallbackParsed.meta,
                        primary_model: model,
                        fallback_reason: reasonCode,
                        fallback_reason_detail: reasonText
                    };
                    fallbackPayload.warnings = [...new Set([...(fallbackPayload.warnings || []), `Резервный проход ${PARSER_FALLBACK_MODEL}: ${reasonText}`])];
                    return { parsed: fallbackParsed, reviewPayload: fallbackPayload };
                };

                if (model === PARSER_FALLBACK_MODEL) {
                    parsed = await runParserPass(model);
                    reviewPayload = prepareParserReviewPayload(parsed.data, rawText, parsed.meta);
                } else {
                    while (true) {
                        try {
                            parsed = await runParserPass(model);
                            reviewPayload = prepareParserReviewPayload(parsed.data, rawText, parsed.meta);
                        } catch (primaryErr) {
                            const primaryMsg = String(primaryErr?.message || primaryErr || "Неизвестная ошибка");
                            const action = await askParserRetryOrFallback({
                                primaryModel: model,
                                fallbackModel: PARSER_FALLBACK_MODEL,
                                errorText: primaryMsg,
                                isEmptyResult: false
                            });
                            if (action === "retry") {
                                showStatus(`🔁 Повторяю запрос к ${model}…`, "#1565c0");
                                continue;
                            }
                            if (action === "fallback") {
                                const fallbackRes = await runFallbackPass(`Ошибка ${model}: ${primaryMsg}`, "primary_error");
                                parsed = fallbackRes.parsed;
                                reviewPayload = fallbackRes.reviewPayload;
                                break;
                            }
                            showStatus("ℹ️ Парсинг отменён пользователем", "#1565c0");
                            return;
                        }

                        if ((reviewPayload?.fields?.length || 0) > 0 || (reviewPayload?.labs?.length || 0) > 0) break;

                        const emptyReason = `${model} вернул почти пустой структурированный результат (без полей и лабораторных блоков).`;
                        const action = await askParserRetryOrFallback({
                            primaryModel: model,
                            fallbackModel: PARSER_FALLBACK_MODEL,
                            errorText: emptyReason,
                            isEmptyResult: true
                        });
                        if (action === "retry") {
                            showStatus(`🔁 Повторяю запрос к ${model}…`, "#1565c0");
                            continue;
                        }
                        if (action === "fallback") {
                            const fallbackRes = await runFallbackPass(emptyReason, "empty_primary_result");
                            parsed = fallbackRes.parsed;
                            reviewPayload = fallbackRes.reviewPayload;
                            break;
                        }
                        showStatus("ℹ️ Парсинг отменён пользователем", "#1565c0");
                        return;
                    }
                }
                const _normFIO = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
                const parsedFio = (() => {
                    const direct = reviewPayload.fields.find(item => item.key === "ФИО");
                    if (direct) return direct.value;
                    const conflict = reviewPayload.conflicts.find(item => item.key === "ФИО");
                    return conflict ? conflict.options[Math.min(Math.max(Number(conflict.suggested_index) || 0, 0), conflict.options.length - 1)]?.value : null;
                })();
                const storedFio = getStoredVal("ФИО");
                if (parsedFio && storedFio && _normFIO(parsedFio) !== _normFIO(storedFio)) {
                    const fioApproved = await askFioMismatchApproval(parsedFio);
                    if (!fioApproved) {
                        showStatus("ℹ️ Парсинг отменён: ФИО в документе не совпадает с картой", "#f57c00");
                        return;
                    }
                }

                showStatus("📝 Разбор завершён. Проверьте окно ревью перед записью в карту.", "#1565c0");
                reviewPayload = await applyInlineTnmStageSuggestion({
                    reviewPayload,
                    rawText,
                    model: parsed.meta?.primary_model || parsed.meta?.model || model
                });
                const reviewResult = await showParserReviewModal({ ...reviewPayload, meta: parsed.meta });
                if (!reviewResult) {
                    showStatus("ℹ️ Ревью закрыто без сохранения", "#1565c0");
                    return;
                }
                reviewResult.policy_trace = Array.isArray(reviewPayload?.policy_trace) ? reviewPayload.policy_trace : [];
                reviewResult.tnm_stage_trace = reviewPayload.tnm_stage_trace || null;
                const savePlan = buildParserSavePlan({ fields: reviewResult.fields, labs: reviewResult.labs });
                await finalizeParserSave({
                    ...reviewResult,
                    meta: parsed.meta,
                    savePlan,
                    review_trace: {
                        source_document: "manual_input",
                        suggested: reviewPayload,
                        policy_trace: reviewResult.policy_trace || [],
                        review_decisions: reviewResult.decision_trace || null,
                        tnm_stage_trace: reviewResult.tnm_stage_trace || null,
                        selected_fields: reviewResult.fields,
                        selected_labs: reviewResult.labs,
                        planned_changes: savePlan.changeEntries,
                        slot_trace: savePlan.slotTrace,
                        final_warnings: reviewResult.warnings
                    }
                });
            } catch(e) {
                showStatus(`❌ Ошибка: ${e.message}`, "#c62828");
            } finally {
                parseBtn.disabled = false;
                parseBtn.textContent = "Распознать";
            }
        };

        const modelSel = modal.ownerDocument.createElement("select");
        modelSel.style.cssText = "flex:0 0 auto;height:34px;padding:0 8px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);font-size:12px;cursor:pointer;";
        MODELS.forEach(m => {
            const opt = modal.ownerDocument.createElement("option");
            opt.value = m.id; opt.textContent = m.label;
            if ((localStorage.getItem(MODEL_LS) || DEFAULT_MODEL) === m.id) opt.selected = true;
            modelSel.appendChild(opt);
        });
        modelSel.onchange = () => localStorage.setItem(MODEL_LS, modelSel.value);
        btnRow.appendChild(providerSel);
        btnRow.appendChild(parseBtn);
        btnRow.appendChild(changeKeyBtn);
        btnRow.appendChild(modelSel);
        body.appendChild(btnRow);
        body.appendChild(status);
        aiWrap.appendChild(body);
    };

    renderAiPanel();
    wrap.appendChild(aiWrap);

    // ── УМНЫЙ ЧАТ ─────────────────────────────────────────────────────────────
    const chatWrap = modal.ownerDocument.createElement("div");
    chatWrap.style.cssText = "margin-bottom:8px; border-radius:8px; transition:box-shadow .2s ease;";
    const CHAT_PANEL_KEY = 'pf-chat-open-' + (typeof cur !== 'undefined' && cur && cur.file ? cur.file.path : (typeof draft !== 'undefined' && draft && draft['ID_пациента'] ? 'patient-' + draft['ID_пациента'] : 'new-patient'));
    let _chatIsOpen = localStorage.getItem(CHAT_PANEL_KEY) === '1';

    const renderChatPanel = () => {
        chatWrap.innerHTML = "";
        const hdr = modal.ownerDocument.createElement("div");
        hdr.style.cssText = "padding:10px 12px; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:" + (_chatIsOpen ? "8px 8px 0 0" : "8px") + "; display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; transition:background .15s;";
        const title = modal.ownerDocument.createElement("div");
        title.innerHTML = `<span style="display:inline-block;width:24px;text-align:center;color:${AI_COLOR};">💬</span> <span style="font-weight:700;font-size:13px;color:var(--text-normal);">Умный чат с ИИ</span>`;
        hdr.appendChild(title);
        const icon = modal.ownerDocument.createElement("div");
        icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted); transition:transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>`;
        if (_chatIsOpen) icon.querySelector("svg").style.transform = "rotate(180deg)";
        hdr.appendChild(icon);
        hdr.onclick = () => {
            _chatIsOpen = !_chatIsOpen;
            localStorage.setItem(CHAT_PANEL_KEY, _chatIsOpen ? '1' : '0');
            renderChatPanel();
        };
        hdr.onmouseenter = () => { hdr.style.background = "var(--background-modifier-hover)"; chatWrap.style.boxShadow = `0 0 0 1px var(--interactive-accent)`; };
        hdr.onmouseleave = () => { hdr.style.background = "var(--background-primary)"; chatWrap.style.boxShadow = "none"; };
        chatWrap.appendChild(hdr);
        if (!_chatIsOpen) return;

        const body = modal.ownerDocument.createElement("div");
        body.style.cssText = "border:1px solid var(--background-modifier-border); border-top:none; border-radius:0 0 8px 8px; padding:12px; background:var(--background-primary); display:flex; flex-direction:column; gap:10px;";
        
        const historyWrap = modal.ownerDocument.createElement("div");
        historyWrap.style.cssText = "max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;font-size:13px;";
        
        let chatHistory = Array.isArray(getStoredVal("Чат_история")) ? [...getStoredVal("Чат_история")] : [];
        const renderHistory = () => {
            historyWrap.innerHTML = "";
            if(chatHistory.length === 0) {
                historyWrap.innerHTML = "<div style='color:var(--text-muted);font-size:11px;text-align:center;'>Задайте вопрос по всем медицинским документам пациента. ИИ проанализирует карточку и мгновенно ответит.</div>";
            }
            chatHistory.forEach(msg => {
                const b = modal.ownerDocument.createElement("div");
                const isUser = msg.role === 'user';
                b.style.cssText = `background:${isUser ? 'var(--interactive-accent)' : 'var(--background-secondary)'};color:${isUser ? '#fff' : 'var(--text-normal)'};padding:8px 10px;border-radius:6px;align-self:${isUser ? 'flex-end' : 'flex-start'};max-width:90%;white-space:pre-wrap;word-break:break-word;`;
                b.textContent = msg.content;
                historyWrap.appendChild(b);
            });
            setTimeout(() => { historyWrap.scrollTop = historyWrap.scrollHeight; }, 10);
        };
        renderHistory();
        body.appendChild(historyWrap);

        const inputRow = modal.ownerDocument.createElement("div");
        inputRow.style.cssText = "display:flex;gap:6px;";
        const inp = modal.ownerDocument.createElement("input");
        inp.type = "text"; 
        inp.placeholder = "Спросить про пациента...";
        inp.style.cssText = "flex:1;height:34px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);padding:0 8px;font-size:13px;outline:none;";
        inp.onfocus = () => { inp.style.borderColor = "var(--interactive-accent)"; };
        inp.onblur = () => { inp.style.borderColor = "var(--background-modifier-border)"; };
        const sendBtn = modal.ownerDocument.createElement("button");
        sendBtn.innerHTML = "➤";
        sendBtn.style.cssText = `height:34px;width:34px;padding:0;background:${AI_COLOR};color:#fff;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
        
        const showChatStatus = (msg, clr) => {
            const st = modal.ownerDocument.createElement("div");
            st.style.cssText = `font-size:11px;color:${clr};text-align:center;margin-top:-4px;`;
            st.textContent = msg;
            body.appendChild(st);
            setTimeout(() => st.remove(), 4000);
        };

        const doSend = async () => {
            const q = inp.value.trim();
            if(!q) return;
            const key = _getProviderKey();
            if(!key) { showChatStatus("⚠️ Откройте AI-Ассистент и сохраните API-ключ", "#f57c00"); return; }
            inp.value = "";
            inp.disabled = true; sendBtn.disabled = true; sendBtn.style.opacity = "0.5";
            chatHistory.push({ role: "user", content: q });
            renderHistory();
            
            try {
                await refreshStoredFrontmatter();
                const ctxParts = [];
                if(getVal("ФИО")) ctxParts.push(`Пациент: ${getVal("ФИО")}`);
                if(getVal("Дата_рождения")) ctxParts.push(`Дата рождения: ${getVal("Дата_рождения")}`);
                if(getVal("МКБ 10")) ctxParts.push(`МКБ: ${getVal("МКБ 10")}`);
                if(getVal("Диагноз")) ctxParts.push(`Диагноз: ${getVal("Диагноз")}`);
                if(getVal("Анамнез_заболевания")) ctxParts.push(`Анамнез заб: ${getVal("Анамнез_заболевания")}`);
                if(getVal("Описания_исследований")) ctxParts.push(`Описания исследований: ${getVal("Описания_исследований")}`);
                if(getVal("Решение_консилиума")) ctxParts.push(`Консилиумы: ${getVal("Решение_консилиума")}`);
                
                const ctx = ctxParts.join("\\n");
                const model = localStorage.getItem(MODEL_LS) || DEFAULT_MODEL;
                const providerCfg = _getProviderRequestConfig(model);
                
                const resp = await fetch(providerCfg.endpoint, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${providerCfg.key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: providerCfg.modelId,
                        messages: [
                            { role: "system", content: "Ты — мед. ассистент врача-онколога. Отвечай кратко, по делу, опираясь ТОЛЬКО на предоставленный контекст карты пациента. Дай четкий ответ на вопрос врача.\\n\\nКОНТЕКСТ:\\n" + ctx },
                            ...chatHistory.slice(-15)
                        ]
                    })
                });
                if(!resp.ok) { const et = await resp.text(); throw new Error(`HTTP ${resp.status}: ${et.slice(0,100)}`); }
                const rjson = await resp.json();
                const aiMsg = rjson?.choices?.[0]?.message?.content || "";
                chatHistory.push({ role: "assistant", content: aiMsg });
                await saveNow({ "Чат_история": chatHistory });
                renderHistory();
            } catch(e) {
                chatHistory.push({ role: "assistant", content: "❌ Ошибка: " + e.message });
                renderHistory();
            }
            inp.disabled = false; sendBtn.disabled = false; sendBtn.style.opacity = "1";
            inp.focus();
        };
        sendBtn.onclick = doSend;
        inp.onkeydown = e => { if(e.key === "Enter") doSend(); };
        inputRow.appendChild(inp); inputRow.appendChild(sendBtn);
        body.appendChild(inputRow);
        chatWrap.appendChild(body);
    }

    return { renderAiPanel, renderChatPanel };
};

module.exports = { buildAiPanel };
