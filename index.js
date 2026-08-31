import { getContext, extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveChatDebounced, saveSettingsDebounced, saveSettings as stSaveSettings, setExtensionPrompt, extension_prompt_roles, characters } from '../../../../script.js';
import { selected_group, groups } from '../../../group-chats.js';

/* ============================================================
   RPG STATUS BAR + TAVERN BONDS ENGINE  —  merged build
   ------------------------------------------------------------
   Two engines, one block in the message and one drawer in the settings.
   Each engine keeps its own settings key, its own saved state, its own
   prompts and its own event handling — nothing was rewritten, merged or
   simplified. They live in separate closures for exactly that reason:
   both files declare `settings`, `I18N`, `t`, `escapeHtml` and more, and
   the closures let every line stay as its author wrote it.

     extension_settings.rpg_status_bar        <- Status Bar   (unchanged)
     extension_settings.tavern_bonds_engine   <- Bonds Engine (unchanged)
   ============================================================ */

/* ============================================================
   ENGINE 1 — RPG STATUS BAR
   ============================================================ */
const SB = (function () {
const MODULE_NAME = 'rpg_status_bar';
const PROMPT_KEY = 'rpg_status_injection';
const PROMPT_KEY_LIVE = 'rpg_status_live';   // MERGED: depth-0 state directive, mirrors the Bonds verdict slot

let settings = {};
let currentlyEditingChar = null;

/* ============================================================
   LOCALIZATION (RU / EN)
   Every user-facing string, the color labels, the presets and
   the AI's summary language switch with settings.language.
   ============================================================ */
const I18N = {
    en: {
        ui_header: "RPG Status Bar (Inline)",
        ui_enable: "Enable RPG Status Bar",
        ui_language: "Interface language",
        ui_api: "🔌 API Settings",
        ui_url: "URL",
        ui_key: "API Key",
        ui_model: "Model",
        ui_temp: "Temperature:",
        ui_gen: "⚙️ Generation & Context",
        ui_inject: "Use status in conversation (Inject)",
        ui_inject_title: "Inject the stat summary into the system prompt",
        ui_per_chat: "Separate status for each chat",
        ui_per_chat_title: "When on, every chat keeps its own values for a character (a new chat starts fresh instead of continuing old HP). Stat setup is seeded from the character's global template.",
        ui_reset: "Reset character",
        ui_ai_generate: "✨ Generate 4 stats (AI)",
        ai_names_lang: "All stat names and descriptions must be in English.",
        confirm_ai_generate: "Let AI design 4 custom stats for \"{char}\" from their character card? This replaces the current stats.",
        toast_gen_start: "AI is designing stats from the character card...",
        toast_gen_done: "AI generated 4 stats!",
        toast_gen_fail: "Stat generation failed.",
        toast_no_card: "No character card found for \"{char}\".",
        toast_no_key: "API key is not set!",
        ui_update_every: "Update every:",
        ui_messages: "messages",
        ui_inject_depth: "Injection depth:",
        ui_inject_depth_title: "How deep to inject the character status into the prompt (0 = at the very end)",
        ui_stat_config: "📊 Stat configuration",
        ui_edit_for: "Edit stats for:",
        ui_add_stat: "Add stat",
        ui_stat_name_ph: "Stat name",
        ui_stat_desc_ph: "Description for the AI...",
        ui_color_by_value: "🎨 Color by value",
        ui_color_by_value_title: "Color the bar by value: green high, gold mid, red low (best for 'higher = better' stats)",
        ui_delete: "Delete",
        ui_profiles: "💾 Character profiles",
        ui_export_current: "Export current character",
        ui_import: "Import profile",
        preset_fantasy: "⚔️ Fantasy",
        preset_survival: "🏕️ Survival",
        preset_romance: "💕 Romance",
        confirm_preset: "Replace the current stats for {char} with this preset?",
        toast_exported: "Profile for \"{char}\" exported!",
        toast_imported: "Profile imported onto \"{char}\"!",
        toast_imported_all: "Imported {n} profile(s)!",
        toast_import_bad: "Invalid profile file.",
        toast_import_err: "File read error.",
        confirm_reset: "Reset {char}'s status to the baseline (fresh values)?",
        toast_reset: "{char}'s status was reset.",
        inline_status: "Status: {char}",
        inline_analyzing: "Analyzing...",
        inline_error: "Error: {char}",
        inline_retry: "Retry",
        inline_recalc: "Recalculate",
        inline_recalc_title: "Recalculate status at this point",
        inline_toggle_title: "Show / hide status",
        inline_no_changes: "No changes",
        condition_stable: "Condition stable.",
        ai_summary_lang: "Write the one-sentence summary in English.",
        stat_health: "Health",
        stat_health_desc: "Physical health. Drops when injured, restored by healing/rest.",
        stat_energy: "Energy",
        stat_energy_desc: "Alertness. Drops over time, restored by sleep.",
        new_stat_name: "New stat",
        new_stat_desc: "Description...",
        ui_influence: "Let the status steer the reply",
        ui_influence_title: "Adds a short plain-language state line at depth 0, the same way the relationship verdict works: the model is told what is already true and writes from it.",
        tab_status: "Status",
        tab_bonds: "Relationship",
        band_high: "high", band_mid: "middling", band_low: "low",
        inj_head: "Character state — this is already true. Write from it.",
        inj_rule: "Let these states drive behaviour, stamina, mood and choices in this reply. Never list numbers and never mention any system.",
        inj_cond: "Condition",
        bonds_off: "The relationship engine is switched off.",
        bonds_none: "No relationship page for this character yet.",
        ui_link_label: "🔗 Link to Vitals:",
        ui_link_title: "Mirror the PLAYER's live value from the RPG Vitals extension — no AI call, always in sync. Note: Fatigue is 'higher = worse', so turn 'Color by value' off for it.",
        link_none: "— not linked —",
        link_hp: "HP (health)", link_hunger: "Satiety", link_mana: "Mana", link_fatigue: "Fatigue",
        link_missing: "RPG Vitals is not active — the linked value will freeze until it is.",
        colors: {
            red: "🔴 Blood / Health", blue: "🔵 Mana / Energy", green: "🟢 Stamina / Poison",
            gold: "🟡 Satiety / Morale", purple: "🟣 Magic / Sanity", cyan: "💠 Shield / Cold",
            dark: "⚫ Darkness / Stress", pink: "🌸 Arousal / Bond"
        },
        presets: {
            fantasy: [
                { name: "Health", desc: "Physical health. Drops when injured, restored by healing/rest.", color: "red", value: 100, dynamicColor: true },
                { name: "Mana", desc: "Magical energy. Spent casting spells, restored by rest.", color: "blue", value: 100, dynamicColor: true },
                { name: "Stamina", desc: "Physical stamina. Drops with exertion, restored by rest.", color: "green", value: 100, dynamicColor: true }
            ],
            survival: [
                { name: "Satiety", desc: "Fullness. Drops over time without food, restored by eating.", color: "gold", value: 100, dynamicColor: true },
                { name: "Hydration", desc: "Hydration. Drops over time, restored by drinking.", color: "cyan", value: 100, dynamicColor: true },
                { name: "Warmth", desc: "Body warmth. Drops in cold, restored by fire/shelter.", color: "red", value: 100, dynamicColor: true }
            ],
            romance: [
                { name: "Trust", desc: "Emotional trust toward {{user}}. Grows with kindness, drops with betrayal.", color: "green", value: 50, dynamicColor: true },
                { name: "Attraction", desc: "Romantic/physical attraction toward {{user}}. Grows with chemistry and intimacy.", color: "pink", value: 30, dynamicColor: true },
                { name: "Mood", desc: "Current mood. Rises with positive moments, falls with conflict.", color: "gold", value: 70, dynamicColor: true }
            ]
        }
    },
    ru: {
        ui_header: "RPG Status Bar (Инлайн)",
        ui_enable: "Включить статус-бар",
        ui_language: "Язык интерфейса",
        ui_api: "🔌 Настройки API",
        ui_url: "URL",
        ui_key: "API-ключ",
        ui_model: "Модель",
        ui_temp: "Температура:",
        ui_gen: "⚙️ Генерация и контекст",
        ui_inject: "Использовать статус в диалоге (инъекция)",
        ui_inject_title: "Внедрять сводку статов в системный промпт",
        ui_per_chat: "Свой статус на каждый чат",
        ui_per_chat_title: "Когда включено, у каждого чата свои значения для персонажа (новый чат начинается заново, а не продолжает старое HP). Настройки статов берутся из глобального шаблона персонажа.",
        ui_reset: "Сбросить персонажа",
        ui_ai_generate: "✨ Сгенерировать 4 стата (ИИ)",
        ai_names_lang: "Все названия и описания статов должны быть на русском языке.",
        confirm_ai_generate: "Пусть ИИ придумает 4 стата для «{char}» по карточке персонажа? Текущие статы будут заменены.",
        toast_gen_start: "ИИ подбирает статы по карточке персонажа...",
        toast_gen_done: "ИИ сгенерировал 4 стата!",
        toast_gen_fail: "Не удалось сгенерировать статы.",
        toast_no_card: "Карточка персонажа «{char}» не найдена.",
        toast_no_key: "API-ключ не указан!",
        ui_update_every: "Обновлять каждые:",
        ui_messages: "сообщений",
        ui_inject_depth: "Глубина внедрения:",
        ui_inject_depth_title: "Насколько глубоко внедрять статус в промпт (0 = в самый конец)",
        ui_stat_config: "📊 Настройка статов",
        ui_edit_for: "Редактировать статы для:",
        ui_add_stat: "Добавить стат",
        ui_stat_name_ph: "Название стата",
        ui_stat_desc_ph: "Описание для ИИ...",
        ui_color_by_value: "🎨 Цвет по значению",
        ui_color_by_value_title: "Красить полоску по значению: зелёный — высоко, золотой — средне, красный — низко (для статов, где «больше = лучше»)",
        ui_delete: "Удалить",
        ui_profiles: "💾 Профили персонажей",
        ui_export_current: "Экспорт текущего персонажа",
        ui_import: "Импорт профиля",
        preset_fantasy: "⚔️ Фэнтези",
        preset_survival: "🏕️ Выживание",
        preset_romance: "💕 Романтика",
        confirm_preset: "Заменить текущие статы «{char}» этим пресетом?",
        toast_exported: "Профиль «{char}» экспортирован!",
        toast_imported: "Профиль импортирован в «{char}»!",
        toast_imported_all: "Импортировано профилей: {n}!",
        toast_import_bad: "Неверный файл профиля.",
        toast_import_err: "Ошибка чтения файла.",
        confirm_reset: "Сбросить статус «{char}» к базовому (свежие значения)?",
        toast_reset: "Статус «{char}» сброшен.",
        inline_status: "Статус: {char}",
        inline_analyzing: "Анализирую...",
        inline_error: "Ошибка: {char}",
        inline_retry: "Повторить",
        inline_recalc: "Пересчитать",
        inline_recalc_title: "Пересчитать статус на этом моменте",
        inline_toggle_title: "Показать / скрыть статус",
        inline_no_changes: "Без изменений",
        condition_stable: "Состояние стабильно.",
        ai_summary_lang: "Пиши краткое описание (одно предложение) на русском языке.",
        stat_health: "Здоровье",
        stat_health_desc: "Физическое здоровье. Падает при травмах, восстанавливается лечением/отдыхом.",
        stat_energy: "Энергия",
        stat_energy_desc: "Бодрость. Снижается со временем, восстанавливается сном.",
        new_stat_name: "Новый стат",
        new_stat_desc: "Описание...",
        ui_influence: "Статус влияет на ответ",
        ui_influence_title: "Добавляет короткую строку состояния на глубину 0 — так же, как работает вердикт отношений: модели сообщают, что уже произошло, и она пишет от этого.",
        tab_status: "Статус",
        tab_bonds: "Отношения",
        band_high: "высоко", band_mid: "средне", band_low: "низко",
        inj_head: "Состояние персонажа — это уже так. Пиши, исходя из этого.",
        inj_rule: "Пусть эти состояния определяют поведение, силы, настроение и решения в этом ответе. Не перечисляй цифры и не упоминай никакую систему.",
        inj_cond: "Состояние",
        bonds_off: "Движок отношений выключен.",
        bonds_none: "На этого персонажа страница отношений ещё не заведена.",
        ui_link_label: "🔗 Связать с Vitals:",
        ui_link_title: "Зеркалит живое значение ИГРОКА из расширения RPG Vitals — без вызова ИИ, всегда синхронно. Учти: «Усталость» — это «больше = хуже», для неё лучше выключить «Цвет по значению».",
        link_none: "— не связан —",
        link_hp: "HP (здоровье)", link_hunger: "Сытость", link_mana: "Мана", link_fatigue: "Усталость",
        link_missing: "RPG Vitals не активен — связанное значение замрёт, пока он не появится.",
        colors: {
            red: "🔴 Кровь / Здоровье", blue: "🔵 Мана / Энергия", green: "🟢 Выносливость / Яд",
            gold: "🟡 Сытость / Дух", purple: "🟣 Магия / Рассудок", cyan: "💠 Щит / Холод",
            dark: "⚫ Тьма / Стресс", pink: "🌸 Возбуждение / Связь"
        },
        presets: {
            fantasy: [
                { name: "Здоровье", desc: "Физическое здоровье. Падает при травмах, восстанавливается лечением/отдыхом.", color: "red", value: 100, dynamicColor: true },
                { name: "Мана", desc: "Магическая энергия. Тратится на заклинания, восстанавливается отдыхом.", color: "blue", value: 100, dynamicColor: true },
                { name: "Выносливость", desc: "Физическая выносливость. Падает от нагрузки, восстанавливается отдыхом.", color: "green", value: 100, dynamicColor: true }
            ],
            survival: [
                { name: "Сытость", desc: "Насыщение. Падает со временем без еды, восстанавливается едой.", color: "gold", value: 100, dynamicColor: true },
                { name: "Гидратация", desc: "Уровень воды. Падает со временем, восстанавливается питьём.", color: "cyan", value: 100, dynamicColor: true },
                { name: "Тепло", desc: "Тепло тела. Падает на холоде, восстанавливается огнём/укрытием.", color: "red", value: 100, dynamicColor: true }
            ],
            romance: [
                { name: "Доверие", desc: "Эмоциональное доверие к {{user}}. Растёт от доброты, падает от предательства.", color: "green", value: 50, dynamicColor: true },
                { name: "Влечение", desc: "Романтическое/физическое влечение к {{user}}. Растёт от химии и близости.", color: "pink", value: 30, dynamicColor: true },
                { name: "Настроение", desc: "Текущее настроение. Растёт от приятных моментов, падает от конфликтов.", color: "gold", value: 70, dynamicColor: true }
            ]
        }
    }
};

// Names/summaries come from the AI and from downloaded character cards — never trust them raw in HTML.
function escapeHtml(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// The model sometimes returns junk instead of a string (-1, bare numbers, "null").
// String(x || fallback) lets it through because -1 is truthy. A real name/summary has letters.
function aiName(x, fallback = null, maxLen = 60) {
    const s = String(x == null ? '' : x).trim();
    if (s.length < 2 || !/\p{L}/u.test(s)) return fallback;
    if (/^(null|undefined|n\/?a|none|нет|-?\d+)$/i.test(s)) return fallback;
    return s.slice(0, maxLen);
}

function langObj() { return I18N[settings.language] || I18N.en; }
function t(key, vars) {
    let str = langObj()[key];
    if (str === undefined) str = I18N.en[key];
    if (str === undefined) str = key;
    if (typeof str === 'string' && vars) {
        for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
    }
    return str;
}
function colorOptions() { return langObj().colors || I18N.en.colors; }
function statPresets() { return langObj().presets || I18N.en.presets; }

const defaultSettings = {
    enabled: false,
    language: 'en',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    model: 'google/gemma-4-31b-it',
    temperature: 0.8,
    updateFrequency: 5,
    injectDepth: 0,
    injectContext: true,
    influenceReply: true,   // MERGED: the live-state directive at depth 0
    strictJson: true,
    perChatProfiles: false,
    profiles: {}
};

function makeDefaultProfile() {
    return {
        msgCount: 0,
        stats: [
            { name: t('stat_health'), desc: t('stat_health_desc'), color: "red", value: 100, dynamicColor: true },
            { name: t('stat_energy'), desc: t('stat_energy_desc'), color: "blue", value: 100, dynamicColor: true }
        ],
        summary: t('condition_stable')
    };
}

function loadSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    if (!settings.profiles) settings.profiles = {};
    if (!settings.chatStamps) settings.chatStamps = {};
    // heal NaN/garbage saved from empty number inputs by older builds
    if (!Number.isFinite(settings.updateFrequency)) settings.updateFrequency = defaultSettings.updateFrequency;
    if (!Number.isFinite(settings.injectDepth)) settings.injectDepth = defaultSettings.injectDepth;
}

// With "per-chat" on, keys like `chatId::Name` used to pile up forever, bloating settings.json.
// Per-chat VALUES untouched for 60 days are dropped; the character's global template (plain
// `Name` key, i.e. the stat config) is never pruned, so nothing needs re-setting-up.
const STATE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
function pruneOldStates() {
    const now = Date.now();
    let changed = false;
    const liveChats = new Set();
    for (const key of Object.keys(settings.profiles)) {
        const i = key.indexOf('::');
        if (i < 0) continue;                      // global template — keep forever
        const chatId = key.slice(0, i);
        if (!settings.chatStamps[chatId]) { settings.chatStamps[chatId] = now; changed = true; liveChats.add(chatId); continue; } // migrate
        if (now - settings.chatStamps[chatId] > STATE_TTL_MS) { delete settings.profiles[key]; changed = true; }
        else liveChats.add(chatId);
    }
    for (const id of Object.keys(settings.chatStamps)) {
        if (!liveChats.has(id)) { delete settings.chatStamps[id]; changed = true; }
    }
    if (changed) saveSettings();
}

function saveSettings() {
    extension_settings[MODULE_NAME] = settings;
    if (typeof saveSettingsDebounced === 'function') {
        saveSettingsDebounced();
    }
}

// When "per-chat" is on, a character's live state is stored per chat, seeded
// from the character's global template (config carries over, values are fresh).
function profileKey(charName) {
    const chatId = getContext().chatId;
    if (settings.perChatProfiles && chatId) {
        if (!settings.chatStamps) settings.chatStamps = {};
        settings.chatStamps[chatId] = Date.now();   // touch: keeps this chat's values from being pruned
        return `${chatId}::${charName}`;
    }
    return charName;
}

function getProfile(charName) {
    const key = profileKey(charName);
    if (!settings.profiles[key]) {
        const globalTpl = (key !== charName && settings.profiles[charName]) ? settings.profiles[charName] : null;
        settings.profiles[key] = globalTpl ? JSON.parse(JSON.stringify(globalTpl)) : makeDefaultProfile();
        settings.profiles[key].msgCount = 0; // fresh counter for a new chat
    }
    let p = settings.profiles[key];
    if (p.msgCount === undefined) p.msgCount = 0;
    if (!p.stats || !Array.isArray(p.stats)) p.stats = makeDefaultProfile().stats;
    if (!p.summary) p.summary = t('condition_stable');
    return p;
}

function resetCharacter(charName) {
    const key = profileKey(charName);
    if (settings.perChatProfiles && key !== charName && settings.profiles[charName]) {
        // per-chat: reseed from the character's global template baseline
        settings.profiles[key] = JSON.parse(JSON.stringify(settings.profiles[charName]));
        settings.profiles[key].msgCount = 0;
    } else {
        // global (or no template): restore full values and clear the summary
        const p = getProfile(charName);
        p.stats.forEach(s => { s.value = 100; });
        p.summary = t('condition_stable');
        p.msgCount = 0;
    }
    saveSettings();
    renderDynamicStats();
    updateContextInjection();
    toastr.success(t('toast_reset', { char: escapeHtml(charName) }));
}

// === AI: design custom stats from the character card ===
function getCharacterCard(charName) {
    const c = characters.find(ch => ch.name === charName);
    if (!c) return '';
    const parts = [c.name, c.description, c.personality, c.scenario].filter(Boolean);
    return parts.join('\n').trim().slice(0, 3000);
}


/* ------------------------------------------------------------
   STRICT JSON MODE
   response_format is an OpenAI parameter, not a standard one. KoboldCpp turns it
   into a grammar constraint that forbids anything but an object — a model that
   opens with "[" then cannot finish and bails out with EOS after a few tokens.
   Local backends therefore do not get it. Nothing is lost: the reply is pulled out
   with a regex that finds the first object in any text, preamble or code fence
   included, which is why the request works without the parameter at all.
   ------------------------------------------------------------ */
function isLocalEndpoint(url) {
    const u = String(url || '').toLowerCase();
    if (!u) return false;
    return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)([:/]|$)/.test(u)
        || /:(5001|5000|8080|8000|1234|11434|5002)(\/|$)/.test(u)          // kobold, ooba, lm studio, ollama
        || /192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./.test(u);   // the local network
}
function wantsStrictJson(url) {
    if (settings.strictJson === false) return false;      // switched off by hand
    return !isLocalEndpoint(url);
}

const KEY_SOURCES = ['tavern_rpg_engine', 'rpg_status_bar', 'tavern_bonds_engine', 'rpg_phone', 'rpg_diary', 'rpg_map_engine', 'rpg_map', 'rpg_dungeons', 'rpg_codex', 'tavern_doors'];
/* An address you typed always wins. Borrowing used to take the neighbour's URL and
   model along with the key whenever your own pair was incomplete — so pointing this
   at LM Studio or KoboldCpp and leaving the key blank (neither needs one) quietly
   sent every request somewhere else, and it looked like it was working. A local
   endpoint needs no key, so a placeholder is used rather than a borrowed one. */
function borrowedRaw() {
    for (const src of KEY_SOURCES) {
        if (src === MODULE_NAME) continue;
        try {
            const x = extension_settings[src];
            if (x && x.apiKey && x.model) return { url: x.baseUrl, key: x.apiKey, model: x.model, from: src };
        } catch (e) { /* a neighbour with broken settings must not break us */ }
    }
    return { url: '', key: '', model: '', from: null };
}

/* OpenAI-style backends live under /v1. Leave that off — "http://localhost:1234" —
   and the request goes to /chat/completions, which LM Studio and KoboldCpp answer
   with "Unexpected endpoint or method". The segment is added when the address has
   no version in it at all, so ".../api/v1" and ".../v1" are left exactly as typed. */
function normalizeBase(url) {
    let u = String(url || '').trim().replace(/\s+/g, '');
    if (!u) return u;
    u = u.replace(/\/+$/, '');
    u = u.replace(/\/(chat\/completions|completions|images|images\/generations|embeddings)$/i, '');
    if (!/\/v\d+($|\/)/i.test(u)) u += '/v1';
    return u;
}

function apiConf() {
    const own = String(settings.baseUrl || '').trim();
    const ownKey = String(settings.apiKey || '').trim();
    const ownModel = String(settings.model || '').trim();
    if (own) {
        const local = isLocalEndpoint(own);
        const b = (ownKey && ownModel) ? { key: '', model: '', from: null } : borrowedRaw();
        return {
            url: own,
            key: ownKey || (local ? 'local' : b.key),
            model: ownModel || (local ? '' : b.model),
            from: ownKey ? null : (local ? null : b.from)
        };
    }
    if (ownKey && ownModel) return { url: '', key: ownKey, model: ownModel, from: null };
    const b = borrowedRaw();
    return b.key ? b : { url: '', key: ownKey, model: ownModel, from: null };
}
function apiKey() { return apiConf().key || ''; }
function apiUrl() { return normalizeBase(apiConf().url) || 'https://openrouter.ai/api/v1'; }
function apiModel() { return apiConf().model || ''; }
function borrowedFrom() { return apiConf().from; }

async function callStatsAI(system, user) {
    const url = (apiUrl() || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey().trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: apiModel(),
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            temperature: 0.6,
            ...(wantsStrictJson(url) ? { response_format: { type: "json_object" } } : {})
        })
    });
    if (!resp.ok) {
        let detail = '';
        try { detail = (await resp.json())?.error?.message || ''; } catch (e) {}
        throw new Error(`HTTP ${resp.status} ${detail}`.trim());
    }
    const data = await resp.json();
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) throw new Error("Unexpected AI response");
    let content = (data.choices[0].message.content || '').trim();
    const m = content.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : content);
}

async function generateStatsForCharacter(charName) {
    if (!apiKey()) { toastr.warning(t('toast_no_key')); return; }
    const card = getCharacterCard(charName);
    if (!card) { toastr.warning(t('toast_no_card', { char: escapeHtml(charName) })); return; }

    toastr.info(t('toast_gen_start'));
    try {
        const validColors = Object.keys(colorOptions());
        const sys = `You are an RPG systems designer. Based on the character below, invent EXACTLY 4 status stats that best fit their nature, role and personality. Mix physical, emotional and relational stats where it makes sense.
For each stat provide:
- "name": short (1-2 words)
- "desc": one sentence telling a Game Master what raises and lowers it
- "color": one of [${validColors.join(', ')}]
- "value": a starting value 0-100 that fits the character right now
- "dynamicColor": true if higher is better (health-like), false otherwise
${t('ai_names_lang')}
Output ONLY valid JSON: { "stats": [ {"name":"","desc":"","color":"red","value":100,"dynamicColor":true} ] } with exactly 4 entries.`;

        const result = await callStatsAI(sys, `Character:\n${card}`);
        let stats = Array.isArray(result?.stats) ? result.stats : [];
        stats = stats.slice(0, 4).map(s => {
            let v = Number(s.value);
            if (!isFinite(v)) v = 100;
            const nm = aiName(s.name, null, 40);
            if (!nm) return null;                       // junk entry from the model — drop it
            return {
                name: nm,
                desc: aiName(s.desc, '', 200) || '',
                color: validColors.includes(s.color) ? s.color : 'blue',
                value: Math.max(0, Math.min(100, Math.round(v))),
                dynamicColor: !!s.dynamicColor
            };
        }).filter(Boolean);
        if (stats.length === 0) throw new Error("no stats returned");

        const profile = getProfile(charName);
        profile.stats = stats;
        profile.summary = t('condition_stable');
        profile.msgCount = 0;
        saveSettings();
        renderDynamicStats();
        updateContextInjection();
        toastr.success(t('toast_gen_done'));
    } catch (e) { console.error("Stat generation failed:", e); toastr.error(t('toast_gen_fail')); }
}

/* ============================================================
   RPG VITALS LINK
   A stat can mirror the PLAYER's live value from the RPG Vitals
   extension (window.RPG.vitals): zero AI calls, never out of sync,
   and it stops the same HP being computed twice by two extensions.
   Vitals loads after this extension, so the bridge is checked at
   read time, never cached.
   ============================================================ */
const LINK_KEYS = ['hp', 'hunger', 'mana', 'fatigue'];
function vitApi() {
    const v = (typeof window !== 'undefined') && window.RPG && window.RPG.vitals;
    return (v && v.available) ? v : null;
}
function linkedValue(link) {
    const v = vitApi();
    if (!v) return null;
    try {
        if (link === 'hp') { const h = v.getHp(); return (h && h.max > 0) ? Math.round(h.hp / h.max * 100) : null; }
        if (link === 'hunger') { const n = v.getHunger(); return isFinite(n) ? Math.round(n) : null; }
        if (link === 'mana') { const n = v.getMana(); return isFinite(n) ? Math.round(n) : null; }
        if (link === 'fatigue') { const n = v.getFatigue(); return isFinite(n) ? Math.round(n) : null; }
    } catch (e) { /* vitals mid-switch — keep the old value */ }
    return null;
}
// refresh every linked stat of a profile from Vitals; returns true if anything moved
function refreshLinkedStats(profile) {
    let changed = false;
    (profile.stats || []).forEach(st => {
        if (!st.link) return;
        const nv = linkedValue(st.link);
        if (nv !== null && nv !== st.value) { st.value = Math.max(0, Math.min(100, nv)); changed = true; }
    });
    return changed;
}

function getActiveCharacters() {
    let activeChars = [];
    const context = getContext();

    if (selected_group) {
        const group = groups.find(g => g.id === selected_group);
        if (group && group.members && Array.isArray(group.members)) {
            group.members.forEach(memberIdentifier => {
                let char = characters.find(c => c.avatar === memberIdentifier);
                if (!char && !isNaN(memberIdentifier)) char = characters[parseInt(memberIdentifier)];
                if (!char) char = characters.find(c => c.name === memberIdentifier);
                if (char) activeChars.push(char);
            });
        }
    } else if (context.characterId !== undefined && characters[context.characterId]) {
        activeChars.push(characters[context.characterId]);
    }

    return activeChars;
}

async function calculateNewStats(historyText, charName) {
    if (!apiKey()) throw new Error("API key is not set!");
    const profile = getProfile(charName);

    let statsRules = "";
    let currentValuesJSON = {};

    profile.stats.forEach(stat => {
        if (stat.link) return;                 // linked stats come live from Vitals — no tokens, no drift
        statsRules += `- "${stat.name}": (0 to 100). ${stat.desc}\n`;
        currentValuesJSON[stat.name] = stat.value;
    });

    const systemPrompt = `You are a strict RPG Game Master calculator. 
Update the character's (${charName}) stats based on the story events. All stats are 0 to 100.

Active Stats and rules:
${statsRules}

Current Stats:
${JSON.stringify(currentValuesJSON)}

RULES:
1. Analyze events. Change stats if damage, rest, food, or stress occurred.
2. Also account for EMOTIONAL, SOCIAL and INTIMATE events (affection, trust, arousal, fear, tension) whenever such stats exist — move those stats accordingly.
3. If nothing relevant happened, slightly decrease energy/satiety over time.
4. Write a brief 1-sentence summary of ${charName}'s physical and emotional state. ${t('ai_summary_lang')}
5. Output ONLY valid JSON. Keep the stat keys EXACTLY as given above.

Format:
{
  "stats": { "Stat1": 95, "Stat2": 80 },
  "summary": "Short description."
}`;

    let endpointUrl = (apiUrl() || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';

    for (let i = 0; i < 2; i++) {
        // A request that never comes back used to leave the panel on "Analyzing..."
        // forever: there was no timeout anywhere on this path, and the catch below
        // can only report a request that actually finished. An abort turns a hang
        // into an ordinary error the panel already knows how to draw.
        const ctl = new AbortController();
        const bell = setTimeout(() => ctl.abort(), 45000);
        try {
            const response = await fetch(endpointUrl, {
                method: 'POST',
                signal: ctl.signal,
                headers: { 'Authorization': `Bearer ${apiKey().trim()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: apiModel(),
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Story:\n${historyText}\n\nOutput JSON:` }
                    ],
                    temperature: settings.temperature,
                    ...(wantsStrictJson(endpointUrl) ? { response_format: { type: "json_object" } } : {})
                })
            });

            if (response.status === 429 && i === 0) {
                await new Promise(r => setTimeout(r, 2000)); continue;
            }
            if (!response.ok) {
                let detail = '';
                try { detail = (await response.json())?.error?.message || ''; } catch (e) {}
                throw new Error(`HTTP ${response.status} ${detail}`.trim());
            }

            const data = await response.json();
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error("Unexpected AI response");
            }
            let content = (data.choices[0].message.content || '').trim();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (e) {
            if (i === 1) throw (e && e.name === 'AbortError') ? new Error('timeout') : e;
        } finally { clearTimeout(bell); }
    }
}

// === RENDER (CSS GRID ANIMATION) ===
// Resolve the container by walking the nodes rather than with an attribute selector:
// character names may contain quotes or apostrophes, which would make the selector invalid.
function findStatusContainer(messageElement, charName) {
    return Array.from(messageElement.querySelectorAll('.rpg-inline-container'))
        .find(c => c.getAttribute('data-char') === charName) || null;
}

function renderInlineStatus(messageId, charName, statsData, isLoading = false, isError = false) {
    // MERGED: the block is now a two-tab shell built by the host layer. Everything below
    // still produces exactly the same bars, deltas, summary and button — it is only
    // written into the "Status" pane instead of replacing the whole container.
    const container = (typeof window.RPGSB_SHELL === 'function')
        ? window.RPGSB_SHELL(messageId, charName)
        : null;
    if (!container) return;
    const pane = container.querySelector('.rpg-pane-status');
    if (!pane) return;

    const setHeader = (icon, mini, critical) => {
        const header = container.querySelector('.rpg-inline-header');
        if (!header) return;
        header.classList.toggle('rpg-header-critical', !!critical);
        const ico = header.querySelector('.rpg-header-left i');
        if (ico) ico.className = 'fa-solid ' + icon;
        const ttl = header.querySelector('.rpg-header-title');
        if (ttl) ttl.textContent = t('inline_status', { char: charName });
        const ms = header.querySelector('.rpg-mini-summary');
        if (ms) ms.textContent = mini;
    };

    if (isLoading) {
        setHeader('fa-spinner fa-spin', t('inline_analyzing'), false);
        pane.innerHTML = `<div class="rpg-loading-text rpg-loading-dots">${escapeHtml(t('inline_analyzing'))}</div>`;
        return;
    }

    if (isError) {
        setHeader('fa-triangle-exclamation', '', true);
        pane.innerHTML = `
            <div style="color:#ff6b6b; font-size:0.85rem; margin-bottom: 10px;">${escapeHtml(statsData)}</div>
            <button class="rpg-force-update" data-id="${messageId}" data-char="${escapeHtml(charName)}"><i class="fa-solid fa-rotate-right"></i> ${t('inline_retry')}</button>
        `;
    }
    else if (statsData && statsData.stats) {
        let barsHtml = '';
        let anyCritical = false;
        statsData.stats.forEach(stat => {
            let val = Math.max(0, Math.min(100, stat.value));

            let colorClass = `rpg-color-${stat.color}`;
            if (stat.dynamicColor) {
                colorClass = val > 60 ? 'rpg-color-green' : (val >= 30 ? 'rpg-color-gold' : 'rpg-color-red');
            }

            const isCritical = val <= 15;
            if (isCritical) anyCritical = true;

            const d = stat.delta || 0;
            let deltaHtml = '';
            if (d > 0) deltaHtml = ` <span class="rpg-delta up">▲${d}</span>`;
            else if (d < 0) deltaHtml = ` <span class="rpg-delta down">▼${Math.abs(d)}</span>`;

            barsHtml += `
                <div class="rpg-stat-row${isCritical ? ' rpg-critical' : ''}">
                    <div class="rpg-stat-labels"><span>${escapeHtml(stat.name)}${isCritical ? ' <i class="fa-solid fa-triangle-exclamation rpg-crit-icon"></i>' : ''}</span><span>${val}/100${deltaHtml}</span></div>
                    <div class="rpg-stat-bar-bg"><div class="rpg-stat-bar-fill ${colorClass}" style="width: ${val}%"></div></div>
                </div>`;
        });

        let shortSummary = statsData.summary || t('inline_no_changes');
        if (shortSummary.length > 35) shortSummary = shortSummary.substring(0, 35) + '...';

        setHeader(anyCritical ? 'fa-triangle-exclamation' : 'fa-heart-pulse', shortSummary, anyCritical);

        pane.innerHTML = `
            ${barsHtml}
            <div class="rpg-body-footer">
                <div class="rpg-status-summary">${escapeHtml(statsData.summary)}</div>
                <button class="rpg-force-update" data-id="${messageId}" data-char="${escapeHtml(charName)}" title="${t('inline_recalc_title')}">
                    <i class="fa-solid fa-rotate-right"></i> ${t('inline_recalc')}
                </button>
            </div>
        `;
    }

    const updateBtn = pane.querySelector('.rpg-force-update');
    if (updateBtn) {
        updateBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            updateBtn.classList.add('rpg-force-spinning');
            await processCharacterStatus(messageId, charName, true);
        });
    }

    // MERGED: the pane now has content, so the tab row may need to appear.
    if (typeof window.RPGSB_SYNC === 'function') window.RPGSB_SYNC(container);
}

async function processCharacterStatus(messageId, charName, forceUpdate = false) {
    if (!settings.enabled) return;

    const context = getContext();
    const chat = context.chat;
    const msg = chat[messageId];
    if (!msg || msg.is_user || msg.is_system) return;

    const profile = getProfile(charName);

    if (!forceUpdate && msg.extra?.rpg_status?.[charName]) {
        renderInlineStatus(messageId, charName, msg.extra.rpg_status[charName]);
        return;
    }

    let needsApiCall = forceUpdate;
    if (!forceUpdate) {
        profile.msgCount += 1;
        if (profile.msgCount >= settings.updateFrequency) {
            needsApiCall = true;
            profile.msgCount = 0;
        }
    }

    if (!needsApiCall) {
        refreshLinkedStats(profile);           // even without an AI call, linked bars stay live
        const currentData = { stats: JSON.parse(JSON.stringify(profile.stats)), summary: profile.summary };
        if (!msg.extra) msg.extra = {};
        if (!msg.extra.rpg_status) msg.extra.rpg_status = {};
        msg.extra.rpg_status[charName] = currentData;
        saveChatDebounced();
        renderInlineStatus(messageId, charName, currentData);
        return;
    }

    renderInlineStatus(messageId, charName, null, true, false);
    const myChat = context.chatId;   // message ids overlap between chats: a result arriving after a
                                     // switch used to paint the OLD chat's status onto the NEW chat's
                                     // message with the same number, and save into the wrong chat file

    try {
        const startIdx = Math.max(0, messageId - 10);
        const historySlice = chat.slice(startIdx, messageId + 1).filter(m => !m.is_system);
        const historyText = historySlice.map(m => `${m.name}: ${m.mes}`).join('\n\n');

        const result = await calculateNewStats(historyText, charName);
        if (getContext().chatId !== myChat) return;   // chat changed while the AI was thinking

        const deltas = {};
        if (result.stats) {
            profile.stats.forEach((stat) => {
                if (stat.link) return;                    // Vitals owns this one
                if (result.stats[stat.name] !== undefined) {
                    // the model can answer with strings, -5 or 150 — a stat is always a clamped number
                    const nv = Number(result.stats[stat.name]);
                    if (!isFinite(nv)) return;
                    const oldVal = Number(stat.value) || 0;
                    stat.value = Math.max(0, Math.min(100, Math.round(nv)));
                    deltas[stat.name] = stat.value - oldVal;
                }
            });
        }
        const cleanSummary = aiName(result.summary, null, 400);   // junk ("-1") must not become the state line
        if (cleanSummary) profile.summary = cleanSummary;
        refreshLinkedStats(profile);           // stamp the snapshot with Vitals' current numbers
        saveSettings();

        const snapshotData = { stats: JSON.parse(JSON.stringify(profile.stats)), summary: profile.summary };
        snapshotData.stats.forEach(s => { s.delta = deltas[s.name] || 0; });
        if (!msg.extra) msg.extra = {};
        if (!msg.extra.rpg_status) msg.extra.rpg_status = {};
        msg.extra.rpg_status[charName] = snapshotData;
        saveChatDebounced();

        renderInlineStatus(messageId, charName, snapshotData);
        updateContextInjection();

    } catch (e) {
        console.error(`Status Update Failed for ${charName}:`, e);
        renderInlineStatus(messageId, charName, e.message, false, true);
    }
}

function bandWord(val, dynamicColor) {
    // The same three thresholds the bar colouring already uses, said in words. A model
    // writes far better from "low" than from "41/100", exactly as the Bonds engine does.
    const v = Math.max(0, Math.min(100, Number(val) || 0));
    if (v > 60) return t('band_high');
    if (v >= 30) return t('band_mid');
    return t('band_low');
}

// MERGED — THE STATUS VERDICT
// The original block above is a quiet note at the author's chosen depth. This is the
// other half, borrowed from the Bonds engine's verdict slot: a short plain-language
// line at depth 0, stating what is ALREADY true, plus one rule telling the model to
// write from it. No table, no numbers for the model to negotiate with.
function buildStatusDirective() {
    const lines = [];
    getActiveCharacters().forEach(char => {
        const p = settings.profiles[profileKey(char.name)];
        if (!p || !Array.isArray(p.stats) || !p.stats.length) return;
        refreshLinkedStats(p);
        const bits = p.stats.map(st => `${st.name} ${Math.max(0, Math.min(100, Number(st.value) || 0))}/100 (${bandWord(st.value, st.dynamicColor)})`);
        let line = `${char.name}: ${bits.join(', ')}.`;
        if (p.summary) line += ` ${t('inj_cond')}: ${p.summary}`;
        lines.push(line);
    });
    if (!lines.length) return '';
    return `[${t('inj_head')}]\n${lines.join('\n')}\n[${t('inj_rule')}]`;
}

function updateContextInjection() {
    if (!settings.enabled || !settings.injectContext) {
        setExtensionPrompt(PROMPT_KEY, '', 0, 0, false);
        setExtensionPrompt(PROMPT_KEY_LIVE, '', 0, 0, false);
        return;
    }

    let injectionText = "\n[System Notes - Character States]\n";
    const activeChars = getActiveCharacters();

    activeChars.forEach(char => {
        const p = settings.profiles[profileKey(char.name)];
        if (!p) return;
        refreshLinkedStats(p);
        const linked = (p.stats || []).filter(st => st.link).map(st => `${st.name} ${st.value}/100`).join(', ');
        injectionText += `${char.name}: ${p.summary}${linked ? ` (${linked})` : ''}\n`;
    });

    setExtensionPrompt(PROMPT_KEY, injectionText, 2, settings.injectDepth, false, extension_prompt_roles.SYSTEM);

    let directive = '';
    if (settings.influenceReply) {
        try { directive = buildStatusDirective(); }
        catch (e) { console.error('[RPG Status Bar] directive failed:', e); directive = ''; }
    }
    setExtensionPrompt(PROMPT_KEY_LIVE, directive, 2, 0, false, extension_prompt_roles.SYSTEM);
}

// === IMPORT / EXPORT (per character; file carries the full profile) ===
function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportCurrentProfile() {
    const name = currentlyEditingChar || "Character";
    const profile = getProfile(name);
    const safe = String(name).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '_') || 'character';
    downloadJson({
        type: 'rpg_status_profile',
        version: 1,
        character: name,
        profile: JSON.parse(JSON.stringify(profile))
    }, `rpg_status_${safe}.json`);
    toastr.success(t('toast_exported', { char: escapeHtml(name) }));
}

function importProfile() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // single-character file (our export) → apply onto the selected character
                if (data && data.profile && Array.isArray(data.profile.stats)) {
                    const target = currentlyEditingChar || data.character || "Character";
                    settings.profiles[target] = JSON.parse(JSON.stringify(data.profile));
                    saveSettings();
                    renderDynamicStats();
                    updateContextInjection();
                    toastr.success(t('toast_imported', { char: escapeHtml(target) }));
                    return;
                }

                // a map of {name: profile} → merge all (backward/forward compatible)
                if (data && typeof data === 'object') {
                    let n = 0;
                    for (const [name, prof] of Object.entries(data)) {
                        if (prof && Array.isArray(prof.stats)) { settings.profiles[name] = JSON.parse(JSON.stringify(prof)); n++; }
                    }
                    if (n > 0) {
                        saveSettings();
                        renderDynamicStats();
                        updateContextInjection();
                        toastr.success(t('toast_imported_all', { n }));
                        return;
                    }
                }

                toastr.error(t('toast_import_bad'));
            } catch (err) {
                console.error(err);
                toastr.error(t('toast_import_err'));
            }
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

// === SETTINGS UI ===
function buildSettingsHtml() {
    // MERGED: no drawer of its own any more — this is the content of the "Status" tab.
    return `
            <label class="checkbox_label">
                <input type="checkbox" id="rpg-enabled">
                ${t('ui_enable')}
            </label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10 margin-t-10">
                <label>${t('ui_language')}:</label>
                <select id="rpg-language" class="text_pole" style="width:auto;">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            <hr class="sysHR">
            <h4>${t('ui_api')}</h4>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="text" id="rpg-base-url" class="text_pole flex1" placeholder="${t('ui_url')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="password" id="rpg-api-key" class="text_pole flex1" placeholder="${t('ui_key')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <input type="text" id="rpg-model" class="text_pole flex1" placeholder="${t('ui_model')}">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label style="min-width: 120px;">${t('ui_temp')}</label>
                <input type="range" id="rpg-temperature" min="0" max="2" step="0.1" style="flex: 1;">
                <span id="rpg-temp-val" style="min-width: 30px; text-align: right;"></span>
            </div>
            <hr class="sysHR">
            <h4>${t('ui_gen')}</h4>
            <label class="checkbox_label" title="${t('ui_inject_title')}">
                <input type="checkbox" id="rpg-inject-context">
                <b>${t('ui_inject')}</b>
            </label>
            <label class="checkbox_label margin-t-10" title="${t('ui_influence_title')}">
                <input type="checkbox" id="rpg-influence">
                <b>${t('ui_influence')}</b>
            </label>
            <label class="checkbox_label margin-t-10" title="${t('ui_per_chat_title')}">
                <input type="checkbox" id="rpg-per-chat">
                <b>${t('ui_per_chat')}</b>
            </label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10 margin-t-10">
                <label>${t('ui_update_every')}</label>
                <input type="number" id="rpg-freq" class="text_pole" min="1" max="15" style="width: 50px;">
                <label>${t('ui_messages')}</label>
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10" title="${t('ui_inject_depth_title')}">
                <label>${t('ui_inject_depth')}</label>
                <input type="number" id="rpg-inject-depth" class="text_pole" min="0" max="100" style="width: 50px;">
            </div>
            <hr class="sysHR">
            <div id="rpg-dynamic-stats-container"></div>
`;
}

function renderDynamicStats() {
    let activeChars = getActiveCharacters().map(c => c.name);
    if (activeChars.length === 0) activeChars = ["Character"];
    if (!currentlyEditingChar || !activeChars.includes(currentlyEditingChar)) {
        currentlyEditingChar = activeChars[0];
    }

    let html = `<h4>${t('ui_stat_config')}</h4>`;
    html += `<div class="flex-container alignitemscenter flexgap5 margin-b-10">
        <label>${t('ui_edit_for')}</label>
        <select id="rpg-char-select" class="text_pole flex1">`;
    activeChars.forEach(name => {
        html += `<option value="${escapeHtml(name)}" ${name === currentlyEditingChar ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    });
    html += `</select></div>`;

    // per-character profile export / import
    html += `<div class="flex-container flexgap5 margin-b-10">
        <div class="rpg-add-stat-btn flex1" id="rpg-export-profile" style="margin-bottom:0;"><i class="fa-solid fa-file-export"></i> ${t('ui_export_current')}</div>
        <div class="rpg-add-stat-btn flex1" id="rpg-import-profile" style="margin-bottom:0; background:rgba(105,240,174,0.15); border-color:#69f0ae;"><i class="fa-solid fa-file-import"></i> ${t('ui_import')}</div>
    </div>`;
    html += `<div class="rpg-add-stat-btn margin-b-10" id="rpg-reset-char" style="background:rgba(255,82,82,0.12); border-color:rgba(255,82,82,0.5);"><i class="fa-solid fa-rotate-left"></i> ${t('ui_reset')}</div>`;

    html += `<div class="rpg-add-stat-btn margin-b-10" id="rpg-ai-generate" style="background:rgba(139,92,246,0.25); border-color:rgba(139,92,246,0.7);"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('ui_ai_generate')}</div>`;

    html += `<div class="rpg-presets">
        <div class="rpg-preset-btn" data-preset="fantasy">${t('preset_fantasy')}</div>
        <div class="rpg-preset-btn" data-preset="survival">${t('preset_survival')}</div>
        <div class="rpg-preset-btn" data-preset="romance">${t('preset_romance')}</div>
    </div>`;
    html += `<div id="rpg-stats-setup-list">`;

    const profile = getProfile(currentlyEditingChar);

    profile.stats.forEach((stat, i) => {
        let colorOptionsHtml = "";
        for (const [key, name] of Object.entries(colorOptions())) {
            colorOptionsHtml += `<option value="${key}" ${stat.color === key ? 'selected' : ''}>${name}</option>`;
        }

        html += `
            <div class="rpg-settings-stat-block">
                <i class="fa-solid fa-trash rpg-delete-stat-btn" data-id="${i}" title="${t('ui_delete')}"></i>
                <input type="text" class="text_pole rpg-stat-name" data-id="${i}" value="${escapeHtml(stat.name)}" placeholder="${t('ui_stat_name_ph')}" style="width: 80%; margin-bottom: 5px;">
                <select class="text_pole rpg-stat-color" data-id="${i}" style="width: 100%; margin-bottom: 5px;">${colorOptionsHtml}</select>
                <textarea class="text_pole rpg-stat-desc" data-id="${i}" rows="2" placeholder="${t('ui_stat_desc_ph')}" style="width: 100%;">${escapeHtml(stat.desc)}</textarea>
                <label class="checkbox_label rpg-dyncolor-label" title="${t('ui_color_by_value_title')}">
                    <input type="checkbox" class="rpg-stat-dyncolor" data-id="${i}" ${stat.dynamicColor ? 'checked' : ''}>
                    <span>${t('ui_color_by_value')}</span>
                </label>
                <div class="flex-container alignitemscenter flexgap5" title="${t('ui_link_title')}">
                    <label style="font-size:0.85em;">${t('ui_link_label')}</label>
                    <select class="text_pole rpg-stat-link" data-id="${i}" style="flex:1;">
                        <option value="" ${!stat.link ? 'selected' : ''}>${t('link_none')}</option>
                        ${LINK_KEYS.map(k => `<option value="${k}" ${stat.link === k ? 'selected' : ''}>${t('link_' + k)}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    });

    html += `</div><div class="rpg-add-stat-btn" id="rpg-add-stat"><i class="fa-solid fa-plus"></i> ${t('ui_add_stat')}</div>`;
    $('#rpg-dynamic-stats-container').html(html);

    $('#rpg-char-select').on('change', function () {
        currentlyEditingChar = $(this).val();
        renderDynamicStats();
    });

    $('#rpg-export-profile').on('click', exportCurrentProfile);
    $('#rpg-import-profile').on('click', importProfile);
    $('#rpg-reset-char').on('click', () => {
        if (confirm(t('confirm_reset', { char: currentlyEditingChar }))) resetCharacter(currentlyEditingChar);
    });
    $('#rpg-ai-generate').on('click', () => {
        if (confirm(t('confirm_ai_generate', { char: currentlyEditingChar }))) generateStatsForCharacter(currentlyEditingChar);
    });

    $('#rpg-add-stat').on('click', () => {
        profile.stats.push({ name: t('new_stat_name'), desc: t('new_stat_desc'), color: "blue", value: 100, dynamicColor: false });
        saveSettings(); renderDynamicStats();
    });

    $('.rpg-delete-stat-btn').on('click', function () {
        profile.stats.splice($(this).data('id'), 1);
        saveSettings(); renderDynamicStats();
    });

    $('.rpg-stat-name').on('input', function () { profile.stats[$(this).data('id')].name = $(this).val(); saveSettings(); });
    $('.rpg-stat-desc').on('input', function () { profile.stats[$(this).data('id')].desc = $(this).val(); saveSettings(); });
    $('.rpg-stat-color').on('change', function () { profile.stats[$(this).data('id')].color = $(this).val(); saveSettings(); });
    $('.rpg-stat-dyncolor').on('change', function () { profile.stats[$(this).data('id')].dynamicColor = this.checked; saveSettings(); });
    $('.rpg-stat-link').on('change', function () {
        const st = profile.stats[$(this).data('id')];
        st.link = $(this).val() || '';
        if (st.link) {
            const nv = linkedValue(st.link);
            if (nv !== null) st.value = nv; else toastr.info(t('link_missing'));
        }
        saveSettings(); updateContextInjection();
    });

    $('.rpg-preset-btn').on('click', function () {
        const preset = statPresets()[$(this).data('preset')];
        if (!preset) return;
        if (!confirm(t('confirm_preset', { char: currentlyEditingChar }))) return;
        profile.stats = JSON.parse(JSON.stringify(preset));
        saveSettings();
        renderDynamicStats();
    });
}

function mountSettings() {
    // MERGED: the pane is created by the host layer; we only fill and wire it.
    const $pane = $('#rpg-tab-pane-status');
    if (!$pane.length) return;
    $pane.html(buildSettingsHtml());

    $('#rpg-enabled').prop('checked', settings.enabled).on('change', function () {
        settings.enabled = this.checked;
        saveSettings();
        updateContextInjection();
        if (this.checked) restoreStatusesOnLoad();
    });

    $('#rpg-language').val(settings.language).on('change', function () {
        settings.language = $(this).val();
        saveSettings();
        mountSettings();           // re-skin settings in the new language
        restoreStatusesOnLoad();   // re-render inline labels in the new language
    });

    $('#rpg-base-url').val(settings.baseUrl).on('input', function () { settings.baseUrl = $(this).val(); saveSettings(); });
    $('#rpg-api-key').val(settings.apiKey).on('input', function () { settings.apiKey = $(this).val(); saveSettings(); });
    $('#rpg-model').val(settings.model).on('input', function () { settings.model = $(this).val(); saveSettings(); });
    $('#rpg-freq').val(settings.updateFrequency).on('change', function () { settings.updateFrequency = Math.max(1, parseInt($(this).val()) || 5); $(this).val(settings.updateFrequency); saveSettings(); });
    $('#rpg-inject-depth').val(settings.injectDepth).on('change', function () { settings.injectDepth = Math.max(0, parseInt($(this).val()) || 0); $(this).val(settings.injectDepth); saveSettings(); updateContextInjection(); });
    $('#rpg-inject-context').prop('checked', settings.injectContext).on('change', function () { settings.injectContext = this.checked; saveSettings(); updateContextInjection(); });
    $('#rpg-influence').prop('checked', settings.influenceReply).on('change', function () { settings.influenceReply = this.checked; saveSettings(); updateContextInjection(); });
    $('#rpg-per-chat').prop('checked', settings.perChatProfiles).on('change', function () {
        settings.perChatProfiles = this.checked;
        saveSettings();
        renderDynamicStats();
        updateContextInjection();
    });

    $('#rpg-temperature').val(settings.temperature).on('input', function () {
        const val = parseFloat($(this).val());
        $('#rpg-temp-val').text(val);
        settings.temperature = val;
        saveSettings();
    });
    $('#rpg-temp-val').text(settings.temperature);

    renderDynamicStats();
}

/* ============================================================
   STATUS RECONCILIATION
   The status block sits right AFTER .mes_text (as its sibling). SillyTavern rebuilds .mes_text
   itself on swipes, edits, "continue", regex scripts and lazy printing — the block survives those
   now, but full message re-renders can still drop it while the data in msg.extra.rpg_status stays
   intact. A MutationObserver on #chat re-attaches every status a message has in its data but not
   in its DOM, which keeps rendering in sync without depending on any single event.
   ============================================================ */
let reconcileTimer = null;
function reconcileStatuses() {
    if (!settings.enabled) return;
    const chat = getContext().chat;
    if (!chat || !chat.length) return;
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
        const id = parseInt(el.getAttribute('mesid'), 10);
        if (isNaN(id)) return;
        const msg = chat[id];
        const data = msg && msg.extra && msg.extra.rpg_status;
        if (!data || typeof data !== 'object') return;
        Object.keys(data).forEach(charName => {
            if (!findStatusContainer(el, charName)) renderInlineStatus(id, charName, data[charName]);
        });
    });
}
function scheduleReconcile() { clearTimeout(reconcileTimer); reconcileTimer = setTimeout(reconcileStatuses, 150); }

let chatObserver = null;
function observeChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) { setTimeout(observeChat, 500); return; }   // ST hasn't built the chat pane yet
    if (chatObserver) chatObserver.disconnect();
    // childList only; re-attaching settles on the first pass, so the observer converges
    chatObserver = new MutationObserver(scheduleReconcile);
    chatObserver.observe(chatEl, { childList: true, subtree: true });
}

/* Group membership can change without a CHAT_CHANGED, so the stat editor's character list has
   to be rebuilt on group events as well. Rebuild only when the cast actually changed, otherwise
   redrawing would drop focus from a stat field being edited. */
let lastCastKey = '';
function refreshCastIfChanged(force) {
    const cast = getActiveCharacters().map(c => c.name).join('\u0001');
    if (!force && cast === lastCastKey) return;
    lastCastKey = cast;
    renderDynamicStats();
}

function restoreStatusesOnLoad() {
    if (!settings.enabled) return;
    const context = getContext();
    if (!context.chat) return;

    context.chat.forEach((msg, idx) => {
        if (msg.extra?.rpg_status) {
            for (const [charName, statsData] of Object.entries(msg.extra.rpg_status)) {
                renderInlineStatus(idx, charName, statsData);
            }
        }
    });
    updateContextInjection();
    scheduleReconcile();   // messages not yet printed are picked up by the observer
}
/* ---- what the Status Bar closure hands to the host ---- */
const SB_API = {
    settings: () => settings,
    loadSettings, pruneOldStates, mountSettings,
    updateContextInjection, observeChat, restoreStatusesOnLoad,
    scheduleReconcile, refreshCastIfChanged, processCharacterStatus, renderInlineStatus,
    resetCast: () => { lastCastKey = ''; }
};
return SB_API;
})();

/* ============================================================
   ENGINE 2 — TAVERN BONDS ENGINE
   ============================================================ */
const TBE = (function () {
// ============================================================
// TAVERN BONDS ENGINE
// Trait-driven relationship simulation. Every number is computed here, in JS.
// The main model never sees a stat table and never rolls anything: it receives
// a short, already-decided verdict in plain language. That is the whole point —
// a variable-dump costs 800-2000 tokens per turn and pushes the model out of
// prose mode into form-filling mode. This costs ~40-90.
// ============================================================

const MODULE_NAME = 'tavern_bonds_engine';
const KEY_PROFILE = 'tbe_profile';   // who she is + where the relationship stands
const KEY_VERDICT = 'tbe_verdict';   // what just happened (check result / initiative / conflict)
const KEY_PROSE = 'tbe_prose';       // writing guard, injected last

const defaultSettings = {
    enabled: false,
    baseUrl: '',                 // empty means: inherit a whole set from a sibling module
    apiKey: '',
    model: '',                   // empty means: take the RPG Engine's, or fall back to gemma
    temperature: 0.2,            // classification wants determinism, not flair
    language: 'en',
    injectDepth: 1,              // depth of the profile block; verdict always lands at 0
    autoProfile: true,           // build traits from the character card on first meeting
    classify: true,              // read player intent with the secondary model
    proseGuard: true,            // inject the NATURAL HUMAN PROSE rules
    intimacy: true,              // enable the physical-contact act family
    initiative: true,            // let partners act on their own
    initiativeRate: 100,         // percent multiplier on initiative chance
    initFemale: 100,             // per-gender trim on top, for authors who want it
    initMale: 100,
    difficulty: 100,             // percent multiplier on every DC
    pace: 100,                   // percent multiplier on how fast the relationship grows
    gmMode: false,
    debug: false,
    promptEvents: 2,             // how many remembered events reach the prompt
    defaultGender: 'f',          // used only when the card gives no pronouns to go on
    demotion: false,             // off by default: stages only ever went up before
    courtship: false,            // the wooing mode: warm gestures, not just moves
    courtshipRate: 180,          // percent multiplier on initiative while wooing
    charProse: false,            // OFF by default: read what the partner DID in their own reply
    charProseWeight: 40,         // percent of a full win credited for it — 40 matches the initiative echo
    pauseWhenSolo: true,         // stand still while the Map engine has the player wandering alone
    autoRoster: false,           // open a page for every card in the chat, not only for whoever speaks
    chatStates: {},
    chatStamps: {}
};

let settings = {};
let state = null;
let currentChatId = null;
let pendingChatId = null;
let stateReady = false;
// Suite convention: every module of the RPG set stores baseUrl / apiKey / model under
// its own key in extension_settings, and a module with empty fields borrows a WHOLE
// set from a neighbour. Whole set, never field by field — mixing one module's URL with
// another's key sends a credential for one provider to a different one, which fails in
// a way that is very hard to read. Nothing is copied: this is a read at request time,
// so removing a neighbour just brings back "no key".
const KEY_SOURCES = ['tavern_rpg_engine', 'rpg_status_bar', 'tavern_bonds_engine', 'rpg_phone', 'rpg_diary', 'rpg_map_engine', 'rpg_map', 'rpg_dungeons', 'rpg_codex', 'tavern_doors'];
const FALLBACK_URL = 'https://openrouter.ai/api/v1';

/* An address you typed always wins. Borrowing used to take the neighbour's URL and
   model along with the key whenever your own pair was incomplete — so pointing this
   at LM Studio or KoboldCpp and leaving the key blank (neither needs one) quietly
   sent every request somewhere else, and it looked like it was working. A local
   endpoint needs no key, so a placeholder is used rather than a borrowed one. */
function borrowedRaw() {
    for (const src of KEY_SOURCES) {
        if (src === MODULE_NAME) continue;
        try {
            const x = extension_settings[src];
            if (x && x.apiKey && x.model) return { url: x.baseUrl, key: x.apiKey, model: x.model, from: src };
        } catch (e) { /* a neighbour with broken settings must not break us */ }
    }
    return { url: '', key: '', model: '', from: null };
}

/* OpenAI-style backends live under /v1. Leave that off — "http://localhost:1234" —
   and the request goes to /chat/completions, which LM Studio and KoboldCpp answer
   with "Unexpected endpoint or method". The segment is added when the address has
   no version in it at all, so ".../api/v1" and ".../v1" are left exactly as typed. */
function normalizeBase(url) {
    let u = String(url || '').trim().replace(/\s+/g, '');
    if (!u) return u;
    u = u.replace(/\/+$/, '');
    u = u.replace(/\/(chat\/completions|completions|images|images\/generations|embeddings)$/i, '');
    if (!/\/v\d+($|\/)/i.test(u)) u += '/v1';
    return u;
}

function apiConf() {
    const own = String(settings.baseUrl || '').trim();
    const ownKey = String(settings.apiKey || '').trim();
    const ownModel = String(settings.model || '').trim();
    if (own) {
        const local = isLocalEndpoint(own);
        const b = (ownKey && ownModel) ? { key: '', model: '', from: null } : borrowedRaw();
        return {
            url: own,
            key: ownKey || (local ? 'local' : b.key),
            model: ownModel || (local ? '' : b.model),
            from: ownKey ? null : (local ? null : b.from)
        };
    }
    if (ownKey && ownModel) return { url: '', key: ownKey, model: ownModel, from: null };
    const b = borrowedRaw();
    return b.key ? b : { url: '', key: ownKey, model: ownModel, from: null };
}
function hasKey() { return !!apiConf().key; }
function borrowedFrom() { return apiConf().from; }

let classifyBusy = false;
let classifyFails = 0;
let classifyWarned = false;   // did we actually tell the player it had stopped?
let classifySkipUntil = 0;   // turn number to resume intent detection at

// ============================================================
// I18N
// ============================================================
const I18N = {
    en: {
        btn_bonds: 'Bonds',
        title_bonds: 'The Album',
        set_title: 'Bonds Engine (relationships)',
        set_enable: 'Enable module', set_lang: 'Language:',
        set_url: 'URL', set_key: 'API Key', set_model: 'Model',
        set_depth: 'Profile injection depth:',
        set_autoprofile: 'Build traits from the character card automatically',
        set_classify: 'Read player intent with the secondary model',
        set_prose: 'Inject the natural-prose writing rules',
        set_intimacy: 'Enable physical contact checks',
        set_initiative: 'Partners can act on their own',
        set_initrate: 'Initiative frequency:',
        set_initf: 'of that, female characters:', set_initm: 'of that, male characters:',
        hint_initgender: 'Traits already decide this — a shy card initiates about three times less often than a bold one, whatever its gender. Use these only if your stories want a thumb on the scale as well.',
        set_difficulty: 'Difficulty:',
        set_pace: 'Relationship pace:',
        hint_pace: 'Scales how fast warmth accumulates — gains only, damage is untouched. 100% is a long arc of several hundred messages to Girlfriend; 200% roughly halves it.',
        set_gm: 'GM / edit mode',
        gm_arch: 'Archetype:', gm_arch_card: 'GM: set the archetype by hand — traits are reset to match it',
        gm_arch_set: '{name} is now {arch}.',
        gm_gender: 'Gender:', g_f: 'Female', g_m: 'Male',
        set_defgender: 'Assume this gender when the card is unclear:',
        set_demotion: 'Let the relationship fall back a stage if it is neglected or abused',
        set_courtship: 'Courtship mode — partners actively woo you',
        set_courtrate: 'Courtship intensity:',
        set_charprose: 'Also read what the partner did in their own reply',
        set_charprosew: 'Credit for it:',
        hint_charprose: 'Off by default, and deliberately so. Everything else is decided before a single token is generated, which is what makes every swipe of a reply identical. This is the one thing that cannot be: it reads prose that already exists, so swiping re-reads it. The engine reverts the previous swipe before crediting the new one, no dice are rolled, no milestone or new tier can be reached this way, and a turn the partner already opened on their own is skipped so nothing is paid for twice. What it cannot prevent is you swiping until the model writes what you wanted. That is your business — but it is why this is a choice and not the default.',
        roster_add: 'Add someone by hand',
        roster_title: 'Who is in this story?',
        roster_group: 'In this group chat',
        roster_card: 'This chat',
        roster_all: 'All character cards',
        roster_note: 'Pages are attached to character cards. Pick a card and the engine reads the character from it and tracks it under that card, whatever the prose calls them.',
        roster_none: 'No character cards are loaded.',
        roster_nocard: 'No card named "{name}" is loaded.',
        roster_here: 'already has a page',
        roster_full: 'Six pages is the limit. Tear one out first.',
        roster_added: 'A page for {name} has been started.',
        roster_dupe: '{name} already has a page.',
        roster_nochat: 'Open a chat first.',
        roster_search: 'Search…',
        set_autoroster: 'Open a page for everyone in the chat, not only for whoever speaks',
        hint_autoroster: 'Off by default. With it on, every character card in the chat gets a page as soon as the chat opens — useful in group chats. It also decides which page starts out active, so leave it off if the current detection suits you.',
        set_solo: 'Stand still while I am exploring alone',
        hint_solo: 'While the Map engine has you wandering alone there is nobody in the scene, so nothing is rolled, nothing decays and nothing is injected. Everything resumes untouched the moment you come back.',
        toast_solo_on: 'Nobody around — relationships are on hold.',
        toast_solo_off: 'Back in company — relationships resume.',
        hint_courtship: 'Adds compliments, gifts, invitations and small attentions on top of the usual moves, and shifts the balance away from physical escalation toward being won over.',
        init_compliment: '{he} says something admiring, unprompted, and means it',
        init_gift: '{he} has brought {user} something — small, chosen, not an occasion',
        init_date: '{he} asks {user} out somewhere specific, and has clearly thought about it',
        init_remember: '{he} brings up something {user} said a while ago, showing {he} was listening',
        init_offer: '{he} makes it plain {he} would like the night to go further, and leaves the choice to {user}',
        p_courting: '{name} is courting {user} in earnest: {he} looks for reasons to show it rather than waiting to be approached.',
        toast_demote: '{name} no longer sees {user} the way {he} did.',
        ev_demote: 'the stretch when it all came apart',
        gm_gender_card: 'How the text should refer to this character:',
        set_debug: 'Log every turn to the browser console',
        set_events: 'Remembered events sent to the prompt:',
        milestones: 'Milestones', next_stage: 'What comes next',
        ms_confession: 'Confession', ms_first_sex: 'First night', ms_marriage: 'Marriage',
        ms_hint: 'Click to record that this happened in the story. Nothing is narrated — it only unlocks a stage.',
        ms_early: 'Recorded. It will only open a stage from "{stage}" onward.',
        ms_unlocks: 'unlocks {stage}',
        ms_asked: 'asked you — mark it if you said yes',
        gate_need: 'needs', gate_locked: 'not yet',
        warn_nokey: 'No API key — intent is never read, so no checks are rolled. Only the profile block is injected.',
        note_borrow: 'Empty — the key is taken from {src}. Fill in both key and model to use your own.',
        hint_keys: 'Leave empty and the key will be taken from Tavern RPG Engine / Phone / Diary / Map.',
        empty_h: 'No one in here yet',
        empty_p: 'Talk to someone. The first page writes itself.',
        no_profile: 'Reading her...',
        traits: 'Character', disp: 'Toward you', pulse: 'Right now', log: 'Recent checks',
        ceiling: 'ceiling',
        mood: 'Mood', arousal: 'Arousal', excitement: 'Excitement',
        trust: 'Trust', comfort: 'Comfort', attraction: 'Attraction', respect: 'Respect', affection: 'Affection',
        stage_stranger: 'Stranger', stage_acquaintance: 'Acquaintance', stage_friend: 'Friend',
        stage_close_friend: 'Close friend', stage_crush: 'Crush', stage_dating: 'Dating',
        stage_girlfriend: '{Boyfriend|Girlfriend}', stage_partner: 'Partner', stage_wife: '{Husband|Wife}',
        stage_fwb: 'Friends with benefits', stage_stable: 'Stable sex partner',
        act_flirt: 'Flirt', act_persuade: 'Persuasion', act_apologize: 'Apology', act_confess: 'Confession',
        act_reassure: 'Reassurance', act_boundary: 'Boundary push', act_propose: 'Proposal',
        act_touch: 'Incidental touch', act_hold: 'Sustained contact', act_kiss: 'Kiss',
        act_heated: 'Heated contact', act_sex: 'Sexual encounter',
        res_crit_success: 'CRITICAL SUCCESS', res_strong_success: 'STRONG SUCCESS', res_success: 'SUCCESS',
        res_fail: 'FAILURE', res_hard_fail: 'HARD FAILURE', res_crit_fail: 'CRITICAL FAILURE',
        toast_profile: 'A page for {name} has been started.',
        toast_profile_err: 'Could not read the character — check URL / key / model.',
        toast_stage: '{name}: {stage}.',
        toast_conflict: '{name} is angry with you.',
        toast_conflict_end: 'You made peace with {name}.',
        toast_walk: '{name} has had enough and walks away.',
        toast_reset: 'The page was torn out and rewritten.',
        toast_classify_off: 'The classifier is not answering — pausing intent detection for 10 turns.',
        toast_classify_on: 'The classifier is answering again.',
        btn_reroll: 'Rewrite the page', btn_forget: 'Tear out', btn_close: 'Close',
        gm_stage: 'Stage:', gm_hint: 'GM mode: click a bar to set a value.',
        // --- prompt-side vocabulary (this is what the main model actually reads) ---
        p_check: 'CHECK',
        p_vs: 'vs DC',
        p_stay_failed: 'The attempt failed. Write the refusal plainly — no hidden warmth, no "{he} secretly liked it", do not replay the moment.',
        p_stay_won: 'The attempt landed. Let her respond in kind, within her character.',
        p_crit_fail: 'It went badly wrong. {He} reacts sharply and the moment sours.',
        p_crit_win: 'It landed better than expected. {He} is visibly moved.',
        p_walk: '{name} is done with this. {He} ends the conversation and leaves.',
        p_conflict: '{name} is in conflict with {user}. Subject: {topic}. {He} {style}, and is {heat}.',
        heat_1: 'still keeping it contained', heat_2: 'letting {his} voice rise', heat_3: 'shouting now', heat_4: 'past listening to anything',
        p_conflict_end: 'The argument is over — {name} and {user} have made peace.',
        p_init: '{name} makes the first move: {what}. {He} starts it, unprompted.',
        p_stage_up: '{name} and {user} are now: {stage}.',
        p_remembers: 'She remembers',
        p_toward: 'Toward {user}',
        p_now: 'Now',
        init_flirt: '{he} flirts', init_plan: '{he} suggests something to do together',
        init_propose: '{he} asks {user} to marry {him}',
        init_confess: '{he} says how {he} feels and asks {user} what the two of them are', init_touch: '{he} closes the distance and touches {user}',
        init_heated: '{he} escalates the contact well past a kiss', init_sex: '{he} takes {user} to bed',
        init_mend: '{he} comes back with some small peace offering — a drink, a plate, something warm — and does not bring up what happened',
        init_kiss: '{he} kisses {user}', init_confront: '{he} brings up what is bothering {him}',
        ev_conflict: 'a fight about {topic} (settled)',
        ev_lapsed: 'a fight about {topic} that was never settled, only buried',
        toast_lapsed: '{name} has stopped bringing it up. It was never settled.',
        ev_confession: 'the night it was said out loud',
        ev_first_sex: 'the first night together',
        ev_marriage: 'the wedding',
        mem_good: '{act} — it went better than either of them expected',
        mem_bad: '{act} — it went badly and {he} has not forgotten',
        mem_g: 'Good memories', mem_b: 'Bad memories',
        p_good: 'Remembers fondly', p_bad: 'Has not forgotten',
        arch_label: 'Archetype',
        arch_pragmatist: 'The Pragmatist', arch_romantic: 'The Romantic', arch_firebrand: 'The Firebrand',
        arch_wallflower: 'The Wallflower', arch_guardian: 'The Guardian', arch_wanderer: 'The Wanderer',
        arch_ice: 'The Ice', arch_brat: 'The Brat', arch_scholar: 'The Scholar', arch_zealot: 'The Zealot',
        arch_seductress: 'The Seducer', arch_perfectionist: 'The Perfectionist', arch_nurturer: 'The Nurturer',
        arch_schemer: 'The Schemer', arch_drifter: 'The Drifter', arch_soldier: 'The Soldier',
        arch_innocent: 'The Innocent', arch_waif: 'The Waif', arch_dreamer: 'The Dreamer', arch_devotee: 'The Devotee',
        views: 'About the others'
    },
    ru: {
        btn_bonds: 'Связи',
        title_bonds: 'Альбом',
        set_title: 'Bonds Engine (отношения)',
        set_enable: 'Включить модуль', set_lang: 'Язык:',
        set_url: 'URL', set_key: 'API-ключ', set_model: 'Модель',
        set_depth: 'Глубина вставки профиля:',
        set_autoprofile: 'Собирать характер из карточки персонажа автоматически',
        set_classify: 'Определять намерение игрока вторичной моделью',
        set_prose: 'Вставлять правила живой прозы',
        set_intimacy: 'Включить проверки физического контакта',
        set_initiative: 'Партнёры могут действовать сами',
        set_initrate: 'Частота инициативы:',
        set_initf: 'из неё женским персонажам:', set_initm: 'из неё мужским персонажам:',
        hint_initgender: 'Это уже решают черты характера: застенчивая карточка проявляет инициативу втрое реже дерзкой, независимо от пола. Крути эти два только если хочешь дополнительно надавить на весы.',
        set_difficulty: 'Сложность:',
        set_pace: 'Темп отношений:',
        hint_pace: 'Ускоряет накопление тепла — только рост, урон не затрагивается. 100% — длинная дуга в несколько сотен сообщений до «девушки», 200% сокращает её примерно вдвое.',
        set_gm: 'GM / режим редактирования',
        gm_arch: 'Архетип:', gm_arch_card: 'ГМ: задать архетип вручную — черты подстроятся под него',
        gm_arch_set: '{name} теперь {arch}.',
        gm_gender: 'Пол:', g_f: 'Женский', g_m: 'Мужской',
        set_defgender: 'Пол по умолчанию, если по карточке не понять:',
        set_demotion: 'Позволять отношениям откатываться на стадию назад',
        set_courtship: 'Режим ухаживания — за тобой активно ухаживают',
        set_courtrate: 'Интенсивность ухаживания:',
        set_charprose: 'Читать и то, что партнёр сделал в своём ответе',
        set_charprosew: 'Засчитывать от полного успеха:',
        hint_charprose: 'По умолчанию выключено, и намеренно. Всё остальное в движке решается до генерации первого токена — именно поэтому свайпы одного ответа одинаковы. Здесь так не выйдет: читается уже написанная проза, значит свайп прочитает её заново. Движок откатывает предыдущий свайп перед начислением нового, кубик не бросается, веху или новую ступень близости так не получить, а ход, который партнёр и без того открыл сам, пропускается — чтобы одно и то же не оплатилось дважды. Чего он не может — помешать тебе свайпать, пока модель не напишет нужное. Это твоё дело, но именно поэтому здесь галка, а не поведение по умолчанию.',
        roster_add: 'Добавить вручную',
        roster_title: 'Кто участвует в этой истории?',
        roster_group: 'В этом групповом чате',
        roster_card: 'Этот чат',
        roster_all: 'Все карточки персонажей',
        roster_note: 'Страница привязывается к карточке персонажа. Выбери карточку — движок прочитает по ней характер и будет вести её под этой карточкой, как бы её ни называли в тексте.',
        roster_none: 'Карточек персонажей не загружено.',
        roster_nocard: 'Карточка с именем «{name}» не загружена.',
        roster_here: 'страница уже есть',
        roster_full: 'Шесть страниц — предел. Сначала вырви одну.',
        roster_added: 'Заведена страница на {name}.',
        roster_dupe: 'На {name} страница уже есть.',
        roster_nochat: 'Сначала открой чат.',
        roster_search: 'Поиск…',
        set_autoroster: 'Заводить страницу на всех в чате, а не только на говорящих',
        hint_autoroster: 'По умолчанию выключено. Со включённым каждая карточка персонажа в чате получает страницу сразу при открытии — удобно в групповых чатах. Заодно меняется, чья страница окажется активной, поэтому если текущий подхват тебя устраивает — не включай.',
        set_solo: 'Замирать, пока я брожу в одиночку',
        hint_solo: 'Пока карта держит тебя в одиночном исследовании, в сцене никого нет: броски не делаются, пульс не затухает, в промпт ничего не уходит. Всё возобновляется ровно с того места, где остановилось.',
        toast_solo_on: 'Рядом никого — отношения поставлены на паузу.',
        toast_solo_off: 'Ты снова не один(а) — отношения возобновлены.',
        hint_courtship: 'Добавляет комплименты, подарки, приглашения и мелкие знаки внимания поверх обычных действий и смещает баланс от физического напора к тому, чтобы тебя завоёвывали.',
        init_compliment: 'говорит что-то восхищённое, без повода, и говорит это всерьёз',
        init_gift: 'принёс{|ла} {user} что-то — небольшое, выбранное, не к празднику',
        init_date: 'зовёт {user} в конкретное место и явно об этом думал{|а} заранее',
        init_remember: 'вспоминает давние слова {user} — значит, слушал{|а}',
        init_offer: 'даёт понять, что хотел{|а} бы продолжения ночи, и оставляет выбор за {user}',
        p_courting: '{name} всерьёз ухаживает за {user}: ищет поводы это показать, а не ждёт, пока подойдут.',
        toast_demote: '{name} больше не смотрит на {user} как раньше.',
        ev_demote: 'время, когда всё развалилось',
        gm_gender_card: 'Как о персонаже писать:',
        set_debug: 'Писать каждый ход в консоль браузера',
        set_events: 'Событий памяти в промпт:',
        milestones: 'Вехи', next_stage: 'Что дальше',
        ms_confession: 'Признание', ms_first_sex: 'Первая ночь', ms_marriage: 'Свадьба',
        ms_hint: 'Клик отмечает, что это произошло в истории. В текст ничего не попадёт — веха только открывает стадию.',
        ms_early: 'Отмечено. Стадию это откроет только начиная с «{stage}».',
        ms_unlocks: 'открывает: {stage}',
        ms_asked: 'он(а) сделал(а) шаг — отметь, если ты согласилась',
        gate_need: 'нужно', gate_locked: 'ещё нет',
        warn_nokey: 'Нет API-ключа — намерение не читается, броски не делаются. В промпт уходит только блок профиля.',
        note_borrow: 'Пусто — ключ берётся из {src}. Заполни ключ и модель, чтобы использовать свои.',
        hint_keys: 'Пусто — возьмётся ключ из Tavern RPG Engine / Телефона / Дневника / Карты.',
        empty_h: 'Здесь пока пусто',
        empty_p: 'Поговори с кем-нибудь. Первая страница напишется сама.',
        no_profile: 'Присматриваюсь к ней...',
        traits: 'Характер', disp: 'К тебе', pulse: 'Сейчас', log: 'Последние проверки',
        ceiling: 'потолок',
        mood: 'Настроение', arousal: 'Возбуждение', excitement: 'Азарт',
        trust: 'Доверие', comfort: 'Комфорт', attraction: 'Влечение', respect: 'Уважение', affection: 'Привязанность',
        stage_stranger: 'Незнаком{ец|ка}', stage_acquaintance: 'Знаком{ый|ая}', stage_friend: '{Друг|Подруга}',
        stage_close_friend: 'Близк{ий друг|ая подруга}', stage_crush: 'Влюблённость', stage_dating: 'Встречаются',
        stage_girlfriend: '{Парень|Девушка}', stage_partner: 'Спутни{к|ца}', stage_wife: '{Муж|Жена}',
        stage_fwb: 'Друзья с привилегиями', stage_stable: 'Постоянн{ый любовник|ая любовница}',
        act_flirt: 'Флирт', act_persuade: 'Уговоры', act_apologize: 'Извинение', act_confess: 'Признание',
        act_reassure: 'Успокоить', act_boundary: 'Продавливание границы', act_propose: 'Предложение руки',
        act_touch: 'Мимолётное касание', act_hold: 'Долгий контакт', act_kiss: 'Поцелуй',
        act_heated: 'Жаркий контакт', act_sex: 'Близость',
        res_crit_success: 'КРИТИЧЕСКИЙ УСПЕХ', res_strong_success: 'УВЕРЕННЫЙ УСПЕХ', res_success: 'УСПЕХ',
        res_fail: 'ПРОВАЛ', res_hard_fail: 'ТЯЖЁЛЫЙ ПРОВАЛ', res_crit_fail: 'КРИТИЧЕСКИЙ ПРОВАЛ',
        toast_profile: 'Заведена страница на {name}.',
        toast_profile_err: 'Не удалось прочитать персонажа — проверь URL / ключ / модель.',
        toast_stage: '{name}: {stage}.',
        toast_conflict: '{name} злится на тебя.',
        toast_conflict_end: 'Вы помирились с {name}.',
        toast_walk: '{name} не выдержала и ушла.',
        toast_reset: 'Страница вырвана и переписана.',
        toast_classify_off: 'Классификатор не отвечает — пропускаю определение действий на 10 ходов.',
        toast_classify_on: 'Классификатор снова отвечает.',
        btn_reroll: 'Переписать страницу', btn_forget: 'Вырвать', btn_close: 'Закрыть',
        gm_stage: 'Стадия:', gm_hint: 'GM-режим: кликни по полосе, чтобы задать значение.',
        p_check: 'ПРОВЕРКА',
        p_vs: 'против DC',
        p_stay_failed: 'Попытка провалена. Пиши отказ прямо — без скрытой симпатии, без «на самом деле {ему|ей} понравилось», не переигрывай этот момент.',
        p_stay_won: 'Попытка удалась. Пусть ответит взаимностью — в рамках своего характера.',
        p_crit_fail: 'Вышло совсем плохо. {Он|Она} реагирует резко, момент испорчен.',
        p_crit_win: 'Вышло лучше, чем можно было ждать. {Его|Её} это заметно тронуло.',
        p_walk: '{name} сыт{|а} этим по горло. Обрывает разговор и уходит.',
        p_conflict: '{name} в ссоре с {user}. Из-за чего: {topic}. {Он|Она} {style}, и {heat}.',
        heat_1: 'пока держит себя в руках', heat_2: 'говорит всё резче', heat_3: 'уже кричит', heat_4: 'себя не слышит',
        p_conflict_end: 'Ссора окончена — {name} и {user} помирились.',
        p_init: '{name} делает первый шаг: {what}. Начинает {он|она}, без просьбы.',
        p_stage_up: '{name} и {user} теперь: {stage}.',
        p_remembers: 'Помнит',
        p_toward: 'К {user}',
        p_now: 'Сейчас',
        init_flirt: 'флиртует', init_plan: 'предлагает провести время вместе',
        init_propose: 'делает {user} предложение',
        init_confess: 'говорит о своих чувствах и спрашивает, что между вами', init_touch: 'сокращает расстояние и касается {user}',
        init_heated: 'заходит намного дальше поцелуя', init_sex: 'уводит {user} в постель',
        init_mend: 'возвращается с чем-то мирным — чаем, тарелкой, чем-то тёплым — и о случившемся не заговаривает',
        init_kiss: 'целует {user}', init_confront: 'заводит разговор о том, что {его|её} грызёт',
        ev_conflict: 'ссора из-за «{topic}» (улажена)',
        ev_lapsed: 'ссора из-за «{topic}», которую так и не уладили — просто замяли',
        toast_lapsed: '{name} перестал{|а} об этом заговаривать. Но ничего не улажено.',
        ev_confession: 'вечер признания',
        ev_first_sex: 'первая ночь вместе',
        ev_marriage: 'свадьба',
        mem_good: '{act} — вышло лучше, чем оба ждали',
        mem_bad: '{act} — вышло скверно, и это не забылось',
        mem_g: 'Хорошее', mem_b: 'Плохое',
        p_good: 'Хорошо помнит', p_bad: 'Не забыл{|а}',
        arch_label: 'Архетип',
        arch_pragmatist: 'Прагматик', arch_romantic: 'Романтик', arch_firebrand: 'Порох',
        arch_wallflower: 'Тихоня', arch_guardian: 'Опора', arch_wanderer: 'Бродяга',
        arch_ice: 'Лёд', arch_brat: 'Заноза', arch_scholar: 'Книжник', arch_zealot: 'Фанатик',
        arch_seductress: 'Соблазнитель{|ница}', arch_perfectionist: 'Педант', arch_nurturer: 'Опекун',
        arch_schemer: 'Интриган{|ка}', arch_drifter: 'Скитал{ец|ица}', arch_soldier: 'Солдат',
        arch_innocent: 'Простодуш{ный|ная}', arch_waif: 'Сирота', arch_dreamer: 'Мечтатель{|ница}',
        arch_devotee: 'Преданн{ый|ая}',
        views: 'О других'
    }
};

function t(key, vars) {
    const lang = settings.language === 'ru' ? 'ru' : 'en';
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
}

// ============================================================
// SMALL UTILITIES
// ============================================================
function escapeHtml(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function num(x, fb = 0) { return Number.isFinite(+x) ? +x : fb; }
function d20() { return Math.floor(Math.random() * 20) + 1; }
function genId() { return Math.random().toString(36).slice(2, 11); }
function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }
function userName() { try { return getContext().name1 || '{{user}}'; } catch (e) { return '{{user}}'; } }
// The model sometimes returns junk instead of a name (-1, "null", bare numbers).
function aiName(x, fallback = null, maxLen = 48) {
    const s = String(x == null ? '' : x).trim();
    if (s.length < 2 || !/\p{L}/u.test(s)) return fallback;
    if (/^(null|undefined|n\/?a|none|нет|-?\d+)$/i.test(s)) return fallback;
    return s.slice(0, maxLen);
}
// Names arrive from three places (card, group roster, classifier) with different
// casing and punctuation, so they are matched through one normalised key.
function nameKey(n) {
    return String(n || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// ============================================================
// TRAITS — the permanent ceiling. Generated once, never edited by the story.
// ============================================================
const TRAITS = ['dominance', 'confidence', 'shyness', 'patience', 'curiosity', 'stability', 'impulse', 'propriety'];

const ARCHETYPES = {
    pragmatist: { dominance: 60, confidence: 65, shyness: 35, patience: 55, curiosity: 45, stability: 70, impulse: 30, propriety: 60 },
    romantic: { dominance: 40, confidence: 45, shyness: 55, patience: 60, curiosity: 65, stability: 45, impulse: 60, propriety: 45 },
    firebrand: { dominance: 75, confidence: 75, shyness: 20, patience: 25, curiosity: 60, stability: 35, impulse: 80, propriety: 25 },
    wallflower: { dominance: 25, confidence: 30, shyness: 80, patience: 65, curiosity: 55, stability: 50, impulse: 25, propriety: 70 },
    guardian: { dominance: 65, confidence: 70, shyness: 30, patience: 75, curiosity: 40, stability: 80, impulse: 25, propriety: 65 },
    wanderer: { dominance: 45, confidence: 60, shyness: 35, patience: 40, curiosity: 85, stability: 55, impulse: 70, propriety: 25 },
    ice: { dominance: 60, confidence: 65, shyness: 60, patience: 70, curiosity: 35, stability: 75, impulse: 20, propriety: 80 },
    brat: { dominance: 55, confidence: 50, shyness: 30, patience: 20, curiosity: 70, stability: 30, impulse: 75, propriety: 30 },
    scholar: { dominance: 35, confidence: 55, shyness: 55, patience: 80, curiosity: 95, stability: 65, impulse: 20, propriety: 70 },
    soldier: { dominance: 80, confidence: 80, shyness: 55, patience: 55, curiosity: 20, stability: 90, impulse: 20, propriety: 75 },
    nurturer: { dominance: 30, confidence: 55, shyness: 40, patience: 90, curiosity: 45, stability: 75, impulse: 30, propriety: 55 },
    perfectionist: { dominance: 60, confidence: 70, shyness: 45, patience: 25, curiosity: 50, stability: 55, impulse: 15, propriety: 85 },
    dreamer: { dominance: 25, confidence: 35, shyness: 60, patience: 55, curiosity: 90, stability: 35, impulse: 70, propriety: 40 },
    innocent: { dominance: 20, confidence: 30, shyness: 75, patience: 70, curiosity: 80, stability: 55, impulse: 40, propriety: 90 },
    seductress: { dominance: 75, confidence: 85, shyness: 10, patience: 55, curiosity: 55, stability: 65, impulse: 65, propriety: 15 },
    waif: { dominance: 15, confidence: 25, shyness: 85, patience: 60, curiosity: 50, stability: 25, impulse: 45, propriety: 60 },
    schemer: { dominance: 65, confidence: 75, shyness: 35, patience: 85, curiosity: 70, stability: 70, impulse: 20, propriety: 40 },
    zealot: { dominance: 70, confidence: 85, shyness: 30, patience: 35, curiosity: 25, stability: 50, impulse: 60, propriety: 80 },
    drifter: { dominance: 30, confidence: 45, shyness: 45, patience: 35, curiosity: 80, stability: 25, impulse: 75, propriety: 15 },
    devotee: { dominance: 20, confidence: 40, shyness: 55, patience: 80, curiosity: 40, stability: 60, impulse: 45, propriety: 65 }
};

/* The order the GM picker lists them in — read from the table above rather than
   written out a second time, so a new archetype shows up in the list simply by
   existing. */
const ARCH_ORDER = Object.keys(ARCHETYPES);

// Traits are exported to the prompt as adjectives, never as numbers. A model writes
// far better prose from "impatient, used to giving orders" than from "Patience: 22",
// and the phrase costs about a third of what the label-plus-number pair costs.
const TRAIT_WORDS = {
    en: {
        dominance: ['defers to others', 'used to giving orders'],
        confidence: ['unsure of {self}', 'self-assured'],
        shyness: ['forward, unembarrassed', 'shy, slow to open up'],
        patience: ['impatient', 'patient'],
        curiosity: ['incurious, set in {his} ways', 'endlessly curious'],
        stability: ['volatile, takes things hard', 'even-tempered'],
        impulse: ['deliberate, thinks first', 'impulsive'],
        propriety: ['careless about propriety', 'proper, keeps things decent']
    },
    ru: {
        dominance: ['уступает другим', 'привык{|ла} командовать'],
        confidence: ['не уверен{|а} в себе', 'уверен{|а} в себе'],
        shyness: ['раскованн{ый|ая}, не смущается', 'застенчив{|а}, раскрывается медленно'],
        patience: ['нетерпелив{|а}', 'терпелив{|а}'],
        curiosity: ['нелюбопытн{ый|ая}, живёт по накатанной', 'до всего любопыт{ен|на}'],
        stability: ['вспыльчив{|а}, всё принимает близко', 'ровн{ый|ая}, трудно вывести'],
        impulse: ['сначала думает, потом делает', 'импульсив{ен|на}'],
        propriety: ['плевать на приличия', 'блюдёт приличия']
    }
};

// ============================================================
// DISPOSITIONS — move with the story, but can never pass the ceiling the traits set.
// This is what makes personality unbreakable: no amount of grinding turns a cold,
// closed character into a warm open one, it only fills her own range.
// ============================================================
const DISPS = ['trust', 'comfort', 'attraction', 'respect', 'affection'];

function dispCap(tr) {
    return {
        trust: clamp(52 + tr.stability * 0.3 + tr.curiosity * 0.12, 35, 100),
        comfort: clamp(48 + (100 - tr.shyness) * 0.35 + tr.patience * 0.14, 35, 100),
        attraction: clamp(58 + tr.confidence * 0.2 + tr.impulse * 0.18, 40, 100),
        respect: clamp(46 + tr.confidence * 0.26 + tr.patience * 0.26, 35, 100),
        affection: clamp(52 + tr.stability * 0.16 + tr.curiosity * 0.2 + (100 - tr.propriety) * 0.1, 40, 100)
    };
}

const DISP_WORDS = {
    en: {
        trust: ['guarded', 'trusting'],
        comfort: ['tense', 'at ease'],
        attraction: ['unmoved', 'strongly drawn'],
        respect: ['dismissive', 'respectful'],
        affection: ['indifferent', 'attached']
    },
    ru: {
        trust: ['держит дистанцию', 'доверяет'],
        comfort: ['напряж{ён|ена} рядом', '{ему|ей} рядом спокойно'],
        attraction: ['равнодуш{ен|на}', '{его|её} тянет'],
        respect: ['невысокого мнения', 'уважает'],
        affection: ['{ему|ей} всё равно', 'привязан{|а}']
    }
};

// What one partner thinks of another. Nobody is told about anyone they have never
// shared a scene with: regard only moves when they were both present for something.
const VIEW_WORDS = {
    en: [[-101, -60, '{other} is someone {he} cannot stand'], [-60, -25, '{other} is someone {he} is jealous of'],
         [25, 60, '{other} is someone {he} gets on with'], [60, 101, '{other} is someone {he} is close to']],
    // Names are inserted as-is and Russian would need them declined, so each phrase is
    // built with the other person as the subject, where the nominative is correct.
    ru: [[-101, -60, '{other} {ему|ей} поперёк горла'], [-60, -25, '{other} {ему|ей} мешает'],
         [25, 60, '{other} {ему|ей} по душе'], [60, 101, '{other} {ему|ей} по-настоящему дорог[|а]']]
};

// The second marker set, resolved against whoever the opinion is ABOUT.
function oform(str, gender) {
    const female = gender !== 'm';
    return String(str || '').replace(/\[([^\[\]|]*)\|([^\[\]|]*)\]/g, (_, m, f) => (female ? f : m));
}

function viewPhrases(npc, present, limit = 2) {
    const bands = VIEW_WORDS[lang()];
    const out = [];
    for (const other of present) {
        if (other.key === npc.key) continue;
        const v = num(npc.views && npc.views[other.key], 0);
        for (const [lo, hi, w] of bands) {
            if (v > lo && v <= hi) {
                out.push(oform(gform(w.split('{other}').join(other.name), npc.gender), other.gender));
                break;
            }
        }
        if (out.length >= limit) break;
    }
    return out;
}

const MOOD_WORDS = {
    en: [[0, 20, 'wretched'], [20, 38, 'low'], [38, 62, 'level'], [62, 82, 'in good spirits'], [82, 101, 'radiant']],
    ru: [[0, 20, 'разбит{|а}'], [20, 38, 'подавлен{|а}'], [38, 62, 'ровно'], [62, 82, 'в духе'], [82, 101, 'сияет']]
};

// Russian needs a masculine and a feminine form of almost every adjective, so
// every gendered string is written once as "ровн{ый|ая}" and resolved here.
// English mostly needs pronouns, which go through the same markers.
function gform(str, gender) {
    const female = gender !== 'm';
    return String(str || '')
        .replace(/\{user\}/g, userName())
        .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (female ? f : m))
        .replace(/\{his\}/g, female ? 'her' : 'his')
        .replace(/\{he\}/g, female ? 'she' : 'he')
        .replace(/\{He\}/g, female ? 'She' : 'He')
        .replace(/\{him\}/g, female ? 'her' : 'him')
        .replace(/\{self\}/g, female ? 'herself' : 'himself');
}

// ============================================================
// ACTS — everything the player can attempt, and what it costs to land.
// ============================================================
const ACTS = {
    flirt: { base: 11, kind: 'social' },
    persuade: { base: 12, kind: 'social' },
    apologize: { base: 10, kind: 'social' },
    confess: { base: 16, kind: 'social', milestone: 'confession' },
    propose: { base: 18, kind: 'social', milestone: 'marriage' },
    reassure: { base: 11, kind: 'social' },
    boundary: { base: 16, kind: 'social', hostile: true },
    touch: { base: 8, kind: 'intimacy', tier: 1 },
    hold: { base: 11, kind: 'intimacy', tier: 2 },
    kiss: { base: 14, kind: 'intimacy', tier: 3 },
    heated: { base: 17, kind: 'intimacy', tier: 4 },
    sex: { base: 19, kind: 'intimacy', tier: 5, milestone: 'first_sex' }
};

// ============================================================
// STAGES — the romantic ladder plus the intimate branch. Every gate is a
// threshold test, and the ones that mark a decision need a story milestone too:
// you cannot arithmetic your way into being someone's girlfriend.
// ============================================================
const STAGE_ORDER = ['stranger', 'acquaintance', 'friend', 'close_friend', 'crush', 'dating', 'girlfriend', 'partner', 'wife'];
const GATES = [
    { to: 'acquaintance', from: ['stranger'], need: { affection: 12 } },
    { to: 'friend', from: ['acquaintance'], need: { affection: 30, trust: 25 } },
    { to: 'close_friend', from: ['friend'], need: { affection: 45, trust: 45, comfort: 40 } },
    { to: 'crush', from: ['close_friend'], need: { affection: 55, attraction: 50 } },
    { to: 'dating', from: ['crush', 'fwb', 'stable'], need: { affection: 55, attraction: 55 }, milestone: 'confession' },
    { to: 'girlfriend', from: ['dating'], need: { affection: 55, trust: 55, comfort: 50 } },
    { to: 'partner', from: ['girlfriend'], need: { affection: 70, trust: 70, respect: 65 } },
    { to: 'wife', from: ['partner'], need: { affection: 75, trust: 75 }, milestone: 'marriage' },
    { to: 'fwb', from: ['friend', 'close_friend'], need: { attraction: 55, comfort: 50 }, milestone: 'first_sex' },
    { to: 'stable', from: ['fwb'], need: { attraction: 65, comfort: 60, trust: 50 } }
];
// How much the standing itself smooths the way. Social checks barely care;
// physical ones care a great deal, which is what keeps a kiss from a stranger hard
// and a kiss from a wife trivial without ever forbidding either.
const STAGE_SOCIAL = { stranger: 0, acquaintance: 0.5, friend: 1, close_friend: 1.5, crush: 2, dating: 2.5, girlfriend: 3, partner: 3.5, wife: 4, fwb: 1.5, stable: 2 };
const STAGE_PHYS = { stranger: 0, acquaintance: 1, friend: 2, close_friend: 3, crush: 4, dating: 5, girlfriend: 6, partner: 7, wife: 8, fwb: 6, stable: 7 };

// ============================================================
// STATE — same shape of persistence as the RPG Engine: the live copy lives in
// settings under the chat id, and a snapshot is written into the last message so
// branching or a group conversion does not lose the relationship.
// ============================================================
function freshState() {
    return { npcs: {}, active: null, turn: 0, lastReplyTurn: -1, verdict: null, soloPaused: false, dismissed: {}, proseLog: {}, version: 1 };
}

function freshNpc(name, traits, archetype) {
    const tr = traits || clone(ARCHETYPES.pragmatist);
    return {
        key: nameKey(name), name: name,
        gender: (settings.defaultGender === 'm' ? 'm' : 'f'),
        archetype: archetype || 'pragmatist',
        traits: tr,
        disp: { trust: 10, comfort: 12, attraction: 8, respect: 15, affection: 5 },
        pulse: { mood: 55, arousal: 5, excitement: 20 },
        stage: 'stranger',
        milestones: {},
        events: [],
        good: [],
        bad: [],
        views: {},
        log: [],
        maxTier: 0,
        conflict: null,
        failStreak: 0,
        grace: 0,
        cooldown: 0,
        lastAct: null,
        lastActTurn: -99,
        pendingInit: null,
        profiled: false,
        lastSeenTurn: -99,
        seen: 0
    };
}

function sanitizeNpc(n) {
    if (!n || typeof n !== 'object') return null;
    if (!n.name) return null;
    n.key = n.key || nameKey(n.name);
    if (n.gender !== 'm' && n.gender !== 'f') n.gender = settings.defaultGender === 'm' ? 'm' : 'f';
    n.traits = Object.assign(clone(ARCHETYPES.pragmatist), n.traits || {});
    for (const k of TRAITS) n.traits[k] = clamp(num(n.traits[k], 50), 0, 100);
    n.disp = Object.assign({ trust: 10, comfort: 12, attraction: 8, respect: 15, affection: 5 }, n.disp || {});
    for (const k of DISPS) n.disp[k] = clamp(num(n.disp[k], 10), 0, 100);
    n.pulse = Object.assign({ mood: 55, arousal: 5, excitement: 20 }, n.pulse || {});
    for (const k of ['mood', 'arousal', 'excitement']) n.pulse[k] = clamp(num(n.pulse[k], 50), 0, 100);
    if (!STAGE_ORDER.includes(n.stage) && n.stage !== 'fwb' && n.stage !== 'stable') n.stage = 'stranger';
    if (!Array.isArray(n.log)) n.log = [];
    if (!Array.isArray(n.events)) n.events = [];
    if (!Array.isArray(n.good)) n.good = [];
    if (!Array.isArray(n.bad)) n.bad = [];
    if (!n.views || typeof n.views !== 'object') n.views = {};
    for (const k of Object.keys(n.views)) {
        const v = num(n.views[k], 0);
        if (!v) delete n.views[k]; else n.views[k] = clamp(v, -100, 100);
    }
    n.good = n.good.slice(-5);
    n.bad = n.bad.slice(-5);
    if (!n.milestones || typeof n.milestones !== 'object') n.milestones = {};
    n.log = n.log.slice(-12);
    n.events = n.events.slice(-10);
    n.maxTier = clamp(num(n.maxTier, 0), 0, 5);
    n.grace = clamp(num(n.grace, 0), 0, 3);
    n.failStreak = clamp(num(n.failStreak, 0), 0, 9);
    n.cooldown = clamp(num(n.cooldown, 0), 0, 9);
    n.pinned = !!n.pinned;
    n.avatar = (typeof n.avatar === 'string' && n.avatar) ? n.avatar : null;
    return n;
}

function sanitizeState(s) {
    if (!s || typeof s !== 'object') return freshState();
    if (!s.npcs || typeof s.npcs !== 'object') s.npcs = {};
    for (const k of Object.keys(s.npcs)) {
        const n = sanitizeNpc(s.npcs[k]);
        if (!n) delete s.npcs[k]; else s.npcs[k] = n;
    }
    // Group chats stay small on purpose: four pages of context is the point where
    // the profile block stops being cheap. The least-seen page is dropped first.
    const keys = Object.keys(s.npcs);
    if (keys.length > 6) {
        // Least-seen goes first, but a page added by hand is never the thing to drop:
        // the player asked for it, and losing it silently on the next load is worse
        // than carrying one page more than the auto-detection would have kept.
        // Original rule: least-seen goes first. Pinned only breaks a tie, so a page
        // added by hand is not favoured over one the story actually earned.
        keys.sort((a, b) => (num(s.npcs[a].seen) - num(s.npcs[b].seen)) || (num(s.npcs[a].pinned ? 1 : 0) - num(s.npcs[b].pinned ? 1 : 0)));
        for (const k of keys.slice(0, keys.length - 6)) delete s.npcs[k];
    }
    s.turn = num(s.turn, 0);
    s.soloPaused = !!s.soloPaused;
    if (!s.dismissed || typeof s.dismissed !== 'object') s.dismissed = {};
    if (!s.npcs[s.active]) s.active = Object.keys(s.npcs)[0] || null;
    return s;
}

function ownsChat(id) { return !!(stateReady && id && currentChatId === id && getContext().chatId === id); }

function loadSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    if (!settings.chatStates) settings.chatStates = {};
    if (!settings.chatStamps) settings.chatStamps = {};
    for (const k of ['injectDepth', 'initiativeRate', 'difficulty']) {
        if (!Number.isFinite(settings[k])) settings[k] = defaultSettings[k];
    }
}

const STATE_TTL_MS = 60 * 24 * 60 * 60 * 1000;
function pruneOldStates() {
    const now = Date.now();
    let changed = false;
    for (const id of Object.keys(settings.chatStates)) {
        if (!settings.chatStamps[id]) { settings.chatStamps[id] = now; changed = true; continue; }
        if (now - settings.chatStamps[id] > STATE_TTL_MS) {
            delete settings.chatStates[id]; delete settings.chatStamps[id]; changed = true;
        }
    }
    for (const id of Object.keys(settings.chatStamps)) {
        if (!settings.chatStates[id]) { delete settings.chatStamps[id]; changed = true; }
    }
    if (changed) saveSettings();
}

function saveSettings(immediate = true) {
    extension_settings[MODULE_NAME] = settings;
    if (immediate && typeof stSaveSettings === 'function') {
        try { const p = stSaveSettings(); if (p && typeof p.catch === 'function') p.catch(() => { }); return; }
        catch (e) { /* fall through to debounced */ }
    }
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
}

function loadState(explicitId) {
    const context = getContext();
    const chatId = explicitId || pendingChatId || context.chatId;
    if (!chatId) {
        currentChatId = null; pendingChatId = null; stateReady = false;
        state = freshState();
        return;
    }
    currentChatId = chatId; pendingChatId = null; stateReady = true;
    settings.chatStamps[chatId] = Date.now();

    if (settings.chatStates[chatId]) {
        state = sanitizeState(settings.chatStates[chatId]);
        settings.chatStates[chatId] = state;
    } else {
        let restored = false;
        const chat = context.chat;
        if (chat && chat.length > 1) {
            for (let i = chat.length - 1; i >= 0; i--) {
                const cp = chat[i].extra && chat[i].extra.tbe_checkpoint;
                if (cp) {
                    state = sanitizeState(clone(cp));
                    settings.chatStates[chatId] = state;
                    saveSettings();
                    restored = true;
                    break;
                }
            }
        }
        if (!restored) { state = freshState(); settings.chatStates[chatId] = state; }
    }
    registerChatCards();
    updateInjections();
    renderAlbum();
}

// Everyone whose card is in this chat gets a page, on open, without waiting for them
// to speak. This is what "it does not always pick characters up" was: detection ran
// off the classifier's target and off whoever happened to talk, so a group member who
// had not said anything yet simply did not exist to the engine.
function registerChatCards() {
    // OFF by default. The original detection — the classifier's target, plus whoever
    // actually speaks — is the tuned behaviour and stays the default. This only adds
    // a shortcut for group chats where a member has not spoken yet, and it changes
    // which page starts out active, which is why it is not switched on for anyone
    // who did not ask for it.
    if (!settings.autoRoster) return;
    try {
        for (const c of chatCards()) {
            if (Object.keys(state.npcs).length >= ROSTER_MAX) break;
            const nm = aiName(c.name);
            if (!nm) continue;
            // Torn out on purpose stays torn out. Re-adding it on every chat load
            // would make the button useless.
            if (state.dismissed && state.dismissed[nameKey(nm)]) continue;
            const npc = ensureNpc(nm);
            // ensureNpc counts a sighting; opening a chat is not one.
            if (npc) npc.seen = Math.max(0, num(npc.seen, 1) - 1);
        }
    } catch (e) { console.warn('[Bonds] could not register the chat cards:', e); }
}

function saveState(immediate = false) {
    if (!stateReady || !currentChatId) return;
    const context = getContext();
    if (context.chatId && context.chatId !== currentChatId) return;
    settings.chatStates[currentChatId] = state;
    settings.chatStamps[currentChatId] = Date.now();
    saveSettings(immediate);
    const chat = context.chat;
    if (chat && chat.length > 0) {
        const last = chat[chat.length - 1];
        if (!last.extra) last.extra = {};
        last.extra.tbe_checkpoint = clone(state);
        saveChatDebounced();
    }
}

// ============================================================
// SECONDARY MODEL — used for exactly two things: reading a character card once,
// and classifying what the player just attempted. Never for arithmetic.
// ============================================================

/* ------------------------------------------------------------
   STRICT JSON MODE
   response_format is an OpenAI parameter, not a standard one. KoboldCpp turns it
   into a grammar constraint that forbids anything but an object — a model that
   opens with "[" then cannot finish and bails out with EOS after a few tokens.
   Local backends therefore do not get it. Nothing is lost: the reply is pulled out
   with a regex that finds the first object in any text, preamble or code fence
   included, which is why the request works without the parameter at all.
   ------------------------------------------------------------ */
function isLocalEndpoint(url) {
    const u = String(url || '').toLowerCase();
    if (!u) return false;
    return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)([:/]|$)/.test(u)
        || /:(5001|5000|8080|8000|1234|11434|5002)(\/|$)/.test(u)          // kobold, ooba, lm studio, ollama
        || /192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./.test(u);   // the local network
}
function wantsStrictJson(url) {
    if (settings.strictJson === false) return false;      // switched off by hand
    return !isLocalEndpoint(url);
}

async function callAI(systemPrompt, userPrompt, maxTokens = 400) {
    const c = apiConf();
    if (!c.key) throw new Error('no-key');            // distinct error: the caller says "set a key", not "try again"
    const url = (normalizeBase(c.url) || FALLBACK_URL) + '/chat/completions';
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${c.key.trim()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: c.model,
                    max_completion_tokens: maxTokens,   // proxies disagree on the name; send both
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                    temperature: settings.temperature,
                    max_tokens: maxTokens,
                    ...(wantsStrictJson(url) ? { response_format: { type: 'json_object' } } : {})
                })
            });
            if (response.status === 429 && i === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            const content = (data.choices?.[0]?.message?.content || '').trim();
            const parsed = parseLenientJSON(content);
            if (parsed === null) throw new Error('bad JSON');
            return parsed;
        } catch (e) { if (i === 1) throw e; }
    }
}

// Tolerates a reply that got cut off: closes dangling strings and brackets so a
// truncated but mostly-complete answer still yields usable data instead of throwing.
function parseLenientJSON(content) {
    if (!content) return null;
    const start = content.indexOf('{');
    if (start < 0) return null;
    const frag = content.slice(start);
    try { return JSON.parse(frag); } catch (e) { /* repair below */ }
    let inStr = false, esc = false, depth = 0;
    const stack = [];
    for (let k = 0; k < frag.length; k++) {
        const ch = frag[k];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{' || ch === '[') { stack.push(ch === '{' ? '}' : ']'); depth++; }
        else if (ch === '}' || ch === ']') { stack.pop(); depth--; }
    }
    let repaired = frag;
    if (inStr) repaired += '"';
    repaired = repaired.replace(/,\s*$/, '');
    while (stack.length) repaired += stack.pop();
    try { return JSON.parse(repaired); } catch (e) { }
    return null;
}

// ============================================================
// PROFILE GENERATION — one call per character, ever. The result is a locked
// personality: nothing in the story rewrites it afterwards.
// ============================================================
const PROFILE_SYS = `You read a roleplay character card and score the character's fixed personality.
Reply ONLY with JSON, no prose:
{"gender":"m|f","archetype":"<one of: pragmatist romantic firebrand wallflower guardian wanderer ice brat scholar zealot seductress perfectionist nurturer schemer drifter soldier innocent waif dreamer devotee>","dominance":0-100,"confidence":0-100,"shyness":0-100,"patience":0-100,"curiosity":0-100,"stability":0-100,"impulse":0-100,"propriety":0-100}
Score what the character IS, not how she feels today. Use the full range: a timid character should score shyness above 70, not 55. If the card is thin, infer from tone and pick the closest archetype.`;

// The card behind a name, or null. `avatar` is the filename ST keys a card by, and
// it is the only stable handle a card has: the display name is editable, the avatar
// is what group membership and the character list are actually addressed by.
function cardFor(name) {
    try {
        const key = nameKey(name);
        if (!key) return null;
        return (getContext().characters || []).find(x => x && nameKey(x.name) === key) || null;
    } catch (e) { return null; }
}

function cardByAvatar(avatar) {
    if (!avatar) return null;
    try { return (getContext().characters || []).find(x => x && x.avatar === avatar) || null; }
    catch (e) { return null; }
}

// Every card actually present in the chat on screen: the group's members, or the
// single card a one-on-one chat is with. This is the list the engine should have
// been working from all along.
function chatCards() {
    const ctx = getContext();
    const out = [];
    try {
        const g = (ctx.groups || []).find(x => x.id === ctx.groupId);
        if (g && Array.isArray(g.members)) {
            for (const m of g.members) {
                const c = cardByAvatar(m);
                if (c && aiName(c.name)) out.push(c);
            }
            return out;
        }
        const c = cardFor(ctx.name2);
        if (c) out.push(c);
        else if (aiName(ctx.name2)) out.push({ avatar: null, name: ctx.name2 });
    } catch (e) { }
    return out;
}

function cardTextFor(name) {
    // The card is already in memory; there is no reason to spend a request finding it.
    try {
        const c = cardFor(name);
        if (!c) return '';
        const parts = [c.name, c.description, c.personality, c.scenario].filter(Boolean).join('\n');
        return parts.slice(0, 2500);
    } catch (e) { return ''; }
}

// Guessing from the card costs nothing and is right far more often than a default.
// Pronoun counts beat name heuristics, which fall apart across languages.
function guessGender(text) {
    // Word-boundary regexes are ASCII-only in JS, so every Cyrillic pronoun silently
    // failed to match. Tokenising on non-letters is both correct and language-agnostic.
    const words = String(text || '').toLowerCase().split(/[^\p{L}]+/u);
    const M = new Set(['he', 'him', 'his', 'himself', 'man', 'boy', 'male', 'sir', 'mr',
        'он', 'его', 'ему', 'им', 'нём', 'нем', 'мужчина', 'мужчины', 'парень', 'мужик', 'муж']);
    const F = new Set(['she', 'her', 'hers', 'herself', 'woman', 'girl', 'female', 'mrs', 'ms',
        'она', 'её', 'ее', 'ей', 'ею', 'ней', 'женщина', 'женщины', 'девушка', 'девочка', 'жена']);
    let m = 0, f = 0;
    for (const w of words) { if (M.has(w)) m++; else if (F.has(w)) f++; }
    if (m > f * 1.3) return 'm';
    if (f > m * 1.3) return 'f';
    return null;
}

async function buildProfile(npc) {
    if (npc.profiled) return;
    npc.profiled = true;                         // claim it now: a second reply must not fire a second request
    if (!settings.autoProfile || !hasKey()) return;
    const card = cardTextFor(npc.name);
    const guess = guessGender(card || npc.name);
    if (guess) npc.gender = guess;
    if (!card) return;
    try {
        /* Raised from 300. The answer itself is about fifty tokens, so 300 looked
           generous — but a reasoning model spends its budget thinking BEFORE it
           writes, runs out, and returns nothing usable. The archetype then falls
           back to pragmatist, which is why some people saw every character come out
           a pragmatist while others never did: it depended entirely on the model.

           Unused budget costs nothing — only generated tokens are billed — so the
           ceiling is set where even a long deliberation fits.

           The two classifiers below are deliberately NOT raised: they run on every
           message behind a 9-second timeout, and a bigger allowance there would just
           mean waiting for something that gets thrown away. */
        const res = await callAI(PROFILE_SYS, card, 5000);
        const g = String(res.gender || '').toLowerCase();
        if (g === 'm' || g === 'f') npc.gender = g;
        const arch = String(res.archetype || '').toLowerCase();
        const base = ARCHETYPES[arch] ? clone(ARCHETYPES[arch]) : clone(ARCHETYPES.pragmatist);
        for (const k of TRAITS) if (Number.isFinite(+res[k])) base[k] = clamp(+res[k], 0, 100);
        npc.archetype = ARCHETYPES[arch] ? arch : npc.archetype;
        npc.traits = base;
        saveState(true);
        renderAlbum();
        updateInjections();
        toastr.success(t('toast_profile', { name: npc.name }));
    } catch (e) {
        console.warn('[Bonds] profile failed', e);
        toastr.warning(t('toast_profile_err'));
    }
}

function ensureNpc(name) {
    const nm = aiName(name);
    if (!nm) return null;
    const key = nameKey(nm);
    if (!key) return null;

    // A page belongs to a CARD whenever one exists, and only falls back to the bare
    // name when it does not. Without this, renaming a card in ST started a second
    // page from zero and the whole relationship appeared to reset; and a card whose
    // display name differs from the name used in the prose got two pages at once.
    const card = cardFor(nm);
    if (card && card.avatar) {
        for (const k of Object.keys(state.npcs)) {
            const n = state.npcs[k];
            if (n.avatar !== card.avatar) continue;
            // The card was renamed: move the page so the history follows it. If a
            // separate page already sits on the new key, LEAVE BOTH ALONE — overwriting
            // it here silently destroyed a real relationship, which is worse than the
            // duplicate this was meant to prevent.
            if (k !== key && !state.npcs[key]) {
                n.name = card.name; n.key = key;
                state.npcs[key] = n; delete state.npcs[k];
                if (state.active === k) state.active = key;
            } else if (k !== key) {
                state.npcs[k].seen = num(state.npcs[k].seen) + 1;
                return state.npcs[k];
            }
            state.npcs[key].seen = num(state.npcs[key].seen) + 1;
            if (!state.active) state.active = key;
            return state.npcs[key];
        }
    }

    if (!state.npcs[key]) {
        // Archetype is a starting point, not an override — buildProfile refines it.
        state.npcs[key] = freshNpc(nm, null, 'pragmatist');
        if (card && card.avatar) state.npcs[key].avatar = card.avatar;
        buildProfile(state.npcs[key]);
    } else if (card && card.avatar && !state.npcs[key].avatar) {
        state.npcs[key].avatar = card.avatar;      // an older page, bound to its card now
    }
    state.npcs[key].seen = num(state.npcs[key].seen) + 1;
    if (!state.active) state.active = key;
    return state.npcs[key];
}

// ============================================================
// THE MATH
// Everything below runs locally. The DC is assembled and frozen before the die is
// thrown, the throw is a single d20, and the result is written to state before the
// main model is told anything. There is no path by which the model can re-roll,
// soften, or negotiate an outcome, because by the time it reads the verdict the
// outcome is already history.
// ============================================================

function difficultyMul() { return clamp(num(settings.difficulty, 100), 25, 300) / 100; }
// Only growth is scaled. Damage keeps its full weight at every pace, so making a
// story move faster never makes it safer — a fast romance can still be wrecked as
// thoroughly as a slow one.
function paceMul() { return clamp(num(settings.pace, 100), 25, 400) / 100; }

// Repeating the same approach turn after turn should get harder, not stay flat.
function repeatPenalty(npc, act) {
    if (npc.lastAct !== act) return 0;
    const gap = state.turn - npc.lastActTurn;
    if (gap > 4) return 0;
    return clamp(6 - gap, 0, 4);
}

// Each act reads a weighted blend of the dispositions that actually govern it,
// so one combined term controls the whole swing instead of five stacked ones.
// Every modifier is centred: a median character at neutral standing rolls against
// the act's base DC, and each factor pushes from there in a bounded way.
const SOCIAL_W = {
    flirt: { attraction: .55, affection: .30, comfort: .15 },
    persuade: { respect: .50, trust: .30, affection: .20 },
    apologize: { respect: .40, trust: .40, affection: .20 },
    confess: { affection: .60, attraction: .40 },
    propose: { affection: .50, trust: .30, respect: .20 },
    reassure: { trust: .55, comfort: .25, affection: .20 },
    boundary: { comfort: .50, trust: .30, attraction: .20 }
};
const SOCIAL_DIV = { flirt: 7, persuade: 7, apologize: 7, confess: 6, propose: 9, reassure: 6, boundary: 14 };
const PHYS_W = { attraction: .45, comfort: .30, trust: .25 };

function blend(disp, weights) {
    let sum = 0;
    for (const k of Object.keys(weights)) sum += disp[k] * weights[k];
    return sum;
}

function computeDC(npc, act, ctx) {
    const A = ACTS[act];
    if (!A) return null;
    const tr = npc.traits, d = npc.disp, p = npc.pulse;
    const privacy = clamp(num(ctx.privacy, 40), 0, 100);
    const alcohol = clamp(num(ctx.alcohol, 0), 0, 100);
    const intensity = clamp(num(ctx.intensity, 2), 1, 3);
    let dc = A.base;

    if (A.kind === 'social') {
        const W = blend(d, SOCIAL_W[act] || SOCIAL_W.flirt);
        dc -= (W - 40) / (SOCIAL_DIV[act] || 7);
        dc += (tr.shyness - 50) / 16;
        dc -= (p.mood - 50) / 16;

        if (act === 'boundary') {
            // Pushing past a refusal stays hard whoever she is and however long you
            // have known her. Standing buys almost nothing here, by design.
            dc -= (STAGE_SOCIAL[npc.stage] || 0) * 0.5;
            dc += (tr.propriety - 50) / 12;
            dc += (100 - d.comfort) / 14;
            dc += (tr.dominance - 50) / 16;
        } else {
            dc -= STAGE_SOCIAL[npc.stage] || 0;
            if (act === 'flirt') {
                dc += (tr.propriety - 50) / 30;
                dc -= (p.excitement - 40) / 30;
                dc -= alcohol / 30;
            } else if (act === 'persuade') {
                dc += (tr.dominance - 50) / 14;   // a woman used to giving orders does not take direction
                dc -= (tr.curiosity - 50) / 26;
            } else if (act === 'apologize') {
                dc += (tr.dominance - 50) / 12;
                dc -= (tr.patience - 50) / 12;
                if (npc.conflict) dc += clamp(num(npc.conflict.severity, 1), 0, 4);
            } else if (act === 'confess') {
                dc += (tr.shyness - 50) / 22;
                if (d.attraction < 50) dc += 5;   // she is not there yet, and saying it aloud will show
            } else if (act === 'propose') {
                dc += (tr.shyness - 50) / 24;
                // Proposing to someone who is not yet a partner is a different question
                // entirely, and she will hear it as one.
                if (npc.stage !== 'girlfriend' && npc.stage !== 'partner') dc += 6;
            } else if (act === 'reassure') {
                dc += (50 - tr.stability) / 22;
            }
        }
    } else {
        const W = blend(d, PHYS_W);
        dc -= (W - 40) / 7;
        dc -= (p.arousal - 15) / 9;
        dc -= (p.mood - 50) / 20;
        dc -= (privacy - 40) / 28;
        dc -= alcohol / 34;
        dc += (tr.propriety - 50) / 20;
        dc += (tr.shyness - 50) / 24;
        dc -= (tr.impulse - 50) / 20;
        dc -= STAGE_PHYS[npc.stage] || 0;
        // No forced ladder: any act is available at any time. Skipping steps is
        // steeper, which is a price rather than a lock.
        const jump = (A.tier || 1) - (npc.maxTier + 1);
        if (jump > 0) dc += jump * 2;
    }

    if (npc.conflict) dc += (act === 'apologize' || act === 'reassure') ? 0 : (A.kind === 'intimacy' ? 6 : 4);
    dc += repeatPenalty(npc, act);
    dc -= npc.grace * 2.5;                       // grace: repeated refusal must not become a dead end
    dc += (intensity - 2) * 1.5;               // a bolder attempt asks for more
    dc *= difficultyMul();

    return clamp(Math.round(dc), 3, 28);
}

function classifyResult(roll, dc) {
    if (roll === 20) return 'crit_success';
    if (roll === 1) return 'crit_fail';
    if (roll >= dc) return (roll - dc >= 6) ? 'strong_success' : 'success';
    return (dc - roll >= 6) ? 'hard_fail' : 'fail';
}
function isWin(res) { return res === 'success' || res === 'strong_success' || res === 'crit_success'; }

// Disposition deltas. Positive movement is small and slow; damage is faster,
// which is what makes trust worth protecting.
const EFFECTS = {
    flirt: { win: { attraction: 4, affection: 2, comfort: 1, mood: 5, excitement: 7, arousal: 4 }, lose: { comfort: -2, mood: -3, excitement: -3 } },
    persuade: { win: { respect: 3, trust: 2, mood: 2 }, lose: { respect: -2, mood: -2 } },
    apologize: { win: { trust: 5, comfort: 4, affection: 2, mood: 8 }, lose: { respect: -3, mood: -4 } },
    confess: { win: { affection: 9, attraction: 5, trust: 4, mood: 14, excitement: 12 }, lose: { comfort: -6, affection: -3, mood: -10 } },
    propose: { win: { affection: 12, trust: 8, respect: 5, mood: 18, excitement: 16 }, lose: { comfort: -7, affection: -5, respect: -3, mood: -14 } },
    reassure: { win: { trust: 5, comfort: 4, mood: 7 }, lose: { trust: -3, mood: -5 } },
    boundary: { win: { attraction: 3, excitement: 5, arousal: 5, respect: -1 }, lose: { comfort: -7, trust: -5, respect: -4, attraction: -2, affection: -3, mood: -10 } },
    touch: { win: { comfort: 3, attraction: 2, arousal: 3 }, lose: { comfort: -3, mood: -2 } },
    hold: { win: { comfort: 4, trust: 2, attraction: 3, affection: 2, arousal: 6 }, lose: { comfort: -4, mood: -3 } },
    kiss: { win: { attraction: 7, affection: 4, comfort: 2, trust: 1, arousal: 12, excitement: 10, mood: 8 }, lose: { comfort: -6, trust: -2, affection: -1, mood: -7 } },
    heated: { win: { attraction: 8, arousal: 18, excitement: 12, comfort: 3 }, lose: { comfort: -8, trust: -4, affection: -2, mood: -9 } },
    sex: { win: { attraction: 10, affection: 6, comfort: 6, trust: 3, arousal: 25, excitement: 15, mood: 12 }, lose: { comfort: -9, trust: -6, affection: -3, attraction: -2, mood: -12 } }
};

function applyDelta(npc, delta, scale) {
    const caps = dispCap(npc.traits);
    for (const k of Object.keys(delta || {})) {
        const v = delta[k] * (scale == null ? 1 : scale);
        if (DISPS.includes(k)) {
            // The ceiling only blocks growth. Damage always lands, whoever she is.
            if (v > 0) {
                // If a value is already at or past the ceiling — set by hand in GM mode,
                // or carried over from a save — adding to it must do nothing rather than
                // yank it down to the cap. Growth is blocked, not reversed.
                if (npc.disp[k] < caps[k]) {
                    npc.disp[k] = clamp(Math.min(npc.disp[k] + v * paceMul(), caps[k]), 0, 100);
                }
            } else {
                npc.disp[k] = clamp(npc.disp[k] + v, 0, 100);
            }
        } else if (npc.pulse[k] != null) {
            npc.pulse[k] = clamp(npc.pulse[k] + v, 0, 100);
        }
    }
}

const RES_SCALE = { crit_success: 1.5, strong_success: 1.2, success: 1, fail: 1, hard_fail: 1.5, crit_fail: 2 };

function resolveCheck(npc, act, ctx) {
    const dc = computeDC(npc, act, ctx);
    if (dc == null) return null;
    const trustBefore = npc.disp.trust;
    const roll = d20();                       // DC was frozen a line ago; this is the only randomness
    const res = classifyResult(roll, dc);
    const won = isWin(res);
    const eff = EFFECTS[act] || {};
    applyDelta(npc, won ? eff.win : eff.lose, RES_SCALE[res] || 1);

    const A = ACTS[act];
    // Landing something romantic in front of another partner who wants the same thing
    // is not free. Only characters actually in the scene react — an absent partner
    // cannot resent what she never saw.
    if (won && (A.kind === 'intimacy' || act === 'flirt' || act === 'confess' || act === 'propose')) {
        for (const other of promptNpcs()) {
            if (other.key === npc.key || other.disp.attraction < 35) continue;
            const sting = 2 + other.disp.attraction / 25 + other.traits.dominance / 40;
            other.views[npc.key] = clamp(num(other.views[npc.key], 0) - sting, -100, 100);
            applyDelta(other, { mood: -Math.round(sting) });
        }
    }

    if (won) {
        // Doing anything unusually well earns a little respect, whatever it was.
        // Without this, respect only moves on two act types and stays near zero
        // through an entire romance, quietly walling off the later stages.
        if (res === 'strong_success' || res === 'crit_success') applyDelta(npc, { respect: 1 });
        npc.failStreak = 0; npc.grace = 0;
        if (A.kind === 'intimacy') npc.maxTier = Math.max(npc.maxTier, A.tier || 0);
        if (A.milestone) {
            npc.milestones[A.milestone] = true;
            pushEvent(npc, t('ev_' + A.milestone));
        }
        if (act === 'apologize' && npc.conflict) endConflict(npc);
    } else {
        npc.failStreak++;
        if (npc.failStreak >= 2) npc.grace = clamp(npc.grace + 1, 0, 3);
        // Three separate triggers, as designed: a fumble, a boundary violation, and
        // a betrayal — the last one measured as a real drop in trust rather than by
        // which act caused it, so anything that guts trust can start a fight.
        const betrayal = (trustBefore - npc.disp.trust) >= 4;
        if (res === 'crit_fail' || (act === 'boundary' && res === 'hard_fail') || betrayal) {
            startConflict(npc, act, res === 'crit_fail' ? 2 : (betrayal ? 3 : 3));
        }
    }

    if (res === 'crit_success') pushMemory(npc, 'good', t('mem_good', { act: t('act_' + act) }));
    if (res === 'crit_fail') pushMemory(npc, 'bad', t('mem_bad', { act: t('act_' + act) }));

    npc.lastAct = act; npc.lastActTurn = state.turn;
    npc.log.push({ turn: state.turn, act, dc, roll, res });
    npc.log = npc.log.slice(-12);

    const walked = (!won && npc.failStreak >= 3);
    if (walked) { npc.cooldown = 2; npc.grace = 3; npc.failStreak = 0; npc.mendUntil = state.turn + 8; }

    checkStage(npc);
    return { act, dc, roll, res, won, walked };
}

// Ordinary conversation — a turn where nothing was attempted — still counts for
// something. Without this, a run of bad rolls drains trust and comfort with no way
// back and the story dead-ends. Familiarity is deliberately shallow: it opens the
// first door or two and then stops, so small talk can never substitute for the story.
function familiarityTick(npc) {
    if (npc.conflict) return;
    const caps = dispCap(npc.traits);
    const soft = 26 + (STAGE_SOCIAL[npc.stage] || 0) * 8;
    const grow = (k, amount) => {
        const limit = Math.min(caps[k], soft);
        if (npc.disp[k] < limit) npc.disp[k] = clamp(npc.disp[k] + amount, 0, limit);
    };
    const m = paceMul();
    grow('comfort', 0.5 * m);
    grow('trust', 0.4 * m);
    grow('affection', 0.35 * m);
    grow('respect', 0.3 * m);
}

// ============================================================
// CONFLICT — how she fights is her traits talking, not a dice roll.
// ============================================================
const CONFLICT_STYLE = {
    en: {
        head_on: 'confronts {user} head-on and does not back down',
        cold: 'goes cold and withdraws rather than shout',
        fast: 'escalates fast — this gets loud in two lines',
        creep: 'drags in old grievances that have nothing to do with tonight',
        flat: 'is short with {user} and keeps the door half-closed'
    },
    ru: {
        head_on: 'идёт в лоб и не отступает',
        cold: 'замыкается и холодеет, а не кричит',
        fast: 'заводится мгновенно — через две реплики будет крик',
        creep: 'тянет в спор старые обиды, к сегодняшнему не относящиеся',
        flat: 'отвечает коротко и держит дверь полуприкрытой'
    }
};

function conflictStyleKey(npc) {
    const tr = npc.traits;
    if (tr.stability < 40) return 'creep';
    if (tr.patience < 35) return 'fast';
    if (tr.dominance > 65) return 'head_on';
    if (tr.dominance < 35) return 'cold';
    return 'flat';
}

// An argument left alone does not sit still. How fast it climbs is her traits
// talking: an impatient, volatile character is shouting within two exchanges,
// while a patient one can stay contained for a dozen. Heat feeds back into the
// apology DC through conflict.severity, so letting it burn really does make it
// harder to put out.
// A fight nobody ever apologises for used to freeze the relationship permanently,
// because stage promotion is blocked while ConflictActive is set. That is the same
// dead end the grace mechanic exists to prevent. So an argument left alone long
// enough eventually stops being spoken about — how long depends on how patient and
// even-tempered she is. Nothing is forgiven: the damage stays, the memory is written
// as unresolved, and no ImportantEvent for making up is recorded.
function conflictLapses(npc) {
    if (!npc.conflict) return false;
    const tr = npc.traits;
    const patience = 22 + (100 - tr.patience) / 2 + (100 - tr.stability) / 3 + tr.dominance / 4;
    return (state.turn - num(npc.conflict.turn, state.turn)) > patience;
}

function lapseConflict(npc) {
    if (!npc.conflict) return;
    pushMemory(npc, 'bad', t('ev_lapsed', { topic: npc.conflict.topic }));
    npc.conflict = null;
    npc.mendUntil = state.turn + 8;
    toastr.info(gform(t('toast_lapsed', { name: npc.name }), npc.gender));
}

function escalateConflict(npc) {
    if (!npc.conflict) return;
    if (conflictLapses(npc)) { lapseConflict(npc); return; }
    const tr = npc.traits;
    const speed = 0.18 + (100 - tr.patience) / 260 + (100 - tr.stability) / 400;
    npc.conflict.heat = clamp(num(npc.conflict.heat, 0) + speed, 0, 3.99);
    npc.conflict.severity = clamp(Math.max(npc.conflict.severity, 1 + Math.floor(npc.conflict.heat)), 1, 4);
}

function heatBand(npc) {
    return clamp(1 + Math.floor(num(npc.conflict && npc.conflict.heat, 0)), 1, 4);
}

function startConflict(npc, cause, severity) {
    if (npc.conflict) { npc.conflict.severity = clamp(npc.conflict.severity + 1, 1, 4); return; }
    npc.conflict = { topic: t('act_' + cause), severity: clamp(severity, 1, 4), heat: 0, style: conflictStyleKey(npc), turn: state.turn };
    toastr.warning(t('toast_conflict', { name: npc.name }));
}

function endConflict(npc) {
    if (!npc.conflict) return;
    pushEvent(npc, t('ev_conflict', { topic: npc.conflict.topic }));
    npc.conflict = null;
    npc.justResolved = true;                  // consumed by the next verdict block
    toastr.success(t('toast_conflict_end', { name: npc.name }));
}

function pushEvent(npc, text) {
    if (!text) return;
    // The same event recorded twice reads as two separate weddings. Re-recording
    // an existing one just refreshes how recent it is.
    const at = npc.events.indexOf(text);
    if (at >= 0) npc.events.splice(at, 1);
    npc.events.push(text);
    npc.events = npc.events.slice(-10);
}

// Positive and negative memories are written by the dice, not by milestones: a
// natural 20 on a kiss is a night she remembers, a natural 1 on pushing past a
// refusal is one she holds against him. FIFO at five each, oldest out first.
function pushMemory(npc, list, text) {
    if (!text || !Array.isArray(npc[list])) return;
    const at = npc[list].indexOf(text);
    if (at >= 0) npc[list].splice(at, 1);
    npc[list].push(text);
    npc[list] = npc[list].slice(-5);
}

function dropEvent(npc, key) {
    const forms = [I18N.en['ev_' + key], I18N.ru['ev_' + key]].filter(Boolean);
    npc.events = npc.events.filter(e => !forms.includes(e));
}

// ============================================================
// STAGE PROGRESSION
// Promotion wipes affection and halves the rest: a new stage is a new dynamic,
// not a saved score carried forward. It is also what stops a single good week
// from carrying someone from stranger to wife.
// ============================================================
function gateMet(npc, gate) {
    if (!gate.from.includes(npc.stage)) return false;
    if (gate.milestone && !npc.milestones[gate.milestone]) return false;
    for (const k of Object.keys(gate.need)) if (npc.disp[k] < gate.need[k]) return false;
    return true;
}

// Being told "nothing happened" is useless; being told "affection 40 of 75, and the
// wedding has not happened yet" is the whole answer. This drives the panel that
// explains why a stage has not advanced.
function nextStages(npc) {
    return GATES.filter(g => g.from.includes(npc.stage)).map(g => ({
        to: g.to,
        missing: Object.keys(g.need)
            .filter(k => npc.disp[k] < g.need[k])
            .map(k => ({ key: k, need: g.need[k], have: Math.round(npc.disp[k]) })),
        milestone: (g.milestone && !npc.milestones[g.milestone]) ? g.milestone : null
    }));
}

const MILESTONES = ['confession', 'first_sex', 'marriage'];

// A milestone is a KEY for a gate, not a line of story. Marking it must never put
// anything in the prompt on its own: writing "she remembers: the wedding" while the
// two of them are still strangers is how the model ends up narrating a wedding that
// never happened. The memory entry is written where the event actually occurs — when
// a check succeeds, or when the stage it unlocks is finally reached.
function toggleMilestone(npc, key) {
    if (npc.awaiting === key) npc.awaiting = null;
    if (npc.milestones[key]) {
        delete npc.milestones[key];
        dropEvent(npc, key);                  // symmetric: unmarking also unremembers
        return;
    }
    npc.milestones[key] = true;
    const advanced = checkStage(npc);
    if (!advanced) {
        const gate = GATES.find(g => g.milestone === key);
        const reachable = GATES.some(g => g.milestone === key && g.from.includes(npc.stage));
        if (gate && !reachable) {
            toastr.info(t('ms_early', { stage: gform(t('stage_' + gate.from[0]), npc.gender) }));
        }
    }
}

// Stages only ever climbed. Off by default because it changes the shape of a story
// considerably, but a relationship that is neglected or mistreated for long enough
// should be able to fall back — otherwise a girlfriend with zero trust is still a
// girlfriend forever.
//
// The test deliberately ignores Affection: promotion zeroes it by design, so judging
// by it would demote everyone the moment they were promoted. What is measured is the
// slow, hard-won side — trust, comfort, respect — against a floor that rises with the
// stage, held below it for long enough that a single bad evening cannot do it.
function demotionFloor(npc) { return 10 + (STAGE_PHYS[npc.stage] || 0) * 2; }

function checkDemotion(npc) {
    // Unlike promotion, an active conflict does NOT hold this off. A relationship
    // stuck in a permanent fight is precisely one that should be sliding backwards;
    // blocking on it made the whole mechanic almost unreachable.
    if (!settings.demotion) return false;
    const gate = GATES.find(g => g.to === npc.stage);
    if (!gate) return false;                                  // stranger has nowhere to fall
    if (state.turn - num(npc.promotedTurn, -999) < 40) return false;
    const core = (npc.disp.trust + npc.disp.comfort + npc.disp.respect) / 3;
    if (core < demotionFloor(npc)) npc.demoteStreak = num(npc.demoteStreak, 0) + 1;
    else npc.demoteStreak = 0;
    if (npc.demoteStreak < 12) return false;

    npc.stage = gate.from[0];
    npc.demoteStreak = 0;
    npc.promotedTurn = state.turn;                            // same grace period downward
    npc.stageJustChanged = true;
    pushEvent(npc, t('ev_demote'));
    pushMemory(npc, 'bad', t('ev_demote'));
    toastr.warning(gform(t('toast_demote', { name: npc.name, user: userName() }), npc.gender));
    return true;
}

function checkStage(npc) {
    if (checkDemotion(npc)) return true;
    if (npc.conflict) return false;
    for (const gate of GATES) {
        if (!gateMet(npc, gate)) continue;
        npc.stage = gate.to;
        npc.promotedTurn = state.turn;
        npc.demoteStreak = 0;
        // Now it has genuinely happened in the story, so now it is worth remembering.
        if (gate.milestone && I18N.en['ev_' + gate.milestone]) pushEvent(npc, t('ev_' + gate.milestone));
        npc.disp.affection = 0;
        for (const k of ['trust', 'comfort', 'respect', 'attraction']) npc.disp[k] = Math.round(npc.disp[k] * 0.5);
        npc.stageJustChanged = true;
        toastr.success(t('toast_stage', { name: npc.name, stage: gform(t('stage_' + gate.to), npc.gender) }));
        return true;
    }
    return false;
}

// ============================================================
// PULSE — the only layer that moves every single reply. Mood drifts back toward
// her own baseline (a stable character recovers fast, a volatile one does not),
// arousal and excitement bleed off on their own.
// ============================================================
function pulseTick(npc) {
    const rate = 0.10 + npc.traits.stability / 500;
    const baseline = 45 + npc.traits.stability * 0.15 + npc.disp.affection * 0.08;
    npc.pulse.mood += (baseline - npc.pulse.mood) * rate;
    npc.pulse.arousal *= 0.88;
    npc.pulse.excitement *= 0.88;
    for (const k of ['mood', 'arousal', 'excitement']) npc.pulse[k] = clamp(Math.round(npc.pulse[k]), 0, 100);
    if (npc.cooldown > 0) npc.cooldown--;
    escalateConflict(npc);
    // Resentment cools on its own, so one bad evening does not define a household.
    for (const k of Object.keys(npc.views || {})) {
        npc.views[k] *= 0.985;
        if (Math.abs(npc.views[k]) < 1) delete npc.views[k];
    }
}

// ============================================================
// INITIATIVE — she does not wait to be talked to. Chance and choice both come
// from her traits, so a bold impulsive character opens fire constantly and a shy
// one almost never does, which is exactly the tell that she is a person.
// ============================================================
// Which move she reaches for depends on how far the relationship has come. A
// stranger who is drawn to someone flirts; a wife who is drawn to someone goes to
// bed. The dispositions are identical — the obvious next move is not. `c` is the
// same closeness index the physical DCs use, 0 for a stranger through 8 for a spouse.
const INIT_STAGE_CURVE = {
    flirt: (c) => 1.90 - c * 0.20,
    plan: (c) => 1.05 - c * 0.02,
    // A confession belongs to the middle of the arc: too early it is absurd, and once
    // you are married there is nothing left to confess.
    confess: (c) => 0.20 + c * 0.30 - Math.max(0, c - 5) * 0.66,
    propose: (c) => 0.40 + c * 0.16,
    touch: (c) => 0.95 + c * 0.05,
    kiss: (c) => 0.28 + c * 0.19,
    heated: (c) => 0.09 + c * 0.25,
    sex: (c) => 0.04 + c * 0.29,
    confront: (c) => 0.55 + c * 0.08,
    mend: (c) => 0.90 + c * 0.04,
    // Wooing has its own arc. Compliments belong to the beginning, invitations to the
    // middle, and being remembered to the part where there is something to remember.
    compliment: (c) => 1.70 - c * 0.09,
    gift: (c) => 0.75 + c * 0.07,
    date: (c) => 0.45 + c * 0.20 - Math.max(0, c - 6) * 0.30,
    remember: (c) => 0.40 + c * 0.14,
    offer: (c) => 0.05 + c * 0.24
};

// And who she is decides what kind of move she reaches for at all. A brazen impulsive
// character escalates physically; a proper, patient one suggests going somewhere
// together. These ranges are deliberately wide — a personality that barely tilts the
// odds is not a personality the player will ever notice.
const INIT_TRAIT_CURVE = {
    flirt: (t) => 0.45 + t.confidence / 130 + (100 - t.shyness) / 180,
    plan: (t) => 1.15 + t.curiosity / 240 + t.patience / 260 - t.impulse / 300,
    confess: (t) => 0.15 + t.confidence / 110 + (100 - t.shyness) / 160,
    propose: (t) => 0.45 + t.confidence / 170 + t.stability / 220,
    touch: (t) => 0.70 + t.impulse / 130 + (100 - t.propriety) / 260,
    kiss: (t) => 0.40 + t.impulse / 100 + (100 - t.propriety) / 190,
    heated: (t) => 0.25 + t.impulse / 80 + (100 - t.propriety) / 140,
    sex: (t) => 0.20 + t.impulse / 70 + (100 - t.propriety) / 120,
    confront: (t) => 0.40 + t.dominance / 120 + (100 - t.patience) / 200,
    // Coming back after storming off is a patient, even-tempered thing to do. Pride
    // works against it: the more used to being obeyed she is, the longer she stays gone.
    mend: (t) => 0.25 + t.patience / 110 + t.stability / 140 - t.dominance / 220,
    compliment: (t) => 0.45 + t.confidence / 130 + (100 - t.shyness) / 200,
    gift: (t) => 0.50 + t.patience / 150 + t.stability / 180 + (100 - t.dominance) / 260,
    date: (t) => 0.40 + t.confidence / 140 + t.curiosity / 200,
    remember: (t) => 0.35 + t.patience / 130 + t.curiosity / 180 + t.stability / 220,
    offer: (t) => 0.30 + t.confidence / 130 + (100 - t.propriety) / 200
};

function rollInitiative(npc) {
    if (!settings.initiative || npc.conflict || npc.cooldown > 0) return null;
    const tr = npc.traits, d = npc.disp, p = npc.pulse;
    // Split into "how much she wants to" and "whether she is the sort who acts on it",
    // so a shy character stays quiet even when deeply attached — the multiplier keeps
    // her rate near a third of a bold character's instead of merely below it.
    const closeness = STAGE_PHYS[npc.stage] || 0;
    // An established partner speaks up more often than a near-stranger does.
    const drive = 0.03 + d.affection / 2000 + closeness / 500;
    const nerve = (tr.confidence + tr.impulse + (100 - tr.shyness)) / 150;
    let chance = drive * nerve;
    chance *= clamp(num(settings.initiativeRate, 100), 0, 300) / 100;
    // A deliberate second knob rather than a constant in the formula. Traits already
    // separate a demure character from a brazen one by about threefold, and that
    // separation comes from the card. Baking a gender coefficient in would count the
    // same thing twice and would quietly overrule a bold woman's own personality —
    // which is the one thing this engine promises never to do. Left at 100/100 it
    // changes nothing; an author who wants the tilt can dial it in.
    const genderTrim = npc.gender === 'm' ? settings.initMale : settings.initFemale;
    chance *= clamp(num(genderTrim, 100), 0, 200) / 100;

    // Coming back after walking off is a beat, not background noise, so inside that
    // short window the urge to speak first is raised outright — and raised by exactly
    // the trait mix that decides whether she is the sort to come back at all. Without
    // this the character question drowns in the base rate and everyone returns alike.
    const mending = state.turn <= num(npc.mendUntil, -99) && d.affection > 20;
    if (mending) chance *= 1 + INIT_TRAIT_CURVE.mend(tr) * 2;
    if (settings.courtship) chance *= clamp(num(settings.courtshipRate, 180), 100, 400) / 100;
    if (Math.random() > chance) return null;

    const opts = [];
    const weigh = (name, base) => {
        const sm = INIT_STAGE_CURVE[name] ? Math.max(0.05, INIT_STAGE_CURVE[name](closeness)) : 1;
        const tm = INIT_TRAIT_CURVE[name] ? Math.max(0.15, INIT_TRAIT_CURVE[name](tr)) : 1;
        return Math.max(1, base * sm * tm);
    };
    if (d.attraction > 35) opts.push(['flirt', weigh('flirt', d.attraction + p.excitement)]);
    if (d.affection > 25) opts.push(['plan', weigh('plan', d.affection + d.comfort)]);
    if (d.affection > 60 && d.attraction > 55 && !npc.milestones.confession) opts.push(['confess', weigh('confess', d.affection * 1.5)]);
    if (d.affection > 70 && d.trust > 65 && !npc.milestones.marriage && (npc.stage === 'girlfriend' || npc.stage === 'partner')) opts.push(['propose', weigh('propose', d.affection * 1.2)]);
    if (settings.intimacy && d.comfort > 40 && npc.maxTier >= 1) opts.push(['touch', weigh('touch', d.comfort + p.arousal)]);
    // Arousal bleeds off within a few turns, so gating physical initiative behind a
    // high arousal meant she could only ever start a kiss immediately after one had
    // already happened. Attraction and comfort decide whether she wants to; arousal
    // only weights how likely that is to be what she picks.
    if (settings.intimacy && d.attraction > 55 && d.comfort > 45 && npc.maxTier >= 2) opts.push(['kiss', weigh('kiss', d.attraction + p.arousal)]);
    if (settings.intimacy && d.attraction > 64 && d.comfort > 55 && npc.maxTier >= 3 && p.arousal > 15) opts.push(['heated', weigh('heated', d.attraction * 0.8 + p.arousal * 1.2)]);
    if (settings.intimacy && d.attraction > 68 && d.comfort > 60 && npc.maxTier >= 4 && p.arousal > 25) opts.push(['sex', weigh('sex', d.attraction * 0.7 + p.arousal * 1.4)]);
    // Courtship gestures: they ask for nothing and resolve nothing, which is exactly
    // why they read as being won over rather than being manoeuvred at.
    if (settings.courtship) {
        if (d.attraction > 25) opts.push(['compliment', weigh('compliment', d.attraction + d.affection * 0.6)]);
        if (d.affection > 25) opts.push(['gift', weigh('gift', d.affection + d.comfort * 0.5)]);
        if (d.affection > 30) opts.push(['date', weigh('date', d.affection + d.attraction * 0.5)]);
        if (d.trust > 35) opts.push(['remember', weigh('remember', d.trust + d.comfort * 0.5)]);
        if (settings.intimacy && d.attraction > 60 && d.comfort > 55 && npc.maxTier >= 2) {
            opts.push(['offer', weigh('offer', d.attraction + p.arousal * 0.8)]);
        }
    }
    if (p.mood < 32 && tr.dominance > 45) opts.push(['confront', weigh('confront', (100 - p.mood) + tr.dominance)]);
    // After walking off — or after an argument quietly lapsed — there is a short window
    // where turning up with something warm still reads as turning up, rather than as
    // nothing having happened. Whether he takes it is his character's business.
    if (state.turn <= num(npc.mendUntil, -99) && d.affection > 20) {
        opts.push(['mend', weigh('mend', (d.affection + d.comfort) * 2.2)]);
    }
    if (!opts.length) return null;

    const total = opts.reduce((s, o) => s + o[1], 0);
    let pick = Math.random() * total;
    for (const [name, w] of opts) { pick -= w; if (pick <= 0) return name; }
    return opts[0][0];
}

// ============================================================
// INTENT CLASSIFICATION
// One small request to the secondary model per player message, ~150 tokens, on a
// different API entirely — the main model's context never grows by a byte of it.
// It answers one question: what did the player just TRY to do, and where.
// ============================================================
const CLASSIFY_SYS = `You label the last message of a roleplay player. Reply ONLY with JSON:
{"target":"<character name from the list, or empty>","act":"<one label>","intensity":1|2|3,"privacy":0-100,"alcohol":0-100}
act must be exactly one of: none, flirt, persuade, apologize, confess, propose, reassure, boundary, touch, hold, kiss, heated, sex
Guidance:
- Pick the single strongest thing the player ATTEMPTS. Talking, asking, walking, describing scenery = "none".
- flirt: teasing, complimenting, coming on to someone. confess: stating romantic love outright. propose: asking someone to marry them. reassure: calming jealousy or hurt. persuade: getting her to agree or do something. apologize: admitting fault.
- boundary: pushing past a refusal she already gave.
- touch: brushing, brief contact. hold: hand-holding, embrace, staying close. kiss: a kiss. heated: heavy physical contact short of sex. sex: initiating a sexual encounter.
- intensity: 1 tentative, 2 normal, 3 bold.
- privacy: 0 crowded public, 100 fully alone. alcohol: how drunk the scene is, 0 if unknown.
An ATTEMPT counts even if the player writes it as already succeeding. Never invent a name that is not in the list.`;

function lastUserMessage() {
    try {
        const chat = getContext().chat || [];
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i].is_user && !chat[i].is_system) return String(chat[i].mes || '');
        }
    } catch (e) { }
    return '';
}
function lastCharMessage() {
    try {
        const chat = getContext().chat || [];
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_user && !chat[i].is_system) return String(chat[i].mes || '');
        }
    } catch (e) { }
    return '';
}
// Candidate names: the group roster if this is a group chat, otherwise the card.
function rosterNames() {
    const ctx = getContext();
    const out = [];
    try {
        const group = (ctx.groups || []).find(g => g.id === ctx.groupId);
        if (group && Array.isArray(group.members)) {
            for (const m of group.members) {
                const c = (ctx.characters || []).find(x => x.avatar === m);
                if (c && c.name) out.push(c.name);
            }
        }
    } catch (e) { }
    if (!out.length && ctx.name2) out.push(ctx.name2);
    for (const k of Object.keys(state.npcs)) if (!out.some(n => nameKey(n) === k)) out.push(state.npcs[k].name);
    return out.slice(0, 6);
}

function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function classifyIntent(names) {
    const msg = lastUserMessage().slice(0, 900);
    if (msg.trim().length < 3) return null;
    const scene = lastCharMessage().slice(0, 350);
    const payload = `Characters present: ${names.join(', ') || 'unknown'}\nPlayer is: ${userName()}\n\nPrevious scene (context only):\n${scene}\n\nPlayer's message to label:\n${msg}`;
    return await withTimeout(callAI(CLASSIFY_SYS, payload, 200), 9000);
}

// ============================================================
// THE PARTNER'S OWN PROSE — opt-in, and the only part of the engine that reads
// something the model already wrote.
//
// Everything else is settled before generation, which is what makes swipes
// identical. This cannot be, so it is built the other way round: whatever a
// previous swipe of the same message credited is REVERTED before the new swipe is
// read. The ledger below is what makes that possible — it stores the exact
// amounts that landed, not the amounts that were requested, because caps and
// clamps mean those differ.
//
// Three things it deliberately will not do, whatever the prose says:
//   * roll a die — this is an echo, never a check
//   * set a milestone or raise maxTier — a confession or a first night stays the
//     player's call, and prose cannot unlock a tier the story has not reached
//   * pay twice for a turn the engine itself already opened via pendingInit
// ============================================================
const CLASSIFY_CHAR_SYS = `You label the last reply of a roleplay CHARACTER. Reply ONLY with JSON:
{"act":"<one label>","warm":"<none|compliment|gift|plan|remember|reassure|apologize|persuade|flirt>","intensity":1|2|3}
act must be exactly one of: none, flirt, persuade, apologize, reassure, compliment, gift, plan, remember, touch, hold, kiss, heated, sex
Guidance:
- Label what the CHARACTER does toward the player, not what the player does and not what the character merely feels, remembers or thinks about.
- Only count something the character actually did in THIS reply. Reported past events, hypotheticals, dreams and things they decide against = "none".
- If the character is only answering, describing, or moving through a scene = "none".
- flirt: teasing or coming on to the player. compliment: praising them plainly. gift: giving or offering something. plan: proposing an outing or a next meeting. remember: bringing up something the player told them earlier. reassure: comforting them. apologize: admitting fault. persuade: talking them into something.
- touch: brushing, brief contact. hold: hand-holding, embrace, staying close. kiss: a kiss. heated: heavy physical contact short of sex. sex: a sexual encounter.
- intensity: 1 fleeting, 2 normal, 3 emphatic.
- "warm" is a SECOND, separate label for whatever else the character did in the same reply. A character often holds someone's hand AND calms them down in one breath; "act" would take the stronger of the two and the other would be lost. Put the quieter one here so both count. It may only be one of the labels listed for "warm" — never a physical one, and never the same label as "act". If there is no second thing, set warm to "none".
Prefer "none" for both. Most replies are "none".`;

// The warm gestures have no EFFECTS entry of their own — they are not checks —
// so their payouts live here, matching the initiative table one for one.
// Which rung each physical act sits on, by index of maxTier. Used to credit an
// over-eager reply down to the level the story has actually reached.
const TIER_LADDER = ['touch', 'hold', 'kiss', 'heated', 'sex'];

const PROSE_WARM = {
    compliment: { mood: 4, attraction: 1 },
    gift: { mood: 6, affection: 2, comfort: 1 },
    plan: { mood: 3, excitement: 3, comfort: 1 },
    remember: { trust: 2, comfort: 2, mood: 4 }
};

// What the second slot is allowed to be. Physical acts are deliberately absent:
// two rungs of the ladder in one reply would be exactly the escalation the tier
// gate exists to stop. Payouts are the same tables the rest of the engine uses.
const PROSE_SECOND = Object.assign({}, PROSE_WARM, {
    reassure: EFFECTS.reassure.win,
    apologize: EFFECTS.apologize.win,
    persuade: EFFECTS.persuade.win,
    flirt: EFFECTS.flirt.win
});

function proseLedger() {
    if (!state.proseLog || typeof state.proseLog !== 'object') state.proseLog = {};
    return state.proseLog;
}

// Undo an earlier swipe of the same message. Straight subtraction, no caps and no
// pace multiplier: we are removing exactly what landed, and running it back
// through applyDelta would re-clamp it into something else.
function revertProse(msgId) {
    const led = proseLedger();
    const rec = led[msgId];
    if (!rec) return;
    const npc = state.npcs[rec.key];
    if (npc) {
        for (const k of Object.keys(rec.delta || {})) {
            if (DISPS.includes(k)) npc.disp[k] = clamp(npc.disp[k] - rec.delta[k], 0, 100);
            else if (npc.pulse[k] != null) npc.pulse[k] = clamp(npc.pulse[k] - rec.delta[k], 0, 100);
        }
    }
    delete led[msgId];
}

// Both engines share one secondary endpoint. Firing the prose read at the same
// instant as the status bar's own call doubled the request rate on every single
// message, which is enough to get rate-limited on a free key — and a 429 there
// stalls the panel, not this. So the read waits its turn, and never queues behind
// itself while the player swipes.
let proseBusy = false;
async function readCharProse(msgId) {
    if (!settings.enabled || !settings.charProse || !settings.classify) return;
    if (proseBusy) { dbg('prose read skipped — one already in flight'); return; }
    if (!state || !ownsChat(getContext().chatId)) return;
    if (!hasKey() || mapSolo()) return;

    const chat = getContext().chat || [];
    const msg = chat[msgId];
    if (!msg || msg.is_user || msg.is_system || !msg.name) return;
    const text = String(msg.mes || '').trim();

    // Whatever the previous swipe of this very message paid out is taken back
    // first, so swiping cannot stack. If the new swipe reads as "none", the revert
    // still stands and the turn is simply worth nothing.
    revertProse(msgId);
    if (text.length < 12) return;

    const npc = ensureNpc(msg.name);
    if (!npc || npc.conflict) return;
    // The engine already opened this turn on its own and already paid the echo for
    // it. Reading the prose it asked for would bill the same gesture twice.
    if (npc.pendingInit) { dbg('prose skipped — initiative already paid this turn', { name: npc.name, move: npc.pendingInit }); return; }

    let res = null;
    proseBusy = true;
    try {
        await new Promise(r => setTimeout(r, 2500));   // let the status bar go first
        res = await withTimeout(callAI(CLASSIFY_CHAR_SYS, `Character: ${msg.name}\nPlayer is: ${userName()}\n\nReply to label:\n${text.slice(0, 900)}`, 120), 9000);
    } catch (e) { dbg('prose classify failed', String(e && e.message)); return; }
    finally { proseBusy = false; }

    const actRaw = String(res && res.act || 'none');
    const warmRaw = String(res && res.warm || 'none');
    const A = ACTS[actRaw];
    const warm = PROSE_WARM[actRaw];
    // The gesture is only a separate payout when it is not already the main label.
    const extra = (warmRaw !== actRaw && !ACTS[warmRaw]?.tier) ? PROSE_SECOND[warmRaw] : null;
    if (actRaw === 'none' && !extra) return;
    if (actRaw !== 'none' && !A && !warm) return;
    let act = actRaw;
    if (A && A.kind === 'intimacy') {
        if (!settings.intimacy) return;
        // Prose may confirm the ground already stood on, never claim new ground.
        // But dropping the whole reply for it was too blunt: a model that writes an
        // embrace before the story has earned one has still written contact, and the
        // touch inside that embrace really did happen. So it is credited DOWN to the
        // furthest rung actually reached, never up. Escalation stays impossible —
        // maxTier is still only ever raised by a real check.
        const ceiling = TIER_LADDER[npc.maxTier];
        if ((A.tier || 1) > npc.maxTier + 1) {
            if (!ceiling) { dbg('prose ignored — no rung reached yet', { act: actRaw }); return; }
            dbg('prose downgraded to the reached rung', { from: actRaw, to: ceiling, maxTier: npc.maxTier });
            act = ceiling;
        }
    }

    const intensity = clamp(num(res.intensity, 2), 1, 3);
    const scale = clamp(num(settings.charProseWeight, 40), 0, 100) / 100 * (0.75 + intensity * 0.125);
    const main = (actRaw === 'none') ? null : (PROSE_WARM[act] || (EFFECTS[act] && EFFECTS[act].win) || null);
    // A gesture alongside something bigger is a grace note, not a second event, so
    // it pays half. Both together still cannot exceed what one full win would give.
    const src = {};
    for (const k of Object.keys(main || {})) src[k] = main[k];
    for (const k of Object.keys(extra || {})) src[k] = num(src[k], 0) + extra[k] * (main ? 0.5 : 1);
    // Letting the second slot carry reassure and apologize is what makes a scene
    // like "he steadies her AND calms her down" readable at all — but those two are
    // the strongest movers in the game, and stacked onto a physical act they were
    // starting to pay out like a won check. Hence a ceiling, and one stated as a
    // rule rather than a number: doing two things at once may never pay more than
    // the better of the two would have paid alone. Only the overlap is trimmed, and
    // only when there really are two sources — a lone act keeps its full value, and
    // a stat only one of them touches is left alone. Pulse is exempt: it decays.
    if (main && extra) {
        for (const k of Object.keys(src)) {
            if (!DISPS.includes(k)) continue;
            const ceiling = Math.max(num(main[k], 0), num(extra[k], 0));
            if (ceiling > 0 && src[k] > ceiling) src[k] = ceiling;
        }
    }
    if (!Object.keys(src).length) return;

    // Pulse answers nearly in full — the temperature of a scene is the one thing
    // prose really does establish, and it bleeds off by itself within a few turns.
    // Dispositions are the part that never decays, so they get the discount.
    const echo = {};
    for (const k of Object.keys(src)) echo[k] = src[k] * (DISPS.includes(k) ? scale : Math.min(1, scale * 2));

    const before = Object.assign({}, npc.disp, npc.pulse);
    applyDelta(npc, echo);
    const delta = {};
    for (const k of Object.keys(before)) {
        const now = DISPS.includes(k) ? npc.disp[k] : npc.pulse[k];
        if (Math.abs(now - before[k]) > 1e-9) delta[k] = now - before[k];
    }

    const led = proseLedger();
    led[msgId] = { key: npc.key, act, warm: warmRaw, delta };
    // The ledger is only ever needed for messages still on screen and swipeable.
    const keys = Object.keys(led);
    if (keys.length > 40) for (const k of keys.sort((a, b) => a - b).slice(0, keys.length - 40)) delete led[k];

    dbg('prose read', { name: npc.name, act: actRaw, credited: act, warm: warmRaw, intensity, delta });
    // No checkStage() here on purpose. A stage is a thing the story decides; letting
    // prose promote a relationship would mean the model narrating its own promotion.
    saveState(true); updateInjections(); renderAlbum();
}

// ============================================================
// PROMPT ASSEMBLY
// Three keys, deliberately separate. The profile is stable across turns so it
// stays cacheable; the verdict is volatile and sits at depth 0 where it cannot be
// argued with; the prose guard goes in last and is never mixed with either.
// ============================================================
const PROSE_RULES = 'NATURAL HUMAN PROSE: Write like a human novelist, not an AI simulating a character: stay immersed in the scene without meta-commentary, OOC remarks, forced questions, excessive aggression, melodrama, repetitive emotional cues, over-explained body language, mechanical gestures, unnecessary precision, pointless timestamps, object-fidgeting, or terse one-word/fragmentary replies. Let emotions, dialogue, actions, and pacing emerge naturally from context without narrating or explaining every reaction.';

function lang() { return settings.language === 'ru' ? 'ru' : 'en'; }

// Notable traits only. A mid-range value says nothing worth paying tokens for.
function traitPhrases(npc, limit = 3) {
    const L = TRAIT_WORDS[lang()];
    const scored = TRAITS
        .map(k => ({ k, v: npc.traits[k], dist: Math.abs(npc.traits[k] - 50) }))
        .filter(x => x.v <= 35 || x.v >= 65)
        .sort((a, b) => b.dist - a.dist)
        .slice(0, limit);
    return scored.map(x => gform(L[x.k][x.v >= 65 ? 1 : 0], npc.gender));
}

function dispPhrases(npc, limit = 3) {
    const L = DISP_WORDS[lang()];
    const scored = DISPS
        .map(k => ({ k, v: npc.disp[k], dist: Math.abs(npc.disp[k] - 45) }))
        .filter(x => x.v <= 25 || x.v >= 62)
        .sort((a, b) => b.dist - a.dist)
        .slice(0, limit);
    return scored.map(x => gform(L[x.k][x.v >= 62 ? 1 : 0], npc.gender));
}

function stageName(npc) { return gform(t('stage_' + npc.stage), npc.gender); }

function capFirst(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

function moodWord(npc) {
    const bands = MOOD_WORDS[lang()];
    const m = npc.pulse.mood;
    for (const [lo, hi, w] of bands) if (m >= lo && m < hi) return gform(w, npc.gender);
    return gform(bands[2][2], npc.gender);
}

// The NPCs worth describing: the one being addressed, plus at most one more that
// is actually in the scene. Six pages in state, two in the prompt.
function promptNpcs() {
    const keys = Object.keys(state.npcs);
    if (!keys.length) return [];
    keys.sort((a, b) => num(state.npcs[b].lastSeenTurn, -99) - num(state.npcs[a].lastSeenTurn, -99));
    const picked = [];
    if (state.active && state.npcs[state.active]) picked.push(state.npcs[state.active]);
    for (const k of keys) {
        if (picked.length >= 2) break;
        if (picked.some(n => n.key === k)) continue;
        // The staleness window applies to hand-added pages exactly as it does to any
        // other. Exempting them looked like a fix for "she was added but never reaches
        // the prompt" — the real fix is that rosterAdd stamps lastSeenTurn on creation,
        // which puts her in the scene now and lets her fall out of it later like
        // everyone else. Exempt, she would keep rolling initiative and taking offence
        // in scenes she is not in, for the rest of the chat.
        if (state.turn - num(state.npcs[k].lastSeenTurn, -99) > 6) continue;
        picked.push(state.npcs[k]);
    }
    return picked;
}

function buildProfileText() {
    const you = userName();
    const out = [];
    const list = promptNpcs();
    list.forEach((npc, i) => {
        // The character being addressed gets the full sketch; anyone else in the
        // scene gets a thumbnail. Two full profiles is where this stops being cheap.
        const wide = i === 0;
        const tr = traitPhrases(npc, wide ? 3 : 2);
        // Semicolons, because several phrases contain commas of their own.
        const line1 = `${npc.name} — ${stageName(npc)}.` + (tr.length ? ` ${capFirst(tr.join('; '))}.` : '');
        const dp = dispPhrases(npc, wide ? 3 : 1);
        const bits = [];
        if (dp.length) bits.push(`${t('p_toward', { user: you })}: ${dp.join('; ')}`);
        bits.push(`${t('p_now')}: ${moodWord(npc)}`);
        let block = gform(`[${line1} ${bits.join('. ')}.]`, npc.gender);
        const evN = clamp(num(settings.promptEvents, 2), 0, 10);
        if (wide && evN && npc.events.length) block += `\n[${t('p_remembers')}: ${npc.events.slice(-evN).join('; ')}.]`;
        if (wide && settings.courtship && npc.disp.attraction > 25) {
            block += `\n[${gform(t('p_courting', { name: npc.name, user: you }), npc.gender)}]`;
        }
        if (wide) {
            // One of each, most recent. Storing memories is free; spending the prompt
            // on all ten is not, so only the freshest of either colour is shown.
            const bits = [];
            if (npc.good.length) bits.push(`${t('p_good')}: ${npc.good[npc.good.length - 1]}`);
            if (npc.bad.length) bits.push(`${gform(t('p_bad'), npc.gender)}: ${npc.bad[npc.bad.length - 1]}`);
            if (bits.length) block += `\n[${bits.join('. ')}.]`;
            const vp = viewPhrases(npc, list);
            if (vp.length) block += `\n[${vp.join('. ')}.]`;
        }
        out.push(block);
    });
    return out.join('\n');
}

function buildVerdictText() {
    const you = userName();
    const lines = [];
    const v = state.verdict;

    if (v && state.npcs[v.key]) {
        const npc = state.npcs[v.key];
        const head = `[${t('p_check')} — ${t('act_' + v.act)}: ${t('res_' + v.res)} (${v.roll} ${t('p_vs')} ${v.dc}).`;
        let tail;
        if (v.res === 'crit_fail') tail = `${t('p_crit_fail')} ${t('p_stay_failed')}`;
        else if (v.res === 'crit_success') tail = `${t('p_crit_win')} ${t('p_stay_won')}`;
        else tail = v.won ? t('p_stay_won') : t('p_stay_failed');
        lines.push(gform(`${head} ${tail}]`, npc.gender));
        if (v.walked) lines.push(gform(`[${t('p_walk', { name: npc.name })}]`, npc.gender));
    }

    for (const npc of promptNpcs()) {
        if (npc.conflict) {
            const style = CONFLICT_STYLE[lang()][npc.conflict.style] || CONFLICT_STYLE[lang()].flat;
            const heat = t('heat_' + heatBand(npc));
            lines.push(gform(`[${t('p_conflict', { name: npc.name, user: you, topic: npc.conflict.topic, style, heat })}]`, npc.gender));
        }
        if (npc.justResolved) lines.push(`[${t('p_conflict_end', { name: npc.name, user: you })}]`);
        if (npc.stageJustChanged) lines.push(gform(`[${t('p_stage_up', { name: npc.name, user: you, stage: stageName(npc) })}]`, npc.gender));
        if (npc.pendingInit) lines.push(gform(`[${t('p_init', { name: npc.name, what: t('init_' + npc.pendingInit, { user: you }) })}]`, npc.gender));
    }
    return lines.join('\n');
}

function dbg(label, payload) {
    if (!settings.debug) return;
    console.log('[Bonds] ' + label, payload);
}

// ============================================================
// SOLO BRIDGE — RPG Map & Locations Engine
// The map engine can send the player off to explore on their own. There is nobody
// in the scene then, so there is nothing to measure: an empty room cannot make
// anyone fonder or cooler, and a pulse that decays through an hour of walking
// would quietly undo a scene the player is coming straight back to.
// Read-only, at request time, exactly like the API-key borrowing above — if the
// map extension is absent or switched off this is a no-op and everything runs
// as it always did.
// ============================================================
const MAP_MODULE = 'rpg_map_engine';

function mapSolo() {
    if (!settings.pauseWhenSolo) return false;
    try {
        // Preferred path: the map engine's own public bridge, if it ever exposes this.
        const bridge = (typeof window !== 'undefined' && window.RPG && window.RPG.map) || null;
        if (bridge && typeof bridge.isSolo === 'function') {
            if (typeof bridge.isEnabled === 'function' && !bridge.isEnabled()) return false;
            return !!bridge.isSolo();
        }
        // Fallback: read the stored per-chat map state directly.
        const m = extension_settings[MAP_MODULE];
        if (!m || !m.enabled || !m.mapStates) return false;
        const chatId = getContext().chatId;
        if (!chatId) return false;
        const ms = m.mapStates[chatId];
        return !!(ms && ms.isSolo);
    } catch (e) {
        // A neighbour with broken settings must never freeze this engine shut.
        return false;
    }
}

function clearInjections() {
    setExtensionPrompt(KEY_PROFILE, '', 2, 1, false, extension_prompt_roles.SYSTEM);
    setExtensionPrompt(KEY_VERDICT, '', 2, 0, false, extension_prompt_roles.SYSTEM);
    setExtensionPrompt(KEY_PROSE, '', 2, 0, false, extension_prompt_roles.SYSTEM);
}

function updateInjections() {
    // Wandering alone injects nothing at all: a profile block describing someone
    // who is not there is noise the model will try to use.
    if (!settings.enabled || mapSolo()) {
        clearInjections();
        return;
    }
    const depth = clamp(num(settings.injectDepth, 1), 0, 12);
    // Each block is built independently and falls back to nothing. If assembling the
    // profile throws, the verdict must still be replaced — leaving a stale verdict in
    // place would narrate a check that already happened all over again. An empty block
    // costs the player a little context; a stale one rewrites their story.
    const safe = (fn) => { try { return fn() || ''; } catch (e) { console.error('[Bonds] block failed:', e); return ''; } };
    const profile = safe(buildProfileText), verdict = safe(buildVerdictText);
    setExtensionPrompt(KEY_PROFILE, profile, 2, depth + 1, false, extension_prompt_roles.SYSTEM);
    setExtensionPrompt(KEY_VERDICT, verdict, 2, 0, false, extension_prompt_roles.SYSTEM);
    setExtensionPrompt(KEY_PROSE, settings.proseGuard ? PROSE_RULES : '', 2, 0, false, extension_prompt_roles.SYSTEM);
    dbg('injected', { profile, verdict, proseGuard: !!settings.proseGuard, depth });
}

// ============================================================
// TURN FLOW
// ============================================================
function defaultTargetName(names) {
    if (state.active && state.npcs[state.active]) return state.npcs[state.active].name;
    return names[0] || getContext().name2 || '';
}

// SillyTavern awaits this handler inside its generation pipeline, so an exception
// escaping from here does not merely break the engine — it takes the player's reply
// down with it. A relationship tracker failing must never cost someone their message,
// so the turn is wrapped and the injections are refreshed whatever happens.
async function onPlayerMessage() {
    if (!settings.enabled) return;
    const chatId = getContext().chatId;
    if (!stateReady || currentChatId !== chatId) loadState(chatId);
    if (!ownsChat(chatId)) return;

    // Exploring alone: the whole layer stands still. The turn counter does not
    // advance either — cooldowns, the demotion grace window and the "she has not
    // been seen for a while" arithmetic all count exchanges WITH someone, and a
    // solo trip is not one. Everything resumes on exactly the number it left on.
    if (mapSolo()) {
        if (!state.soloPaused) {
            state.soloPaused = true;
            // A verdict rolled before the trip must not survive it and get narrated
            // on the far side, hours of story later.
            state.verdict = null;
            for (const key of Object.keys(state.npcs)) {
                const n = state.npcs[key];
                n.justResolved = false; n.stageJustChanged = false; n.pendingInit = null;
            }
            dbg('solo mode — engine paused', { turn: state.turn });
            toastr.info(t('toast_solo_on'));
        }
        try { updateInjections(); saveState(); renderAlbum(); }
        catch (e) { console.error('[Bonds] could not refresh while paused:', e); }
        return;
    }
    if (state.soloPaused) {
        state.soloPaused = false;
        dbg('back in company — engine resumed', { turn: state.turn });
        toastr.info(t('toast_solo_off'));
    }

    try {
        await runPlayerTurn();
    } catch (e) {
        console.error('[Bonds] turn failed, the story continues without it:', e);
    } finally {
        // Without this, an error mid-turn would leave the PREVIOUS turn's verdict
        // injected, and a check that already happened would be narrated a second time.
        try { updateInjections(); saveState(); renderAlbum(); }
        catch (e) { console.error('[Bonds] could not refresh after a failed turn:', e); }
    }
}

async function runPlayerTurn() {
    state.turn++;
    // One-shot signals are cleared now, on the next real player message, rather
    // than after the reply — that is what makes a regeneration reproducible.
    state.verdict = null;
    for (const key of Object.keys(state.npcs)) {
        const npc = state.npcs[key];
        npc.justResolved = false;
        npc.stageJustChanged = false;
        npc.pendingInit = null;
        // Time has passed since the last exchange: she cools off, the argument heats
        // up. Doing this here rather than after the reply means the whole prompt for
        // this turn is settled before a single token is generated, which is what makes
        // every swipe of that reply identical to the first.
        pulseTick(npc);
    }
    const names = rosterNames();
    let target = defaultTargetName(names);
    let act = 'none', ctx = { intensity: 2, privacy: 40, alcohol: 0 };
    let unread = false;

    // A dead endpoint costs nine seconds of timeout per message. After three failures
    // in a row the engine stops asking for a while instead of making the player wait
    // on every single line, and starts again by itself later.
    const backedOff = state.turn < classifySkipUntil;
    if (settings.classify && hasKey() && !classifyBusy && !backedOff) {
        classifyBusy = true;
        try {
            const res = await classifyIntent(names);
            // Announce the recovery only if the outage itself was announced. One or two
            // silent hiccups followed by a success used to pop up "answering again" with
            // nothing before it, which reads as a message about nothing.
            classifyFails = 0;
            if (classifyWarned) { classifyWarned = false; toastr.success(t('toast_classify_on')); }
            if (res) {
                const nm = aiName(res.target);
                // Only trust a name we already know about, otherwise the classifier
                // inventing a character would open a page for a person who does not exist.
                if (nm && names.some(n => nameKey(n) === nameKey(nm))) target = nm;
                if (typeof res.act === 'string' && ACTS[res.act]) act = res.act;
                ctx = {
                    intensity: clamp(num(res.intensity, 2), 1, 3),
                    privacy: clamp(num(res.privacy, 40), 0, 100),
                    alcohol: clamp(num(res.alcohol, 0), 0, 100)
                };
            }
        } catch (e) {
            // The turn is unreadable rather than uneventful: we do not know what the
            // player did, so nothing is credited to it either way.
            unread = true;
            console.warn('[Bonds] classify failed', e);
            // A missing key is not a flaky endpoint. It must not spend the back-off
            // budget, and it must not abort the rest of the turn either.
            const noKey = !!(e && e.message === 'no-key');
            if (!noKey) classifyFails++;
            if (!noKey && classifyFails >= 3) {
                classifySkipUntil = state.turn + 10;
                classifyWarned = true;
                toastr.warning(t('toast_classify_off'));
            }
        } finally { classifyBusy = false; }
    }

    dbg('turn ' + state.turn, {
        target, act, ctx, unread,
        classifier: !settings.classify || !hasKey() ? 'OFF (no key or disabled)'
            : backedOff ? 'BACKED OFF until turn ' + classifySkipUntil : 'on'
    });
    const npc = ensureNpc(target);
    if (!npc) { dbg('no target resolved', { names }); updateInjections(); return; }
    npc.lastSeenTurn = state.turn;
    state.active = npc.key;

    if (act !== 'none' && !(ACTS[act].kind === 'intimacy' && !settings.intimacy)) {
        const out = resolveCheck(npc, act, ctx);
        dbg('check', out);
        if (out) state.verdict = Object.assign({ key: npc.key }, out);
        if (out && out.walked) toastr.info(t('toast_walk', { name: npc.name }));
    } else {
        state.verdict = null;
        // Only a turn we could actually read counts as quiet time together.
        if (!unread) { familiarityTick(npc); checkStage(npc); }
    }

    // Initiative belongs to whoever is in the scene, not only to the character the
    // player last addressed — otherwise nobody else in a group chat ever acts. At most
    // one opens per turn, or a group scene turns into a scrum.
    //
    // It is rolled HERE, before the reply is generated, and not after it. Rolled after,
    // it only ever existed in the window between a reply and the next player message —
    // which is the swipe window and nothing else, so in normal play the model never saw
    // it at all, while a swipe would suddenly gain a move the original reply never had.
    // Deciding everything before generation is also what makes swipes identical.
    if (!(state.verdict && (state.verdict.walked || state.verdict.res === 'hard_fail' || state.verdict.res === 'crit_fail'))) {
        for (const other of promptNpcs()) {
            const move = rollInitiative(other);
            if (move) {
                other.pendingInit = move;
                // Every kind of move she makes has to leave a trace, or half the story
                // is invisible to the engine. When SHE initiates a kiss there is no dice
                // roll — and until now that meant no arousal, no attraction, nothing in
                // the log, even though the scene plainly happened. Whatever she starts,
                // the temperature of the moment changes.
                const WARM = { compliment: { mood: 4, attraction: 1 }, gift: { mood: 6, affection: 2, comfort: 1 },
                    date: { mood: 3, excitement: 4 }, remember: { trust: 2, comfort: 2, mood: 4 },
                    // An invitation lifts the evening; naming a grievance out loud tightens
                    // it. Neither is a check, but neither is nothing either.
                    plan: { mood: 3, excitement: 3, comfort: 1 }, confront: { mood: -2, excitement: 4 } };
                if (move === 'mend') { applyDelta(other, { comfort: 1, mood: 5 }); other.mendUntil = -99; }
                else if (WARM[move]) applyDelta(other, WARM[move]);
                else if (move === 'offer') applyDelta(other, { arousal: 10, excitement: 8, mood: 3 });
                else if (EFFECTS[move] && EFFECTS[move].win) {
                    // Pulse answers nearly in full: the moment is charged either way.
                    // Dispositions only partly — whether it lands is the player's to decide.
                    const w = EFFECTS[move].win, echo = {};
                    for (const k of Object.keys(w)) echo[k] = w[k] * (DISPS.includes(k) ? 0.4 : 0.8);
                    applyDelta(other, echo);
                }
                // A proposal or a confession from her side is only half the event:
                // whether it was accepted is the player's call, not the engine's.
                // Rather than assume, the matching chip starts asking to be confirmed.
                if (ACTS[move] && ACTS[move].milestone && !other.milestones[ACTS[move].milestone]) {
                    other.awaiting = ACTS[move].milestone;
                }
                break;
            }
        }
    }

}

function onCharacterReply() {
    if (!settings.enabled || !ownsChat(getContext().chatId)) return;
    // While exploring alone the reply is the world talking, not a person. Recording
    // a speaker here would open a page for the narrator and mark absent characters
    // as present for a scene they were never in.
    if (mapSolo()) {
        try { updateInjections(); } catch (e) { }
        return;
    }
    try { runCharacterReply(); }
    catch (e) { console.error('[Bonds] reply bookkeeping failed:', e); }
    try { updateInjections(); saveState(); renderAlbum(); }
    catch (e) { console.error('[Bonds] could not refresh after a reply:', e); }
}

function runCharacterReply() {

    // Whoever just spoke gets a page, even if the player never addressed them.
    // Without this, only the character being talked to is ever tracked, and every
    // other member of a group chat stays invisible to the engine.
    try {
        const chat = getContext().chat || [];
        const last = chat[chat.length - 1];
        // A provider that returns an empty message has not introduced anyone.
        if (last && !last.is_user && !last.is_system && last.name && String(last.mes || '').trim()) {
            const speaker = ensureNpc(last.name);
            if (speaker) speaker.lastSeenTurn = state.turn;
        }
    } catch (e) { }

    // A regeneration re-fires this event for the same turn. Ticking again would
    // decay the pulse twice and re-roll initiative, and clearing the verdict would
    // leave the reroll with no idea that a check ever happened — the reroll would
    // quietly rewrite a failure into a success. So one turn is processed once, and
    // the verdict lives until the player actually says something new.
    // Nothing here may change what the prompt says, or a swipe would differ from the
    // reply it replaces. The pulse, the initiative and the check all happened before
    // generation; this only records who spoke.
    if (state.lastReplyTurn === state.turn) return;
    state.lastReplyTurn = state.turn;
    if (state.npcs[state.active]) state.npcs[state.active].lastSeenTurn = state.turn;
}

// ============================================================
// UI — "The Album": one page per person, kept in a cloth-bound book.
// The ceiling notch on every bar is the whole design thesis made visible: you can
// see, at a glance, how far this particular woman is ever going to go.
// ============================================================
function stageStamp(npc) {
    const stage = npc.stage;
    const cls = ['dating', 'girlfriend', 'partner', 'wife', 'stable'].includes(stage) ? 'warm'
        : (['fwb', 'crush'].includes(stage) ? 'hot' : 'cool');
    return `<span class="tbe-stamp tbe-stamp-${cls}">${escapeHtml(stageName(npc))}</span>`;
}

function barRow(label, value, cap, key, editable) {
    const v = clamp(Math.round(value), 0, 100);
    const c = cap == null ? null : clamp(Math.round(cap), 0, 100);
    const notch = c == null ? '' : `<i class="tbe-cap" style="left:${c}%" title="${escapeHtml(t('ceiling'))}: ${c}"></i>`;
    return `<div class="tbe-row">
        <span class="tbe-row-label">${escapeHtml(label)}</span>
        <span class="tbe-bar${editable ? ' tbe-editable' : ''}" data-key="${escapeHtml(key || '')}">
            <i class="tbe-fill" style="width:${v}%"></i>${notch}
        </span>
        <span class="tbe-row-val">${v}</span>
    </div>`;
}

// The last roll deserves to look like a roll. A list of numbers told the player what
// happened; a die tells them it happened to them. Older entries stay in state and
// surface in GM mode, so nothing is actually lost.
function checkCard(e) {
    const cls = e.res === 'crit_success' ? 'crit' : e.res === 'crit_fail' ? 'crit-fail'
        : isWin(e.res) ? 'win' : 'lose';
    const nat = (e.roll === 20 || e.roll === 1) ? ' tbe-die-nat' : '';
    return `<div class="tbe-check tbe-check-${cls}">
        <span class="tbe-die${nat}"><b>${e.roll}</b></span>
        <span class="tbe-check-info">
            <span class="tbe-check-act">${escapeHtml(t('act_' + e.act))}</span>
            <span class="tbe-check-dc">${escapeHtml(t('p_vs'))} ${e.dc}</span>
            <span class="tbe-check-res">${escapeHtml(t('res_' + e.res))}</span>
        </span>
    </div>`;
}

function logRow(e) {
    const cls = isWin(e.res) ? (e.res === 'crit_success' ? 'crit' : 'win') : (e.res === 'crit_fail' ? 'crit-fail' : 'lose');
    return `<div class="tbe-log-row">
        <span class="tbe-log-act">${escapeHtml(t('act_' + e.act))}</span>
        <span class="tbe-log-roll">${e.roll} / ${e.dc}</span>
        <span class="tbe-seal tbe-seal-${cls}">${escapeHtml(t('res_' + e.res))}</span>
    </div>`;
}

function npcPageHtml(npc) {
    const caps = dispCap(npc.traits);
    // Three, same as the prompt gets: the phrases are sorted by how far the trait sits
    // from the middle, so a fourth adds a row of height for the weakest signal on the page.
    const words = traitPhrases(npc, 3);
    const archName = I18N.en['arch_' + npc.archetype] ? gform(t('arch_' + npc.archetype), npc.gender) : '';
    let html = `<div class="tbe-page" data-key="${escapeHtml(npc.key)}">
        <div class="tbe-page-head">
            <span class="tbe-page-name">${escapeHtml(npc.name)}</span>
            ${stageStamp(npc)}
        </div>
        ${archName ? `<div class="tbe-arch"><span class="tbe-arch-label">${escapeHtml(t('arch_label'))}</span><b>${escapeHtml(archName)}</b></div>` : ''}
        <div class="tbe-traits">${words.length
        ? words.map(w => `<span class="tbe-trait"><i class="tbe-seal-dot"></i>${escapeHtml(w)}</span>`).join('')
        : `<span class="tbe-trait tbe-trait-wait"><i class="tbe-seal-dot"></i>${escapeHtml(t('no_profile'))}</span>`}</div>
        <div class="tbe-gender" title="${escapeHtml(t('gm_gender_card'))}">
            <span class="tbe-gender-label">${escapeHtml(t('gm_gender'))}</span>
            <button class="tbe-gender-opt${npc.gender !== 'm' ? ' on' : ''}" data-g="f">${escapeHtml(t('g_f'))}</button>
            <button class="tbe-gender-opt${npc.gender === 'm' ? ' on' : ''}" data-g="m">${escapeHtml(t('g_m'))}</button>
        </div>`;

    /* Archetype picker, GM mode only — same place and the same shape as the gender
       control right above it. Shown only when editing, because for normal play the
       archetype is something the model reads off the card, not a dial. */
    if (settings.gmMode) {
        const opts = ARCH_ORDER.map(a =>
            `<option value="${a}"${npc.archetype === a ? ' selected' : ''}>${escapeHtml(gform(t('arch_' + a), npc.gender))}</option>`
        ).join('');
        html += `<div class="tbe-archpick" title="${escapeHtml(t('gm_arch_card'))}">
            <span class="tbe-gender-label">${escapeHtml(t('gm_arch'))}</span>
            <select class="tbe-arch-sel">${opts}</select>
        </div>`;
    }

    if (npc.conflict) {
        const style = CONFLICT_STYLE[lang()][npc.conflict.style] || '';
        html += `<div class="tbe-conflict"><i class="fa-solid fa-fire"></i> ${escapeHtml(npc.conflict.topic)} — ${escapeHtml(style)}</div>`;
    }

    html += `<div class="tbe-sect">${escapeHtml(t('disp'))}</div><div class="tbe-grid">`;
    for (const k of DISPS) html += barRow(t(k), npc.disp[k], caps[k], 'disp:' + k, settings.gmMode);
    html += `</div>`;

    html += `<div class="tbe-sect">${escapeHtml(t('pulse'))}</div><div class="tbe-grid">`;
    html += barRow(t('mood'), npc.pulse.mood, null, 'pulse:mood', settings.gmMode);
    html += barRow(t('arousal'), npc.pulse.arousal, null, 'pulse:arousal', settings.gmMode);
    html += barRow(t('excitement'), npc.pulse.excitement, null, 'pulse:excitement', settings.gmMode);
    html += `</div>`;

    if (npc.events.length) {
        html += `<div class="tbe-sect">${escapeHtml(t('p_remembers'))}</div><div class="tbe-events">`;
        for (const e of npc.events.slice().reverse()) {
            html += `<div class="tbe-event"><i class="tbe-seal-dot"></i>${escapeHtml(e)}</div>`;
        }
        html += `</div>`;
    }

    html += `<div class="tbe-sect">${escapeHtml(t('milestones'))}</div>
        <div class="tbe-ms" title="${escapeHtml(t('ms_hint'))}">`;
    for (const m of MILESTONES) {
        const gate = GATES.find(g => g.milestone === m);
        const tip = gate ? t('ms_unlocks', { stage: gform(t('stage_' + gate.to), npc.gender) }) : '';
        const far = gate && !gate.from.includes(npc.stage);
        const asked = npc.awaiting === m && !npc.milestones[m];
        html += `<span class="tbe-chip${npc.milestones[m] ? ' done' : ''}${far ? ' far' : ''}${asked ? ' asked' : ''}" data-ms="${m}" title="${escapeHtml(asked ? t('ms_asked') : tip)}">${escapeHtml(t('ms_' + m))}</span>`;
    }
    html += `</div>`;

    const next = nextStages(npc);
    if (next.length) {
        html += `<div class="tbe-sect">${escapeHtml(t('next_stage'))}</div><div class="tbe-next">`;
        for (const g of next) {
            const bits = g.missing.map(m => `${escapeHtml(t(m.key))} ${m.have}/${m.need}`);
            if (g.milestone) bits.push(`${escapeHtml(t('ms_' + g.milestone))} — ${escapeHtml(t('gate_locked'))}`);
            const ready = !bits.length;
            html += `<div class="tbe-next-row${ready ? ' ready' : ''}">
                <span class="tbe-next-to">${escapeHtml(gform(t('stage_' + g.to), npc.gender))}</span>
                <span class="tbe-next-need">${ready ? '<i class="fa-solid fa-check"></i>' : escapeHtml(t('gate_need')) + ': ' + bits.join(', ')}</span>
            </div>`;
        }
        html += `</div>`;
    }

    if (npc.good.length || npc.bad.length) {
        html += `<div class="tbe-sect">${escapeHtml(t('mem_g'))} / ${escapeHtml(t('mem_b'))}</div><div class="tbe-events">`;
        for (const e of npc.good.slice().reverse()) html += `<div class="tbe-event tbe-good"><i class="tbe-seal-dot"></i>${escapeHtml(e)}</div>`;
        for (const e of npc.bad.slice().reverse()) html += `<div class="tbe-event tbe-bad"><i class="tbe-seal-dot"></i>${escapeHtml(e)}</div>`;
        html += `</div>`;
    }

    const others = Object.keys(npc.views || {}).filter(k => state.npcs[k]);
    if (others.length) {
        html += `<div class="tbe-sect">${escapeHtml(t('views'))}</div>`;
        for (const k of others.sort((a, b) => npc.views[a] - npc.views[b])) {
            html += barRow(state.npcs[k].name, num(npc.views[k], 0) / 2 + 50, null, 'view:' + k, false);
        }
    }

    if (npc.log.length) {
        html += `<div class="tbe-sect">${escapeHtml(t('log'))}</div>`;
        html += checkCard(npc.log[npc.log.length - 1]);
        if (settings.gmMode && npc.log.length > 1) {
            html += `<div class="tbe-log">`;
            for (const e of npc.log.slice(-4, -1).reverse()) html += logRow(e);
            html += `</div>`;
        }
    }

    if (settings.gmMode) {
        html += `<div class="tbe-gm">
            <div class="tbe-gm-hint">${escapeHtml(t('gm_hint'))}</div>
            <label>${escapeHtml(t('gm_stage'))}
                <select class="tbe-gm-stage text_pole">
                    ${STAGE_ORDER.concat(['fwb', 'stable']).map(x => `<option value="${x}"${x === npc.stage ? ' selected' : ''}>${escapeHtml(gform(t('stage_' + x), npc.gender))}</option>`).join('')}
                </select>
            </label>
            <div class="tbe-gm-btns">
                <button class="tbe-btn tbe-reroll">${escapeHtml(t('btn_reroll'))}</button>
                <button class="tbe-btn tbe-danger tbe-forget">${escapeHtml(t('btn_forget'))}</button>
            </div>
        </div>`;
    }
    html += `</div>`;
    return html;
}


// ============================================================
// THE ROSTER — adding someone by hand
// Auto-detection reads the group member list, the chat card and whoever actually
// speaks. That covers most chats and misses some: a character who has not said a
// word yet, a card whose display name differs from the name in the prose, a group
// the engine joined halfway through. Rather than make the detection cleverer and
// wronger, this is the manual door — the same door, opened by the player.
//
// Everything written here goes into THIS chat's state and nowhere else. The chat
// guard is checked before a single key is touched, because writing a page into a
// state object that belongs to a chat we already left is the one mistake here that
// silently corrupts someone else's story.
// ============================================================
const ROSTER_MAX = 6;

// Every CARD the engine could offer, grouped by where it came from. Cards only:
// a page has to be attached to something the story can be matched against, and a
// name typed into a box is attached to nothing.
function rosterCandidates() {
    const ctx = getContext();
    const here = chatCards().filter(c => aiName(c.name));
    const all = [];
    try {
        for (const c of (ctx.characters || [])) {
            if (!aiName(c && c.name)) continue;
            if (all.some(x => x.avatar === c.avatar)) continue;
            all.push(c);
        }
    } catch (e) { }
    all.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return { here, all, isGroup: !!ctx.groupId };
}

// The one place a page is created by hand. Returns a short reason string on refusal
// so the caller can say what happened instead of failing silently.
function rosterAdd(rawName) {
    const chatId = getContext().chatId;
    if (!chatId) return 'nochat';
    // The state in memory must be the state belonging to the chat on screen. Without
    // this a page added right after switching chats lands in the previous one.
    if (!stateReady || currentChatId !== chatId) loadState(chatId);
    if (!ownsChat(chatId)) return 'nochat';

    const nm = aiName(rawName);
    if (!nm) return 'bad';
    const key = nameKey(nm);
    if (!key) return 'bad';
    // Cards only. Everything downstream — reading a character, surviving a rename,
    // matching the classifier's target — hangs off the card, so a page without one
    // is a page that cannot be kept honest.
    if (!cardFor(nm)) return 'nocard';
    if (state.npcs[key]) return 'dupe';
    if (Object.keys(state.npcs).length >= ROSTER_MAX) return 'full';

    const npc = ensureNpc(nm);
    if (!npc) return 'bad';
    // Asking for someone back overrides having torn them out earlier.
    if (state.dismissed) delete state.dismissed[key];
    // Pinned: added deliberately, so the six-page trim must drop something else first.
    npc.pinned = true;
    npc.lastSeenTurn = state.turn;
    saveState(true);
    renderAlbum();
    updateInjections();
    return null;
}

let rosterOpen = false;
let rosterQuery = '';

function rosterHtml() {
    const { here, all, isGroup } = rosterCandidates();
    const have = (c) => !!(state && state.npcs && state.npcs[nameKey(c.name)]);
    const q = rosterQuery.trim().toLowerCase();
    const row = (c) => `<span class="tbe-pick${have(c) ? ' tbe-pick-have' : ''}" data-name="${escapeHtml(c.name)}"${have(c) ? ` title="${escapeHtml(t('roster_here'))}"` : ''}>${escapeHtml(c.name)}${have(c) ? ' <i class="fa-solid fa-check"></i>' : ''}</span>`;
    const block = (label, cards, extra) => cards.length
        ? `<div class="tbe-pick-group"><h5>${escapeHtml(label)}</h5>${extra || ''}<div class="tbe-pick-row${extra ? ' tbe-pick-scroll' : ''}">${cards.map(row).join('')}</div></div>` : '';

    const hereAvatars = here.map(c => c.avatar);
    const rest = (q ? all.filter(c => String(c.name).toLowerCase().includes(q)) : all)
        .filter(c => !hereAvatars.includes(c.avatar));
    const full = Object.keys(state && state.npcs ? state.npcs : {}).length >= ROSTER_MAX;

    return `<div class="tbe-roster">
        <h4>${escapeHtml(t('roster_title'))}</h4>
        <p class="tbe-roster-note">${escapeHtml(t('roster_note'))}</p>
        ${full ? `<div class="tbe-warn">${escapeHtml(t('roster_full'))}</div>` : ''}
        ${block(isGroup ? t('roster_group') : t('roster_card'), here)}
        ${all.length > here.length
            ? block(t('roster_all'), rest.length ? rest : [],
                `<input type="text" id="tbe-pick-search" class="text_pole" placeholder="${escapeHtml(t('roster_search'))}" value="${escapeHtml(rosterQuery)}">`)
              || `<div class="tbe-pick-group"><h5>${escapeHtml(t('roster_all'))}</h5><input type="text" id="tbe-pick-search" class="text_pole" placeholder="${escapeHtml(t('roster_search'))}" value="${escapeHtml(rosterQuery)}"><div class="tbe-pick-empty">—</div></div>`
            : ''}
        ${!all.length ? `<div class="tbe-pick-empty">${escapeHtml(t('roster_none'))}</div>` : ''}
    </div>`;
}

function rosterFeedback(reason, name) {
    if (!reason) { toastr.success(t('roster_added', { name })); return; }
    if (reason === 'dupe') toastr.info(t('roster_dupe', { name }));
    else if (reason === 'full') toastr.warning(t('roster_full'));
    else if (reason === 'nochat') toastr.warning(t('roster_nochat'));
    else if (reason === 'nocard') toastr.warning(t('roster_nocard', { name }));
}

function bindRosterEvents() {
    $('#tbe-body .tbe-pick').off('click.tbe').on('click.tbe', function () {
        const nm = $(this).attr('data-name') || '';
        if ($(this).hasClass('tbe-pick-have')) { toastr.info(t('roster_dupe', { name: nm })); return; }
        rosterFeedback(rosterAdd(nm), nm);
        renderAlbum();
    });
    $('#tbe-pick-search').off('input.tbe').on('input.tbe', function () {
        rosterQuery = this.value || '';
        const pos = this.selectionStart;
        renderAlbum();
        const el = document.getElementById('tbe-pick-search');
        if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { } }
    });
}

function renderAlbum() {
    // MERGED: the relationship page is also drawn inline inside every message, so any
    // change that redraws the album has to redraw those panes too.
    try { if (typeof window.RPGSB_BONDS_REFRESH === 'function') window.RPGSB_BONDS_REFRESH(); } catch (e) { }
    const $modal = $('#tbe-album');
    if (!$modal.length) return;
    const keys = Object.keys(state && state.npcs ? state.npcs : {});
    const addTab = `<span class="tbe-tab tbe-tab-add" title="${escapeHtml(t('roster_add'))}"><i class="fa-solid fa-plus"></i></span>`;

    if (!keys.length) {
        // An empty album used to be a dead end that only said "go talk to someone".
        // The plus is the way out of it, so it belongs here more than anywhere.
        $('#tbe-tabs').html(addTab);
        $('#tbe-body').html(rosterOpen ? rosterHtml()
            : `<div class="tbe-empty"><h4>${escapeHtml(t('empty_h'))}</h4><p>${escapeHtml(t('empty_p'))}</p>
               <button class="tbe-btn" id="tbe-open-roster"><i class="fa-solid fa-plus"></i> ${escapeHtml(t('roster_add'))}</button></div>`);
        bindTabEvents();
        if (rosterOpen) bindRosterEvents();
        return;
    }
    keys.sort((a, b) => num(state.npcs[b].lastSeenTurn, -99) - num(state.npcs[a].lastSeenTurn, -99));
    if (!state.npcs[state.active]) state.active = keys[0];

    $('#tbe-tabs').html(keys.map(k =>
        `<span class="tbe-tab${!rosterOpen && k === state.active ? ' active' : ''}" data-key="${escapeHtml(k)}">${escapeHtml(state.npcs[k].name)}</span>`
    ).join('') + addTab);

    if (rosterOpen) {
        $('#tbe-tabs .tbe-tab-add').addClass('active');
        $('#tbe-body').html(rosterHtml());
        bindTabEvents();
        bindRosterEvents();
        return;
    }
    $('#tbe-body').html(npcPageHtml(state.npcs[state.active]));
    bindTabEvents();
    bindPageEvents();
}

// Tab clicks are bound separately from the page body: the roster replaces the body
// but the tab row stays, so the two cannot share one binding pass any more.
function bindTabEvents() {
    $('#tbe-tabs .tbe-tab-add').off('click.tbe').on('click.tbe', () => { rosterOpen = !rosterOpen; rosterQuery = ''; renderAlbum(); });
    $('#tbe-open-roster').off('click.tbe').on('click.tbe', () => { rosterOpen = true; rosterQuery = ''; renderAlbum(); });
    $('#tbe-tabs .tbe-tab[data-key]').off('click.tbe').on('click.tbe', function () {
        rosterOpen = false;
        state.active = $(this).attr('data-key');
        saveState(); renderAlbum(); updateInjections();
    });
}

function bindPageEvents() {
    // Tab clicks now live in bindTabEvents. Left here, this selector also caught the
    // "+" tab, which carries no key — one click and the active page became undefined.
    const npc = state.npcs[state.active];
    if (!npc) return;

    $('#tbe-body .tbe-gender-opt').off('click.tbe').on('click.tbe', function () {
        npc.gender = $(this).data('g') === 'm' ? 'm' : 'f';
        saveState(true); renderAlbum(); updateInjections();
    });

    /* Setting the archetype by hand does what the model's answer does: it takes the
       archetype's trait profile as the new baseline. Otherwise the label would say
       "Schemer" over a pragmatist's numbers, and everything downstream — checks,
       ceilings, the phrases on the card — would still behave like a pragmatist.

       The disposition, the stage, the milestones and the history are NOT touched:
       those are what happened between these two, and they do not belong to a type. */
    $('#tbe-body .tbe-arch-sel').off('change.tbe').on('change.tbe', function () {
        const a = String($(this).val() || '');
        if (!ARCHETYPES[a]) return;
        npc.archetype = a;
        npc.traits = clone(ARCHETYPES[a]);
        saveState(true); renderAlbum(); updateInjections();
        toastr.success(t('gm_arch_set', { name: npc.name, arch: gform(t('arch_' + a), npc.gender) }));
    });

    $('#tbe-body .tbe-chip').off('click.tbe').on('click.tbe', function () {
        toggleMilestone(npc, $(this).data('ms'));
        saveState(true); renderAlbum(); updateInjections();
    });

    if (!settings.gmMode) return;

    $('#tbe-body .tbe-bar.tbe-editable').off('click.tbe').on('click.tbe', function (e) {
        const rect = this.getBoundingClientRect();
        const pct = clamp(Math.round(((e.clientX - rect.left) / rect.width) * 100), 0, 100);
        const [group, key] = String($(this).data('key')).split(':');
        if (group === 'disp') npc.disp[key] = pct; else npc.pulse[key] = pct;
        saveState(true); renderAlbum(); updateInjections();
    });
    $('#tbe-body .tbe-gm-stage').off('change.tbe').on('change.tbe', function () {
        npc.stage = $(this).val();
        saveState(true); renderAlbum(); updateInjections();
    });
    $('#tbe-body .tbe-reroll').off('click.tbe').on('click.tbe', async () => {
        npc.profiled = false;
        await buildProfile(npc);
        toastr.info(t('toast_reset'));
        renderAlbum();
    });
    $('#tbe-body .tbe-forget').off('click.tbe').on('click.tbe', () => {
        // Remembered, or the auto-registration would put the page straight back on
        // the next chat load and the button would look broken.
        if (!state.dismissed) state.dismissed = {};
        state.dismissed[npc.key] = true;
        delete state.npcs[npc.key];
        state.active = Object.keys(state.npcs)[0] || null;
        saveState(true); renderAlbum(); updateInjections();
    });
}

function makeDraggable(el, handle) {
    let x = 0, y = 0;
    handle.onmousedown = (e) => {
        e.preventDefault();
        // The album is anchored bottom-right to sit above its button; once dragged it
        // switches to top-left, or the two anchors would fight each other.
        const r = el.getBoundingClientRect();
        el.style.bottom = el.style.right = 'auto';
        el.style.top = r.top + 'px';
        el.style.left = r.left + 'px';
        x = e.clientX; y = e.clientY;
        document.onmousemove = (ev) => {
            ev.preventDefault();
            const dx = x - ev.clientX, dy = y - ev.clientY;
            x = ev.clientX; y = ev.clientY;
            el.style.top = (el.offsetTop - dy) + 'px';
            el.style.left = (el.offsetLeft - dx) + 'px';
        };
        document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; };
    };
}

function hasChat() {
    try { return !!getContext().chatId; } catch (e) { return false; }
}

// Suite convention: every module drops its button into ONE shared row. Whoever loads
// first creates it, the rest append. A flex row cannot overlap itself, however many
// modules are installed — which is the whole point.
//
// The container's styles are inline on purpose: in a stylesheet they would depend on
// whose CSS loaded, and disabling one module would shift the row for everybody else.
const BTN_BOX = 'rpg-buttons-container';

function ensureButton() {
    let box = $('#' + BTN_BOX);
    if (!box.length) {
        box = $(`<div id="${BTN_BOX}" style="position:fixed; bottom:20px; right:20px; display:flex; gap:15px; z-index:3000;"></div>`);
        $('body').append(box);
    }
    if (!$('#tbe-btn').length) {
        // Same class and the same inline geometry as every other button in the suite,
        // because the row is a flex row of siblings and one button 6px smaller than the
        // rest is what made it read as bolted on. The shared class carries shape and
        // shadow only — every module paints its own colour through its own id, so ours
        // is set unconditionally. Made conditional, it renders as a transparent hole.
        const b = $(`<div class="rpg-floating-btn" id="tbe-btn" title="${escapeHtml(t('btn_bonds'))}" style="position:static; width:50px; height:50px; margin:0; display:flex; box-sizing:border-box;"><i class="fa-solid fa-ribbon"></i></div>`);
        box.append(b);
        b.off('click.tbe').on('click.tbe', () => { $('#tbe-album').toggleClass('visible'); renderAlbum(); });
    }
    // Hidden, never removed: pulling it out would renumber the row for the neighbours
    // every time a chat closes.
    $('#tbe-btn').toggle(!!settings.enabled && hasChat());
}

function renderMainUI() {
    // MERGED: the page is drawn inside every message now, so the floating book and its
    // button are not built at all. Everything that draws them — ensureButton, the modal
    // markup, makeDraggable, the roster and its tabs — is left exactly as it was above
    // and below this function; this was the only place that called it, so switching the
    // book back on is a matter of restoring this one body.
    // Only ever touch our own things. The container belongs to the whole suite, and
    // removing it here would take every other module's button down with it.
    $('#tbe-album').remove();
    $('#tbe-btn').remove();
    if (!settings.enabled) return;
    renderAlbum();
}


// ============================================================
// SETTINGS PANEL — MERGED
// Identical controls, identical bindings, identical order. The only change is that
// they are written into the "Relationship" tab of the shared drawer instead of
// opening a drawer of their own.
// ============================================================
function settingsHtml() {
    return `
            <label class="checkbox_label"><input type="checkbox" id="tbe-enabled"> ${t('set_enable')}</label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10" style="margin-top:8px;">
                <label>${t('set_lang')}</label>
                <select id="tbe-lang" class="text_pole" style="width:auto;">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            <hr class="sysHR">
            <input type="text" id="tbe-base" class="text_pole margin-b-10" placeholder="${t('set_url')}" style="width:100%;">
            <input type="password" id="tbe-key" class="text_pole margin-b-10" placeholder="${t('set_key')}" style="width:100%;">
            <input type="text" id="tbe-model" class="text_pole margin-b-10" placeholder="${t('set_model')}" style="width:100%;">
            <div class="tbe-hint">${t('hint_keys')}</div>
            <div id="tbe-borrow" class="tbe-note" style="display:none;"><i class="fa-solid fa-link"></i> <span></span></div>
            <div id="tbe-nokey-warn" class="tbe-warn" style="display:none;"><i class="fa-solid fa-triangle-exclamation"></i> ${t('warn_nokey')}</div>
            <hr class="sysHR">
            <label class="checkbox_label"><input type="checkbox" id="tbe-classify"> ${t('set_classify')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-autoprofile"> ${t('set_autoprofile')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-prose"> ${t('set_prose')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-intimacy"> ${t('set_intimacy')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-initiative"> ${t('set_initiative')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-demotion"> ${t('set_demotion')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-autoroster"> ${t('set_autoroster')}</label>
            <div class="tbe-hint">${t('hint_autoroster')}</div>
            <label class="checkbox_label"><input type="checkbox" id="tbe-solo"> ${t('set_solo')}</label>
            <div class="tbe-hint">${t('hint_solo')}</div>
            <label class="checkbox_label"><input type="checkbox" id="tbe-courtship"> ${t('set_courtship')}</label>
            <div class="tbe-hint">${t('hint_courtship')}</div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_courtrate')}</label>
                <input type="number" id="tbe-courtrate" class="text_pole" min="100" max="400" style="width:60px;"> %
            </div>
            <label class="checkbox_label"><input type="checkbox" id="tbe-charprose"> ${t('set_charprose')}</label>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_charprosew')}</label>
                <input type="number" id="tbe-charprosew" class="text_pole" min="0" max="100" style="width:60px;"> %
            </div>
            <div class="tbe-hint">${t('hint_charprose')}</div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10" style="margin-top:8px;">
                <label>${t('set_initrate')}</label>
                <input type="number" id="tbe-initrate" class="text_pole" min="0" max="300" style="width:60px;"> %
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_initf')}</label>
                <input type="number" id="tbe-initf" class="text_pole" min="0" max="200" style="width:60px;"> %
                <label>${t('set_initm')}</label>
                <input type="number" id="tbe-initm" class="text_pole" min="0" max="200" style="width:60px;"> %
            </div>
            <div class="tbe-hint">${t('hint_initgender')}</div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_pace')}</label>
                <input type="number" id="tbe-pace" class="text_pole" min="25" max="400" style="width:60px;"> %
            </div>
            <div class="tbe-hint">${t('hint_pace')}</div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_difficulty')}</label>
                <input type="number" id="tbe-difficulty" class="text_pole" min="25" max="300" style="width:60px;"> %
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_defgender')}</label>
                <select id="tbe-defgender" class="text_pole" style="width:auto;">
                    <option value="f">${t('g_f')}</option>
                    <option value="m">${t('g_m')}</option>
                </select>
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_events')}</label>
                <input type="number" id="tbe-events" class="text_pole" min="0" max="10" style="width:50px;">
            </div>
            <div class="flex-container alignitemscenter flexgap5 margin-b-10">
                <label>${t('set_depth')}</label>
                <input type="number" id="tbe-depth" class="text_pole" min="0" max="12" style="width:50px;">
            </div>
            <hr class="sysHR">
            <label class="checkbox_label"><input type="checkbox" id="tbe-gm"> ${t('set_gm')}</label>
            <label class="checkbox_label"><input type="checkbox" id="tbe-debug"> ${t('set_debug')}</label>
`;
}

function setupUI() {
    const $pane = $('#rpg-tab-pane-bonds');
    if (!$pane.length) return;
    $pane.html(settingsHtml());

    const bindCheck = (sel, key, after) => {
        $(sel).prop('checked', !!settings[key]).on('change', function () {
            settings[key] = this.checked; saveSettings();
            if (after) after();
        });
    };
    const bindText = (sel, key) => {
        $(sel).val(settings[key]).on('change', function () { settings[key] = $(this).val(); saveSettings(); });
    };
    const bindNum = (sel, key, lo, hi) => {
        $(sel).val(settings[key]).on('change', function () {
            settings[key] = clamp(parseInt($(this).val(), 10) || defaultSettings[key], lo, hi);
            $(this).val(settings[key]); saveSettings(); updateInjections();
        });
    };

    bindCheck('#tbe-enabled', 'enabled', () => { renderMainUI(); loadState(); updateInjections(); });
    bindCheck('#tbe-classify', 'classify');
    bindCheck('#tbe-autoprofile', 'autoProfile');
    bindCheck('#tbe-prose', 'proseGuard', updateInjections);
    bindCheck('#tbe-solo', 'pauseWhenSolo', updateInjections);
    bindCheck('#tbe-autoroster', 'autoRoster', () => { registerChatCards(); saveState(); renderAlbum(); });
    bindCheck('#tbe-intimacy', 'intimacy');
    bindCheck('#tbe-initiative', 'initiative');
    bindCheck('#tbe-demotion', 'demotion');
    bindCheck('#tbe-courtship', 'courtship', updateInjections);
    bindCheck('#tbe-charprose', 'charProse');
    bindCheck('#tbe-gm', 'gmMode', renderAlbum);
    bindCheck('#tbe-debug', 'debug');
    // Silence is the worst failure mode here: with no key the module loads, shows a
    // button, injects a profile, and never rolls anything. Say so, in the panel.
    const SRC_LABEL = { tavern_rpg_engine: 'Tavern RPG Engine', rpg_phone: 'Телефон', rpg_diary: 'Дневник', rpg_map: 'Карта', rpg_dungeons: 'Кроличья нора' };
    const refreshKeyWarning = () => {
        const from = borrowedFrom();
        $('#tbe-nokey-warn').toggle(!hasKey());
        $('#tbe-borrow').toggle(!!from).find('span').text(t('note_borrow', { src: SRC_LABEL[from] || from }));
    };
    bindText('#tbe-base', 'baseUrl');
    $('#tbe-key').val(settings.apiKey).on('change', function () {
        settings.apiKey = $(this).val(); saveSettings(); refreshKeyWarning();
    });
    bindText('#tbe-model', 'model');
    bindNum('#tbe-initrate', 'initiativeRate', 0, 300);
    bindNum('#tbe-courtrate', 'courtshipRate', 100, 400);
    bindNum('#tbe-charprosew', 'charProseWeight', 0, 100);
    bindNum('#tbe-initf', 'initFemale', 0, 200);
    bindNum('#tbe-initm', 'initMale', 0, 200);
    bindNum('#tbe-difficulty', 'difficulty', 25, 300);
    bindNum('#tbe-pace', 'pace', 25, 400);
    bindNum('#tbe-depth', 'injectDepth', 0, 12);
    bindNum('#tbe-events', 'promptEvents', 0, 10);
    $('#tbe-defgender').val(settings.defaultGender === 'm' ? 'm' : 'f').on('change', function () {
        settings.defaultGender = $(this).val() === 'm' ? 'm' : 'f'; saveSettings();
    });

    refreshKeyWarning();

    $('#tbe-lang').val(settings.language || 'en').on('change', function () {
        settings.language = $(this).val(); saveSettings();
        setupUI();
        renderMainUI(); updateInjections();
    });
}
// ============================================================
// CROSS-EXTENSION BRIDGE — lets the RPG Engine (or anything else) read the
// relationship without importing it. Safe no-op for anyone who does not use it.
// ============================================================
window.BONDS = window.BONDS || {};
window.BONDS.relations = {
    available: true,
    isEnabled: () => !!settings.enabled,
    list: () => Object.values(state && state.npcs ? state.npcs : {}).map(n => ({
        name: n.name, stage: n.stage, disp: clone(n.disp), pulse: clone(n.pulse),
        traits: clone(n.traits), conflict: !!n.conflict
    })),
    get: (name) => {
        const n = state && state.npcs ? state.npcs[nameKey(name)] : null;
        return n ? { name: n.name, stage: n.stage, disp: clone(n.disp), pulse: clone(n.pulse), traits: clone(n.traits), conflict: !!n.conflict } : null;
    },
    // Other modules can nudge the mood (a gift, a won duel) without touching traits.
    nudge: (name, delta) => {
        const n = state && state.npcs ? state.npcs[nameKey(name)] : null;
        if (!n) return false;
        applyDelta(n, delta || {});
        saveState(true); updateInjections(); renderAlbum();
        return true;
    },
    // Story milestones that no dice roll can produce — a wedding, an adoption —
    // are set from outside and then unlock their gate normally.
    milestone: (name, key) => {
        const n = state && state.npcs ? state.npcs[nameKey(name)] : null;
        if (!n || !key) return false;
        if (!n.milestones[key]) toggleMilestone(n, key);
        saveState(true); updateInjections(); renderAlbum();
        return true;
    },
    check: (name, act, ctx) => {
        const n = state && state.npcs ? state.npcs[nameKey(name)] : null;
        if (!n || !ACTS[act]) return null;
        const out = resolveCheck(n, act, ctx || {});
        if (out) state.verdict = Object.assign({ key: n.key }, out);
        saveState(true); updateInjections(); renderAlbum();
        return out;
    }
};

/* ---- what the Bonds closure hands to the host ---- */
// Two actions live only inside the album's own click handlers; they are lifted into
// named functions here so the inline copy calls exactly the same code, unchanged.
async function rerollProfile(npc) {
    npc.profiled = false;
    await buildProfile(npc);
    toastr.info(t('toast_reset'));
    renderAlbum();
}
function forgetNpc(npc) {
    // Remembered, or the auto-registration would put the page straight back on
    // the next chat load and the button would look broken.
    if (!state.dismissed) state.dismissed = {};
    state.dismissed[npc.key] = true;
    delete state.npcs[npc.key];
    state.active = Object.keys(state.npcs)[0] || null;
    saveState(true); renderAlbum(); updateInjections();
}

const TBE_API = {
    settings: () => settings,
    state: () => state,
    npcFor: (name) => { try { return (state && state.npcs) ? (state.npcs[nameKey(name)] || null) : null; } catch (e) { return null; } },
    npcPageHtml, toggleMilestone, rerollProfile, forgetNpc, readCharProse,
    saveState, updateInjections, renderAlbum, renderMainUI, ensureButton,
    loadSettings, pruneOldStates, loadState, setupUI,
    freshState: () => { state = freshState(); },
    releaseChat: (chatIdArg) => { stateReady = false; currentChatId = null; pendingChatId = chatIdArg || null; state = freshState(); },
    pendingChatId: () => pendingChatId,
    onPlayerMessage, onCharacterReply
};
return TBE_API;
})();

/* ============================================================
   HOST LAYER
   Neither engine is modified below the UI line: SB is the RPG Status Bar,
   TBE is the Tavern Bonds Engine, each still running its own settings key,
   its own state, its own prompts and its own events. This layer only does
   three things:
     1. builds ONE block inside the message with two tabs,
     2. builds ONE settings drawer with two tabs,
     3. draws the relationship page into the second tab of the block.
   ============================================================ */

const HOST_TABS = ['status', 'bonds'];
let activeInlineTab = 'status';          // remembered across redraws, per session

function hostLang() {
    // The two engines each have their own language switch. The block follows the
    // Status Bar's, because the block is the Status Bar's object.
    return SB.settings().language === 'ru' ? 'ru' : 'en';
}
function hostT(key) {
    const D = {
        en: { tab_status: 'Status', tab_bonds: 'Relationship', bonds_off: 'The relationship engine is switched off.', bonds_none: 'No relationship page for this character yet.', toggle: 'Show / hide' },
        ru: { tab_status: 'Статус', tab_bonds: 'Отношения', bonds_off: 'Движок отношений выключен.', bonds_none: 'На этого персонажа страница отношений ещё не заведена.', toggle: 'Показать / скрыть' }
    };
    return (D[hostLang()] || D.en)[key] || key;
}

function hostEscape(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sbOn() { return !!SB.settings().enabled; }
function bondsOn() { return !!TBE.settings().enabled; }

/* ------------------------------------------------------------
   THE SHELL
   Created once per message-and-character, then only its panes are repainted.
   It sits next to .mes_text exactly where the Status Bar always put it, for
   exactly the same reason: SillyTavern owns .mes_text and rebuilds it.
   ------------------------------------------------------------ */
function findShell(messageElement, charName) {
    return Array.from(messageElement.querySelectorAll('.rpg-inline-container'))
        .find(c => c.getAttribute('data-char') === charName) || null;
}

function ensureShell(messageId, charName) {
    const messageElement = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!messageElement) return null;

    let container = findShell(messageElement, charName);
    if (container) { syncTabs(container); return container; }

    const mesText = messageElement.querySelector('.mes_text');
    if (!mesText) return null;   // message body not built yet; avoid a detached container

    container = document.createElement('div');
    container.className = 'rpg-inline-container';
    container.setAttribute('data-char', charName);
    container.setAttribute('data-mesid', String(messageId));
    container.innerHTML = `
        <div class="rpg-inline-header" title="${hostEscape(hostT('toggle'))}">
            <div class="rpg-header-left">
                <i class="fa-solid fa-heart-pulse"></i> <span class="rpg-header-title">${hostEscape(charName)}</span>
            </div>
            <div class="rpg-header-right">
                <span class="rpg-mini-summary"></span>
                <i class="fa-solid fa-chevron-down rpg-chevron"></i>
            </div>
        </div>
        <div class="rpg-accordion-wrapper">
            <div class="rpg-inline-body">
                <div class="rpg-inline-body-inner">
                    <div class="rpg-tabs">
                        <span class="rpg-tab" data-tab="status"><i class="fa-solid fa-heart-pulse"></i> ${hostEscape(hostT('tab_status'))}</span>
                        <span class="rpg-tab" data-tab="bonds"><i class="fa-solid fa-ribbon"></i> ${hostEscape(hostT('tab_bonds'))}</span>
                    </div>
                    <div class="rpg-pane rpg-pane-status"></div>
                    <div class="rpg-pane rpg-pane-bonds"></div>
                </div>
            </div>
        </div>`;
    mesText.insertAdjacentElement('afterend', container);

    const header = container.querySelector('.rpg-inline-header');
    const wrapper = container.querySelector('.rpg-accordion-wrapper');
    header.addEventListener('click', () => {
        header.classList.toggle('expanded');
        wrapper.classList.toggle('expanded');
        paintIfNeeded(container);
    });

    container.querySelectorAll('.rpg-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            activeInlineTab = tab.getAttribute('data-tab');
            document.querySelectorAll('.rpg-inline-container').forEach(c => { syncTabs(c); paintIfNeeded(c); });
        });
    });

    syncTabs(container);
    paintIfNeeded(container);
    return container;
}

// Which tabs exist at all depends on which engines are on: a module that is switched
// off must not leave an empty tab behind, and one running alone must not show a tab bar.
function paneHasContent(container, key) {
    // The relationship tab is offered whenever the engine has a page for this character,
    // WITHOUT painting it first — painting every block in the chat just to decide whether
    // a tab should exist is what made long chats crawl.
    if (key === 'bonds') return bondsOn() && !!TBE.npcFor(container.getAttribute('data-char') || '');
    const pane = container.querySelector('.rpg-pane-status');
    if (!pane) return false;
    if (pane.getAttribute('data-empty') === '1') return false;
    return pane.innerHTML.trim().length > 0;
}

function syncTabs(container) {
    const avail = HOST_TABS.filter(k => (k === 'status' ? sbOn() : bondsOn()) && paneHasContent(container, k));
    // Nothing to say yet — an empty frame under a message is worse than no frame.
    container.style.display = avail.length ? '' : 'none';
    if (!avail.length) return;
    const active = avail.includes(activeInlineTab) ? activeInlineTab : avail[0];
    container.querySelectorAll('.rpg-tab').forEach(tab => {
        const k = tab.getAttribute('data-tab');
        tab.style.display = avail.includes(k) ? '' : 'none';
        tab.classList.toggle('active', k === active);
    });
    const bar = container.querySelector('.rpg-tabs');
    if (bar) bar.style.display = avail.length > 1 ? '' : 'none';
    container.querySelectorAll('.rpg-pane').forEach(p => {
        const k = p.classList.contains('rpg-pane-status') ? 'status' : 'bonds';
        p.classList.toggle('active', k === active);
    });
}

/* ------------------------------------------------------------
   THE RELATIONSHIP PANE
   The page itself is the engine's own npcPageHtml — every section, the ceiling
   pins, the milestones, "what comes next", the memories, the views, the die and
   the GM strip. Nothing is rebuilt here and nothing is left out; only the paper
   skin is swapped for the block's dark one, in CSS.
   ------------------------------------------------------------ */
// Is this block's relationship tab actually on screen? A collapsed block, or one showing
// the status tab, is not worth a single line of HTML.
function bondsPaneVisible(container) {
    const wrap = container.querySelector('.rpg-accordion-wrapper');
    const pane = container.querySelector('.rpg-pane-bonds');
    return !!(wrap && wrap.classList.contains('expanded') && pane && pane.classList.contains('active'));
}

function paintBondsPane(container, force) {
    const pane = container.querySelector('.rpg-pane-bonds');
    if (!pane) return;
    // Not on screen: remember that it is out of date and stop. It is redrawn the moment
    // the player opens it, so what they see is always current — it is simply not built
    // for two hundred messages nobody is looking at.
    if (!force && !bondsPaneVisible(container)) { pane.setAttribute('data-stale', '1'); return; }

    const charName = container.getAttribute('data-char') || '';
    if (!bondsOn()) {
        pane.setAttribute('data-empty', '1');
        pane.innerHTML = `<div class="rpg-bonds-note">${hostEscape(hostT('bonds_off'))}</div>`;
        return;
    }
    const npc = TBE.npcFor(charName);
    if (!npc) {
        pane.setAttribute('data-empty', '1');
        pane.innerHTML = `<div class="rpg-bonds-note">${hostEscape(hostT('bonds_none'))}</div>`;
        return;
    }
    pane.removeAttribute('data-empty');
    pane.removeAttribute('data-stale');
    pane.innerHTML = TBE.npcPageHtml(npc);
    bindBondsPane(pane, npc);
}

// Draw it if it is on screen and either never drawn or out of date.
function paintIfNeeded(container) {
    const pane = container.querySelector('.rpg-pane-bonds');
    if (!pane || !bondsPaneVisible(container)) return;
    if (pane.getAttribute('data-stale') === '1' || !pane.innerHTML.trim()) paintBondsPane(container, true);
}

// The album's own bindPageEvents is bound to #tbe-body and stays bound to it. This is
// the same set of actions for the inline copy, calling the same engine functions.
function bindBondsPane(pane, npc) {
    const redraw = () => { TBE.saveState(true); TBE.updateInjections(); TBE.renderAlbum(); };

    pane.querySelectorAll('.tbe-gender-opt').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            npc.gender = el.getAttribute('data-g') === 'm' ? 'm' : 'f';
            redraw();
        });
    });

    pane.querySelectorAll('.tbe-chip').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            TBE.toggleMilestone(npc, el.getAttribute('data-ms'));
            redraw();
        });
    });

    if (!TBE.settings().gmMode) return;

    pane.querySelectorAll('.tbe-bar.tbe-editable').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            const pct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
            const [group, key] = String(el.getAttribute('data-key')).split(':');
            if (group === 'disp') npc.disp[key] = pct;
            else if (group === 'pulse') npc.pulse[key] = pct;
            else return;
            redraw();
        });
    });
    const sel = pane.querySelector('.tbe-gm-stage');
    if (sel) sel.addEventListener('change', (e) => { e.stopPropagation(); npc.stage = sel.value; redraw(); });
    const reroll = pane.querySelector('.tbe-reroll');
    if (reroll) reroll.addEventListener('click', async (e) => { e.stopPropagation(); await TBE.rerollProfile(npc); });
    const forget = pane.querySelector('.tbe-forget');
    if (forget) forget.addEventListener('click', (e) => { e.stopPropagation(); TBE.forgetNpc(npc); });
}

// Called by the engine whenever anything about a relationship changed. Debounced:
// a single turn can redraw the album half a dozen times, and every redraw here is a
// pass over every block on screen.
let bondsRefreshTimer = null;
function refreshBondsPanes() {
    document.querySelectorAll('.rpg-inline-container').forEach(c => {
        const pane = c.querySelector('.rpg-pane-bonds');
        if (pane) pane.setAttribute('data-stale', '1');
        syncTabs(c);
        if (bondsPaneVisible(c)) paintBondsPane(c, true);   // at most the one block that is open
    });
}
window.RPGSB_BONDS_REFRESH = function () {
    clearTimeout(bondsRefreshTimer);
    bondsRefreshTimer = setTimeout(() => { try { refreshBondsPanes(); } catch (e) { console.error('[RPG Suite] relationship repaint failed:', e); } }, 120);
};

// The Status Bar asks the host for its container instead of building one.
window.RPGSB_SHELL = ensureShell;
window.RPGSB_SYNC = syncTabs;

/* ------------------------------------------------------------
   MOUNTING
   The Status Bar mounts a block for every message it has a snapshot for. That is
   not enough on its own any more: with the Status Bar off and relationships on,
   nothing would ever create a block. So the host also mounts one on the character
   messages of the current chat.
   ------------------------------------------------------------ */
function mountAll() {
    if (!sbOn() && !bondsOn()) return;
    const chat = getContext().chat;
    if (!chat || !chat.length) return;
    document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
        const id = parseInt(el.getAttribute('mesid'), 10);
        if (isNaN(id)) return;
        const msg = chat[id];
        if (!msg || msg.is_user || msg.is_system || !msg.name) return;
        ensureShell(id, msg.name);
    });
}

let mountTimer = null;
function scheduleMount() { clearTimeout(mountTimer); mountTimer = setTimeout(() => { try { mountAll(); } catch (e) { console.error('[RPG Suite] mount failed:', e); } }, 160); }

/* ------------------------------------------------------------
   THE SETTINGS DRAWER — one drawer, two tabs
   ------------------------------------------------------------ */
function settingsDrawerHtml() {
    return `
<div class="extension_settings rpg-status-settings">
    <div class="inline-drawer">
        <div class="rpg-drawer-toggle inline-drawer-header" style="cursor: pointer;">
            <b><i class="fa-solid fa-heart-pulse"></i> RPG Status Bar + Bonds</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" id="rpg-drawer-content" style="display: none; padding-top: 10px;">
            <div class="rpg-settings-tabs">
                <div class="rpg-settings-tab active" data-tab="status"><i class="fa-solid fa-heart-pulse"></i> ${hostEscape(hostT('tab_status'))}</div>
                <div class="rpg-settings-tab" data-tab="bonds"><i class="fa-solid fa-ribbon"></i> ${hostEscape(hostT('tab_bonds'))}</div>
            </div>
            <div id="rpg-tab-pane-status" class="rpg-settings-pane active"></div>
            <div id="rpg-tab-pane-bonds" class="rpg-settings-pane"></div>
        </div>
    </div>
</div>`;
}

function mountDrawer() {
    $('.rpg-status-settings').remove();
    $('.tbe-settings').remove();                      // any leftover from the standalone build
    $('#extensions_settings').append(settingsDrawerHtml());

    $('.rpg-status-settings .rpg-drawer-toggle').on('click', function () {
        $('#rpg-drawer-content').slideToggle();
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });

    $('.rpg-settings-tab').on('click', function () {
        const k = $(this).data('tab');
        $('.rpg-settings-tab').removeClass('active');
        $(this).addClass('active');
        $('.rpg-settings-pane').removeClass('active');
        $('#rpg-tab-pane-' + k).addClass('active');
    });

    SB.mountSettings();
    TBE.setupUI();
}

/* ============================================================
   WIRING — both original init blocks, merged, in their original order.
   ============================================================ */
jQuery(() => {
    console.log('[RPG Suite] RPG Status Bar + Tavern Bonds Engine (merged) loaded');

    // --- Status Bar boot (unchanged order) ---
    try {
        SB.loadSettings();
        SB.pruneOldStates();
    } catch (e) { console.error('[RPG Status Bar] settings load failed:', e); }

    // --- Bonds boot (unchanged order) ---
    try {
        TBE.loadSettings();
        TBE.pruneOldStates();
        TBE.freshState();
    } catch (e) { console.error('[Bonds] settings load failed:', e); }

    // one drawer, two tabs — fills both panes
    try { mountDrawer(); } catch (e) { console.error('[RPG Suite] settings panel failed:', e); }

    try {
        SB.updateContextInjection();
        SB.observeChat();
    } catch (e) { console.error('[RPG Status Bar] init failed:', e); }

    try {
        if (getContext().chatId) TBE.loadState();
        TBE.renderMainUI();
    } catch (e) { console.error('[Bonds] init failed:', e); }

    scheduleMount();

    eventSource.on(event_types.CHAT_CHANGED, (chatIdArg) => {
        // Bonds: release the old chat's pages immediately — an in-flight save must never
        // land in the chat we just opened.
        try {
            TBE.releaseChat(chatIdArg);
            setTimeout(() => {
                try { TBE.loadState(TBE.pendingChatId() || getContext().chatId); TBE.renderMainUI(); } catch (e) { console.error('[Bonds] chat switch failed:', e); }
                scheduleMount();
            }, 100);
        } catch (e) { console.error('[Bonds] chat switch failed:', e); }

        // Status Bar
        try {
            SB.resetCast();                  // force a rebuild of the character list for the new chat
            SB.refreshCastIfChanged(true);
            SB.observeChat();                // #chat can be re-created by ST; re-arm the observer
            SB.restoreStatusesOnLoad();
        } catch (e) { console.error('[RPG Status Bar] chat switch failed:', e); }

        scheduleMount();
    });

    // Adding or removing a group member does not fire CHAT_CHANGED; these events do.
    ['GROUP_UPDATED', 'GROUP_MEMBER_DRAFTED', 'CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_DUPLICATED']
        .forEach(k => { if (event_types[k]) eventSource.on(event_types[k], () => SB.refreshCastIfChanged(false)); });

    // Events that rebuild message bodies. MORE_MESSAGES_LOADED covers the lazy printing of
    // older messages on scroll, which is not otherwise announced.
    ['MORE_MESSAGES_LOADED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'USER_MESSAGE_RENDERED', 'GENERATION_ENDED', 'CHAT_LOADED']
        .forEach(k => { if (event_types[k]) eventSource.on(event_types[k], () => { SB.scheduleReconcile(); scheduleMount(); }); });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        const msg = getContext().chat[messageId];
        if (msg && !msg.is_user && !msg.is_system) {
            if (sbOn() && msg.extra?.rpg_status?.[msg.name]) {
                SB.renderInlineStatus(messageId, msg.name, msg.extra.rpg_status[msg.name]);
            } else {
                ensureShell(messageId, msg.name);
            }
        }
        SB.scheduleReconcile();
        scheduleMount();
    });

    eventSource.on(event_types.MESSAGE_EDITED, (messageId) => {
        if (!sbOn()) return;
        const msg = getContext().chat[messageId];
        if (msg && !msg.is_user && !msg.is_system && msg.extra?.rpg_status?.[msg.name]) {
            SB.renderInlineStatus(messageId, msg.name, msg.extra.rpg_status[msg.name]);
        }
    });

    // ST awaits its event handlers, so the Bonds check is resolved and injected before
    // the prompt is built. The classifier is wrapped in a 9s timeout so a dead endpoint
    // costs a delay, never a lost turn.
    eventSource.on(event_types.MESSAGE_SENT, async () => { await TBE.onPlayerMessage(); });

    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
        // Bonds first: it is what registers whoever just spoke, so the relationship
        // tab has a page to draw by the time the block is mounted.
        try { TBE.onCharacterReply(); } catch (e) { console.error('[Bonds] reply failed:', e); }
        // Opt-in, and always after the bookkeeping above: it reads the prose that
        // was just generated rather than deciding anything about it.
        TBE.readCharProse(messageId).catch(e => console.error('[Bonds] prose read failed:', e));
        const msg = getContext().chat[messageId];
        if (msg && !msg.is_user && !msg.is_system) {
            setTimeout(async () => {
                try { await SB.processCharacterStatus(messageId, msg.name, false); } catch (e) { console.error('[RPG Status Bar] status failed:', e); }
                ensureShell(messageId, msg.name);
                window.RPGSB_BONDS_REFRESH();
            }, 50);
        }
    });

    eventSource.on(event_types.MESSAGE_SWIPED, async (messageId) => {
        // Deliberately NOT onCharacterReply: the turn was already processed and
        // re-running it would tick the pulse twice. Only the prose is re-read, and
        // readCharProse reverts the previous swipe's credit before doing so.
        TBE.readCharProse(messageId).catch(e => console.error('[Bonds] prose read failed:', e));
        const msg = getContext().chat[messageId];
        if (msg && !msg.is_user && !msg.is_system) {
            setTimeout(async () => {
                try { await SB.processCharacterStatus(messageId, msg.name, false); } catch (e) { console.error('[RPG Status Bar] status failed:', e); }
                ensureShell(messageId, msg.name);
                window.RPGSB_BONDS_REFRESH();
            }, 50);
        }
    });
});
