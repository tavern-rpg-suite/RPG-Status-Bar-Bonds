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
        ui_export_short: "Export", ui_import_short: "Import", ui_reset_short: "Reset",
        ui_export_all_title: "One file for this character: status, relationship and body (whatever is on)",
        ui_import_all_title: "Load a character file onto the selected character",
        ui_ai_short: "4 stats from the card", ui_ai_world_short: "4 stats for the world",
        toast_imported_parts: "\"{char}\": imported {parts}.", part_status: "status", part_bonds: "relationship", part_body: "body",
        preset_fantasy: "⚔️ Fantasy",
        preset_survival: "🏕️ Survival",
        preset_romance: "💕 Romance",
        preset_academy: "🏫 Academy",
        preset_vampire: "🧛 Night & blood",
        preset_isekai: "🌀 Isekai adventure",
        ui_world_presets: "For RP cards (a world, not one person):",
        ui_ai_world: "🌍 Generate 4 stats for an RP card (AI)",
        ui_ai_world_hint: "This card looks like a world or a scenario: stats for the world fit it better.",
        confirm_ai_world: "Let AI design 4 stats for the world of \"{char}\" (an RP card, not one person)? This replaces the current stats.",
        sec_general: "General",
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
        ui_scene_only: "Only those in the scene (the Scene Card's list, or who spoke in the last N replies)", ui_scene_n: "N replies",
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
            ],
            academy: [
                { name: "Standing", desc: "Reputation at the academy — grades, teachers' opinion, rank. Rises with success, falls with scandal and failure.", color: "gold", value: 60, dynamicColor: true },
                { name: "Stress", desc: "Pressure of exams, rules and secrets. Rises with trouble and deadlines, falls with rest and friends.", color: "dark", value: 30, dynamicColor: false },
                { name: "Energy", desc: "How much is left for the day. Drops with classes, training and late nights, restored by sleep.", color: "blue", value: 80, dynamicColor: true },
                { name: "Popularity", desc: "How the other students see them. Rises with being noticed for good, falls with gossip.", color: "pink", value: 40, dynamicColor: true }
            ],
            vampire: [
                { name: "Blood thirst", desc: "Hunger for blood. Grows every night without feeding and with wounds, falls after feeding.", color: "red", value: 30, dynamicColor: false },
                { name: "Self-control", desc: "Holding the beast back. Falls with thirst, rage and the scent of blood, recovers with calm.", color: "purple", value: 70, dynamicColor: true },
                { name: "Suspicion", desc: "How close the mortals are to the truth. Rises with slips and bodies, falls when the trail goes cold.", color: "dark", value: 20, dynamicColor: false },
                { name: "Vitality", desc: "Physical strength. Drops with wounds and daylight, restored by blood and rest.", color: "cyan", value: 90, dynamicColor: true }
            ],
            isekai: [
                { name: "Luck", desc: "How the world treats them today. Swings with absurd mishaps and lucky breaks.", color: "gold", value: 50, dynamicColor: true },
                { name: "Debt", desc: "Money owed — to the guild, the tavern, the people they broke things of. Rises with damages, falls with paid quests.", color: "dark", value: 20, dynamicColor: false },
                { name: "Party mood", desc: "How the party gets along. Rises with shared wins and meals, falls with quarrels and blame.", color: "pink", value: 60, dynamicColor: true },
                { name: "Mana", desc: "Magic left. Spent on spells and skills, restored by rest.", color: "blue", value: 80, dynamicColor: true }
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
        ui_export_short: "Экспорт", ui_import_short: "Импорт", ui_reset_short: "Сброс",
        ui_export_all_title: "Один файл на персонажа: статус, отношения и тело (что включено)",
        ui_import_all_title: "Загрузить файл персонажа в выбранного персонажа",
        ui_ai_short: "4 стата по карточке", ui_ai_world_short: "4 стата для мира",
        toast_imported_parts: "«{char}»: загружено — {parts}.", part_status: "статус", part_bonds: "отношения", part_body: "тело",
        preset_fantasy: "⚔️ Фэнтези",
        preset_survival: "🏕️ Выживание",
        preset_romance: "💕 Романтика",
        preset_academy: "🏫 Академия",
        preset_vampire: "🧛 Ночь и кровь",
        preset_isekai: "🌀 Исекай-приключение",
        ui_world_presets: "Для РП-карточек (мир, а не один персонаж):",
        ui_ai_world: "🌍 Сгенерировать 4 стата для РП-карточки (ИИ)",
        ui_ai_world_hint: "Эта карточка похожа на мир или сценарий: статы для мира подойдут ей лучше.",
        confirm_ai_world: "Пусть ИИ придумает 4 стата для мира «{char}» (РП-карточка, а не один персонаж)? Текущие статы будут заменены.",
        sec_general: "Основное",
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
        ui_scene_only: "Только те, кто в сцене (список Scene Card или кто говорил в последних N ответах)", ui_scene_n: "N ответов",
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
            ],
            academy: [
                { name: "Положение", desc: "Репутация в академии — оценки, мнение преподавателей, ранг. Растёт от успехов, падает от скандалов и провалов.", color: "gold", value: 60, dynamicColor: true },
                { name: "Стресс", desc: "Давление экзаменов, правил и тайн. Растёт от неприятностей и сроков, падает от отдыха и друзей.", color: "dark", value: 30, dynamicColor: false },
                { name: "Энергия", desc: "Сколько сил осталось на день. Падает от занятий, тренировок и ночей без сна, восстанавливается сном.", color: "blue", value: 80, dynamicColor: true },
                { name: "Популярность", desc: "Как его видят другие студенты. Растёт, когда о нём говорят хорошее, падает от сплетен.", color: "pink", value: 40, dynamicColor: true }
            ],
            vampire: [
                { name: "Жажда крови", desc: "Голод по крови. Растёт с каждой ночью без питья и от ран, падает после кормления.", color: "red", value: 30, dynamicColor: false },
                { name: "Самоконтроль", desc: "Как крепко сдерживается зверь. Падает от жажды, ярости и запаха крови, восстанавливается в покое.", color: "purple", value: 70, dynamicColor: true },
                { name: "Подозрение", desc: "Насколько смертные близки к правде. Растёт от промахов и тел, падает, когда след остывает.", color: "dark", value: 20, dynamicColor: false },
                { name: "Живучесть", desc: "Физическая сила. Падает от ран и дневного света, восстанавливается кровью и отдыхом.", color: "cyan", value: 90, dynamicColor: true }
            ],
            isekai: [
                { name: "Удача", desc: "Как мир обходится с ним сегодня. Скачет от нелепых неудач и счастливых случаев.", color: "gold", value: 50, dynamicColor: true },
                { name: "Долги", desc: "Сколько он должен — гильдии, таверне, тем, у кого что-то сломал. Растут от ущерба, падают от оплаченных заданий.", color: "dark", value: 20, dynamicColor: false },
                { name: "Настрой отряда", desc: "Как ладит отряд. Растёт от общих побед и трапез, падает от ссор и взаимных упрёков.", color: "pink", value: 60, dynamicColor: true },
                { name: "Мана", desc: "Сколько магии осталось. Тратится на заклинания и навыки, восстанавливается отдыхом.", color: "blue", value: 80, dynamicColor: true }
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
    sceneOnly: true,        // the model hears only of those in the scene, not of the whole group
    sceneReplies: 6,        // "in the scene": on the Scene Card's list, or spoke in the last N replies
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

/* The designer used to give up on the first stumble — a busy server, a slow answer, a model that
   wrapped its JSON in a code fence or left a trailing comma — and the same press worked a moment
   later. Now it tries once more by itself, and reads a slightly sloppy answer instead of failing. */
async function callStatsAI(system, user) {
    let last = null;
    for (let i = 0; i < 2; i++) {
        try { return await callStatsAIOnce(system, user); }
        catch (e) {
            last = e;
            if (/HTTP 40[13]/.test(String(e && e.message))) break;   // a wrong key will not be right a second later
            console.warn('[RPG Status Bar] stat design: trying once more —', e && e.message);
            await new Promise(r => setTimeout(r, 1200));
        }
    }
    throw last;
}
function looseJson(content) {
    let x = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const m = x.match(/\{[\s\S]*\}/);
    x = m ? m[0] : x;
    try { return JSON.parse(x); } catch (e) { /* tidy and try again */ }
    return JSON.parse(x.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"'));
}
async function callStatsAIOnce(system, user) {
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
    const content = (data.choices[0].message.content || '').trim();
    const out = looseJson(content);
    if (!out || !Array.isArray(out.stats) || !out.stats.length) throw new Error('no stats in the answer');
    return out;
}

async function generateStatsForCharacter(charName, opts = {}) {
    if (!apiKey()) { toastr.warning(t('toast_no_key')); return; }
    const card = getCharacterCard(charName);
    if (!card) { toastr.warning(t('toast_no_card', { char: escapeHtml(charName) })); return; }

    toastr.info(t('toast_gen_start'));
    try {
        const validColors = Object.keys(colorOptions());
        const sys = opts.world
            ? `You are an RPG systems designer. The card below is not one person but a roleplay WORLD or scenario — a setting with its own rules, dangers and cast. Invent EXACTLY 4 status stats that track what matters for a character living in this world: its dangers, needs, standing and pressures (for a vampire academy: Blood thirst, Suspicion, Standing, Self-control; for a fantasy guild comedy: Luck, Debt, Party mood, Mana). They must suit any character of this world, not one specific person.
For each stat provide:
- "name": short (1-2 words)
- "desc": one sentence telling a Game Master what raises and lowers it in this world
- "color": one of [${validColors.join(', ')}]
- "value": a fitting starting value 0-100
- "dynamicColor": true if higher is better (health-like), false otherwise
${t('ai_names_lang')}
Output ONLY valid JSON: { "stats": [ {"name":"","desc":"","color":"red","value":100,"dynamicColor":true} ] } with exactly 4 entries.`
            : `You are an RPG systems designer. Based on the character below, invent EXACTLY 4 status stats that best fit their nature, role and personality. Mix physical, emotional and relational stats where it makes sense.
For each stat provide:
- "name": short (1-2 words)
- "desc": one sentence telling a Game Master what raises and lowers it
- "color": one of [${validColors.join(', ')}]
- "value": a starting value 0-100 that fits the character right now
- "dynamicColor": true if higher is better (health-like), false otherwise
${t('ai_names_lang')}
Output ONLY valid JSON: { "stats": [ {"name":"","desc":"","color":"red","value":100,"dynamicColor":true} ] } with exactly 4 entries.`;

        const result = await callStatsAI(sys, `${opts.world ? 'World / RP card' : 'Character'}:\n${card}`);
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
    // the Character tab's question rides along in this same request (nothing when it is off)
    let bodyAsk = '';
    try { bodyAsk = BODY.statusAsk(charName) || ''; } catch (e) { bodyAsk = ''; }

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
5. Output ONLY valid JSON. Keep the stat keys EXACTLY as given above.${bodyAsk}

Format:
{
  "stats": { "Stat1": 95, "Stat2": 80 },
  "summary": "Short description."${bodyAsk ? `,
  "body": { "ate": false, "drank": false, "slept": false, "new_ailments": [], "healed": [], "got_from_player": [], "gave_to_player": [] }` : ''}
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
            const content = (data.choices[0].message.content || '').trim();
            return looseJson(content);   // a code fence or a trailing comma is not a failed update
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

        const html = `
            ${barsHtml}
            <div class="rpg-body-footer">
                <div class="rpg-status-summary">${escapeHtml(statsData.summary)}</div>
                <button class="rpg-force-update" data-id="${messageId}" data-char="${escapeHtml(charName)}" title="${t('inline_recalc_title')}">
                    <i class="fa-solid fa-rotate-right"></i> ${t('inline_recalc')}
                </button>
            </div>
        `;
        /* A folded block shows only its header line (the name and the short summary are set
           above). The bars are written into the page when the block is opened — a long chat
           kept every block's bars in the page, folded or not. */
        const wrap = container.querySelector('.rpg-accordion-wrapper');
        if (wrap && !wrap.classList.contains('expanded')) {
            pane.innerHTML = '';
            pane.setAttribute('data-has', '1');
            container.__sbPaint = () => { container.__sbPaint = null; pane.removeAttribute('data-has'); pane.innerHTML = html; bindUpdate(); };
            if (typeof window.RPGSB_SYNC === 'function') window.RPGSB_SYNC(container);
            return;
        }
        container.__sbPaint = null;
        pane.removeAttribute('data-has');
        pane.innerHTML = html;
    }
    if (isLoading || isError || !(statsData && statsData.stats)) { container.__sbPaint = null; pane.removeAttribute('data-has'); }

    bindUpdate();
    function bindUpdate() {
        const updateBtn = pane.querySelector('.rpg-force-update');
        if (updateBtn) {
            updateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                updateBtn.classList.add('rpg-force-spinning');
                await processCharacterStatus(messageId, charName, true);
            });
        }
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
        // the Character tab reads only what is new since the last update: the line marks where that starts
        let bodyOn = false;
        try { bodyOn = BODY.on(); } catch (e) { bodyOn = false; }
        const newFrom = forceUpdate ? messageId : Math.max(startIdx, messageId - Math.max(1, settings.updateFrequency) + 1);
        const historyText = historySlice.map(m => `${bodyOn && chat.indexOf(m) === newFrom ? '=== NEW ===\n' : ''}${m.name}: ${m.mes}`).join('\n\n');

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
        try { if (bodyOn && result && result.body) BODY.fromStatus(charName, result.body, messageId); } catch (e) { console.warn('[Character] status read failed', e); }
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
/* Who the model hears about: in a group, everyone in it sits in the chat's cast — the ones at home
   in Durham as much as the ones on the train. "In the scene" is decided by code, no call: not muted
   in the group, and on the Scene Card's list of who is present, or a speaker of the last N replies
   (the last two always count — the card may lag a reply behind). Nobody found: everyone, as before. */
function sceneCharacters() {
    const all = getActiveCharacters();
    if (settings.sceneOnly === false || all.length <= 1) return all;
    let muted = [];
    try { const g = selected_group ? groups.find(x => x.id === selected_group) : null; muted = g && Array.isArray(g.disabled_members) ? g.disabled_members : []; } catch (e) { muted = []; }
    const awake = all.filter(c => !muted.includes(c.avatar));
    const first = n => String(n || '').trim().toLowerCase().split(/\s+/)[0];
    const here = new Set();
    const chat = getContext().chat || [];
    const bots = chat.filter(m => m && !m.is_user && !m.is_system && m.name);
    bots.slice(-Math.max(2, parseInt(settings.sceneReplies, 10) || 6)).forEach(m => here.add(first(m.name)));
    let listed = null;
    try {
        const sc = window.RPG && window.RPG.scene && window.RPG.scene.available && window.RPG.scene.get ? window.RPG.scene.get() : null;
        if (sc && Array.isArray(sc.characters) && sc.characters.length) listed = sc.characters.map(c => first(c && (c.name || c)));
    } catch (e) { listed = null; }
    if (listed) { here.clear(); listed.forEach(n => here.add(n)); bots.slice(-2).forEach(m => here.add(first(m.name))); }
    const out = awake.filter(c => here.has(first(c.name)));
    return out.length ? out : awake;
}

function buildStatusDirective() {
    const lines = [];
    sceneCharacters().forEach(char => {
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
    const activeChars = sceneCharacters();
    // the reply directive below already carries each character's condition: said once, not twice
    const inDirective = new Set();
    if (settings.influenceReply) activeChars.forEach(c => { const p = settings.profiles[profileKey(c.name)]; if (p && Array.isArray(p.stats) && p.stats.length) inDirective.add(c.name); });
    let noted = 0;

    activeChars.forEach(char => {
        const p = settings.profiles[profileKey(char.name)];
        if (!p || inDirective.has(char.name)) return;
        noted++;
        refreshLinkedStats(p);
        const linked = (p.stats || []).filter(st => st.link).map(st => `${st.name} ${st.value}/100`).join(', ');
        injectionText += `${char.name}: ${p.summary}${linked ? ` (${linked})` : ''}\n`;
    });

    setExtensionPrompt(PROMPT_KEY, noted ? injectionText : '', 2, settings.injectDepth, false, extension_prompt_roles.SYSTEM);

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
    // one file for the whole character: the status as before, and the relationship and the body when they are on
    const out = { type: 'rpg_status_profile', version: 2, character: name, profile: JSON.parse(JSON.stringify(profile)) };
    try { const b = TBE.exportNpc(name); if (b) out.bonds = b; } catch (e) { /* no Bonds page */ }
    try { const b = BODY.exportChar(name); if (b) out.body = b; } catch (e) { /* the tab is off */ }
    downloadJson(out, `rpg_character_${safe}.json`);
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
                    // a version 2 file also carries the relationship and the body
                    const parts = [t('part_status')];
                    try { if (data.bonds && TBE.importNpc(target, data.bonds)) parts.push(t('part_bonds')); } catch (e) { console.warn('[RPG Suite] relationship import', e); }
                    try { if (data.body && BODY.importChar(target, data.body)) parts.push(t('part_body')); } catch (e) { console.warn('[RPG Suite] body import', e); }
                    toastr.success(parts.length > 1 ? t('toast_imported_parts', { char: escapeHtml(target), parts: parts.join(', ') }) : t('toast_imported', { char: escapeHtml(target) }));
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
    // Open groups in frames, an emoji each, as RPG Map and Character Lens have them.
    const sub = (title, body) => `<div class="rpg-sub"><div class="rpg-subhead">${title}</div>${body}</div>`;
    return `
            <div class="rpg-top">
                <label class="checkbox_label"><input type="checkbox" id="rpg-enabled"> ${t('ui_enable')}</label>
                <select id="rpg-language" class="text_pole" title="${escapeHtml(t('ui_language'))}" aria-label="${escapeHtml(t('ui_language'))}">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            ${sub(t('ui_api'), `
                <input type="text" id="rpg-base-url" class="text_pole" placeholder="${t('ui_url')}" aria-label="${escapeHtml(t('ui_url'))}">
                <input type="password" id="rpg-api-key" class="text_pole" placeholder="${t('ui_key')}" aria-label="${escapeHtml(t('ui_key'))}">
                <input type="text" id="rpg-model" class="text_pole" placeholder="${t('ui_model')}" aria-label="${escapeHtml(t('ui_model'))}">
                <div class="rpg-srow"><label for="rpg-temperature">${t('ui_temp').replace(/:\s*$/, '')}</label><input type="range" id="rpg-temperature" min="0" max="2" step="0.1"><span id="rpg-temp-val" style="min-width: 30px; text-align: right;"></span></div>`)}
            ${sub(t('ui_gen'), `
                <label class="checkbox_label" title="${t('ui_inject_title')}"><input type="checkbox" id="rpg-inject-context"> <span>${t('ui_inject')}</span></label>
                <label class="checkbox_label" title="${t('ui_influence_title')}"><input type="checkbox" id="rpg-influence"> <span>${t('ui_influence')}</span></label>
                <label class="checkbox_label"><input type="checkbox" id="rpg-scene-only"> <span>${t('ui_scene_only')}</span></label>
                <div class="rpg-srow rpg-in"><label for="rpg-scene-n">${t('ui_scene_n')}</label><input type="number" id="rpg-scene-n" class="text_pole" min="2" max="40"></div>
                <label class="checkbox_label" title="${t('ui_per_chat_title')}"><input type="checkbox" id="rpg-per-chat"> <span>${t('ui_per_chat')}</span></label>
                <div class="rpg-srow"><label for="rpg-freq">${t('ui_update_every').replace(/:\s*$/, '')}, ${t('ui_messages')}</label><input type="number" id="rpg-freq" class="text_pole" min="1" max="15"></div>
                <div class="rpg-srow" title="${t('ui_inject_depth_title')}"><label for="rpg-inject-depth">${t('ui_inject_depth').replace(/:\s*$/, '')}</label><input type="number" id="rpg-inject-depth" class="text_pole" min="0" max="100"></div>`)}
            ${sub(t('ui_stat_config'), `<div id="rpg-dynamic-stats-container"></div>`)}
`;
}

function renderDynamicStats() {
    let activeChars = getActiveCharacters().map(c => c.name);
    if (activeChars.length === 0) activeChars = ["Character"];
    if (!currentlyEditingChar || !activeChars.includes(currentlyEditingChar)) {
        currentlyEditingChar = activeChars[0];
    }

    let html = `<div class="flex-container alignitemscenter flexgap5 margin-b-10">
        <label>${t('ui_edit_for')}</label>
        <select id="rpg-char-select" class="text_pole flex1">`;
    activeChars.forEach(name => {
        html += `<option value="${escapeHtml(name)}" ${name === currentlyEditingChar ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    });
    html += `</select></div>`;

    // the character's file (status, relationship, body) and a reset: one row of small buttons
    html += `<div class="rpg-tools">
        <button type="button" class="rpg-tool" id="rpg-export-profile" title="${escapeHtml(t('ui_export_all_title'))}"><i class="fa-solid fa-file-export"></i> ${t('ui_export_short')}</button>
        <button type="button" class="rpg-tool" id="rpg-import-profile" title="${escapeHtml(t('ui_import_all_title'))}"><i class="fa-solid fa-file-import"></i> ${t('ui_import_short')}</button>
        <button type="button" class="rpg-tool danger" id="rpg-reset-char" title="${escapeHtml(t('ui_reset'))}"><i class="fa-solid fa-rotate-left"></i> ${t('ui_reset_short')}</button>
    </div>`;

    // the two designers side by side; an RP card (a world, not one person) gets the world one lit up
    let worldCard = false;
    try { worldCard = BODY.isWorldName(currentlyEditingChar); } catch (e) { worldCard = false; }
    html += `<div class="rpg-tools rpg-tools-ai">
        <button type="button" class="rpg-tool ai" id="rpg-ai-generate" title="${escapeHtml(t('ui_ai_generate'))}">✨ ${t('ui_ai_short')}</button>
        <button type="button" class="rpg-tool world${worldCard ? ' rpg-suggest' : ''}" id="rpg-ai-generate-world" title="${escapeHtml(t('ui_ai_world'))}">🌍 ${t('ui_ai_world_short')}</button>
    </div>`;
    if (worldCard) html += `<div class="rpg-hint">${t('ui_ai_world_hint')}</div>`;
    html += `<div class="rpg-presets">
        <div class="rpg-preset-btn" data-preset="fantasy">${t('preset_fantasy')}</div>
        <div class="rpg-preset-btn" data-preset="survival">${t('preset_survival')}</div>
        <div class="rpg-preset-btn" data-preset="romance">${t('preset_romance')}</div>
    </div>
    <div class="rpg-hint">${t('ui_world_presets')}</div>
    <div class="rpg-presets">
        <div class="rpg-preset-btn" data-preset="academy">${t('preset_academy')}</div>
        <div class="rpg-preset-btn" data-preset="vampire">${t('preset_vampire')}</div>
        <div class="rpg-preset-btn" data-preset="isekai">${t('preset_isekai')}</div>
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
    $('#rpg-ai-generate-world').on('click', () => {
        if (confirm(t('confirm_ai_world', { char: currentlyEditingChar }))) generateStatsForCharacter(currentlyEditingChar, { world: true });
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
    $('#rpg-scene-only').prop('checked', settings.sceneOnly !== false).on('change', function () { settings.sceneOnly = this.checked; saveSettings(); updateContextInjection(); });
    $('#rpg-scene-n').val(settings.sceneReplies || 6).on('change', function () { settings.sceneReplies = Math.max(2, Math.min(40, parseInt(this.value, 10) || 6)); this.value = settings.sceneReplies; saveSettings(); updateContextInjection(); });
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
    resetCast: () => { lastCastKey = ''; },
    // plain text through the Status Bar's own connection (the Character tab's newborn note uses it)
    hasKey: () => !!apiKey(),
    aiText: async (system, user, maxTokens = 400) => {
        if (!apiKey()) throw new Error('no-key');
        const resp = await fetch(apiUrl().replace(/\/$/, '') + '/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey().trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: apiModel(), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.8, max_tokens: maxTokens })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        return String(data?.choices?.[0]?.message?.content || '').trim();
    }
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
        sec_conn: 'Connection', sec_checks: 'Checks and dice', sec_init: 'Initiative', sec_court: 'Courtship', sec_prose: 'Prose', sec_roster: 'Who is on the page', sec_prompt: 'Main model', sec_gm: 'Game master',
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
        sec_conn: 'Подключение', sec_checks: 'Проверки и кубики', sec_init: 'Инициатива', sec_court: 'Ухаживание', sec_prose: 'Проза', sec_roster: 'Кто в альбоме', sec_prompt: 'Основная модель', sec_gm: 'Мастер игры',
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
    /* The chat this profile is being built FOR. The request can take twenty seconds on
       a reasoning model, and if the chat is switched meanwhile the answer would be
       written into an npc object belonging to a chat nobody is looking at — and would
       redraw the album of the one they are. */
    const myChat = currentChatId;

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
        if (myChat !== currentChatId) {
            // Left this chat while waiting. The flag is handed back so the profile is
            // built properly the next time this character comes up, instead of being
            // marked done and never attempted again.
            npc.profiled = false;
            return;
        }
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
        // Same reasoning: a failed request must not count as "already profiled".
        npc.profiled = false;
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
    let dc = computeDC(npc, act, ctx);
    if (dc == null) return null;
    // her body today (the Character tab): cramps, a cold, hunger make it harder; a good day easier
    let bodyMod = 0;
    try { bodyMod = BODY.dcMod(npc.name) || 0; } catch (e) { bodyMod = 0; }
    if (bodyMod) dc = clamp(dc + bodyMod, 3, 28);
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
        // a night together is told once to whoever keeps her cycle (the Character tab)
        if (act === 'sex') { try { window.dispatchEvent(new CustomEvent('rpg:intimacy', { detail: { level: 'sex', with: npc.name, chatId: currentChatId, at: Date.now(), source: 'bonds' } })); } catch (e) { /* nobody listening */ } }
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
    npc.log.push(Object.assign({ turn: state.turn, act, dc, roll, res }, bodyMod ? { body: bodyMod } : {}));
    npc.log = npc.log.slice(-12);

    const walked = (!won && npc.failStreak >= 3);
    if (walked) { npc.cooldown = 2; npc.grace = 3; npc.failStreak = 0; npc.mendUntil = state.turn + 8; }

    checkStage(npc);
    return { act, dc, roll, res, won, walked, body: bodyMod };
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
    if (act === 'sex') { try { window.dispatchEvent(new CustomEvent('rpg:intimacy', { detail: { level: 'sex', with: npc.name, messageId: msgId, chatId: currentChatId, at: Date.now(), source: 'bonds' } })); } catch (e) { /* nobody listening */ } }
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
            <span class="tbe-check-dc">${escapeHtml(t('p_vs'))} ${e.dc}${e.body ? ` <i class="tbe-body-mod" title="${escapeHtml(BODY.t('dice_title'))}">🎲${e.body > 0 ? '+' : ''}${e.body}</i>` : ''}</span>
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
    // open groups in frames, an emoji each, as RPG Map and Character Lens have them
    const sub = (title, body) => `<div class="rpg-sub"><div class="rpg-subhead">${title}</div>${body}</div>`;
    const chk = (id, key) => `<label class="checkbox_label"><input type="checkbox" id="${id}"> <span>${t(key)}</span></label>`;
    const num = (id, key, attrs, unit = '') => `<div class="rpg-srow"><label for="${id}">${t(key).replace(/:\s*$/, '')}${unit ? `, ${unit}` : ''}</label><input type="number" id="${id}" class="text_pole" ${attrs}></div>`;
    const hint = key => `<div class="rpg-hint">${t(key)}</div>`;
    return `
            <div class="rpg-top">
                ${chk('tbe-enabled', 'set_enable')}
                <select id="tbe-lang" class="text_pole" title="${escapeHtml(t('set_lang'))}" aria-label="${escapeHtml(t('set_lang'))}">
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                </select>
            </div>
            ${sub(`🔌 ${t('sec_conn')}`, `
                <input type="text" id="tbe-base" class="text_pole" placeholder="${t('set_url')}" aria-label="${escapeHtml(t('set_url'))}">
                <input type="password" id="tbe-key" class="text_pole" placeholder="${t('set_key')}" aria-label="${escapeHtml(t('set_key'))}">
                <input type="text" id="tbe-model" class="text_pole" placeholder="${t('set_model')}" aria-label="${escapeHtml(t('set_model'))}">
                <div class="tbe-hint">${t('hint_keys')}</div>
                <div id="tbe-borrow" class="tbe-note" style="display:none;"><i class="fa-solid fa-link"></i> <span></span></div>
                <div id="tbe-nokey-warn" class="tbe-warn" style="display:none;"><i class="fa-solid fa-triangle-exclamation"></i> ${t('warn_nokey')}</div>`)}
            ${sub(`🎲 ${t('sec_checks')}`, `
                ${chk('tbe-classify', 'set_classify')}
                ${chk('tbe-autoprofile', 'set_autoprofile')}
                ${chk('tbe-intimacy', 'set_intimacy')}
                ${chk('tbe-demotion', 'set_demotion')}
                ${num('tbe-difficulty', 'set_difficulty', 'min="25" max="300"', '%')}
                ${num('tbe-pace', 'set_pace', 'min="25" max="400"', '%')}
                ${hint('hint_pace')}
                <div class="rpg-srow"><label for="tbe-defgender">${t('set_defgender')}</label>
                    <select id="tbe-defgender" class="text_pole">
                        <option value="f">${t('g_f')}</option>
                        <option value="m">${t('g_m')}</option>
                    </select></div>`)}
            ${sub(`💌 ${t('sec_init')}`, `
                ${chk('tbe-initiative', 'set_initiative')}
                <div class="rpg-in">
                    ${num('tbe-initrate', 'set_initrate', 'min="0" max="300"', '%')}
                    ${num('tbe-initf', 'set_initf', 'min="0" max="200"', '%')}
                    ${num('tbe-initm', 'set_initm', 'min="0" max="200"', '%')}
                    ${hint('hint_initgender')}
                </div>`)}
            ${sub(`🌹 ${t('sec_court')}`, `
                ${chk('tbe-courtship', 'set_courtship')}
                ${hint('hint_courtship')}
                <div class="rpg-in">${num('tbe-courtrate', 'set_courtrate', 'min="100" max="400"', '%')}</div>`)}
            ${sub(`✍️ ${t('sec_prose')}`, `
                ${chk('tbe-prose', 'set_prose')}
                ${chk('tbe-charprose', 'set_charprose')}
                <div class="rpg-in">${num('tbe-charprosew', 'set_charprosew', 'min="0" max="100"', '%')}</div>
                ${hint('hint_charprose')}`)}
            ${sub(`👥 ${t('sec_roster')}`, `
                ${chk('tbe-autoroster', 'set_autoroster')}
                ${hint('hint_autoroster')}
                ${chk('tbe-solo', 'set_solo')}
                ${hint('hint_solo')}`)}
            ${sub(`🪄 ${t('sec_prompt')}`, `
                ${num('tbe-events', 'set_events', 'min="0" max="10"')}
                ${num('tbe-depth', 'set_depth', 'min="0" max="12"')}`)}
            ${sub(`🛠️ ${t('sec_gm')}`, `
                ${chk('tbe-gm', 'set_gm')}
                ${chk('tbe-debug', 'set_debug')}`)}
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
    onPlayerMessage, onCharacterReply, guessGender,
    // the eight traits and their words (the Character tab's children inherit them)
    traitKeys: () => TRAITS.slice(),
    traitWords: (traits, gender, limit = 3) => { try { return traitPhrases({ traits, gender }, limit); } catch (e) { return []; } },
    // one relationship page in and out of a character file (the Status Bar's export carries it)
    exportNpc: (name) => { const n = state && state.npcs ? state.npcs[nameKey(name)] : null; return n ? clone(n) : null; },
    importNpc: (name, data) => {
        if (!state || !data || typeof data !== 'object') return false;
        const n = sanitizeNpc(Object.assign(clone(data), { name: String(name), key: nameKey(name) }));
        if (!n) return false;
        state.npcs[n.key] = n;
        if (state.dismissed) delete state.dismissed[n.key];
        if (!state.active) state.active = n.key;
        saveState(true); updateInjections(); renderAlbum();
        if (window.RPGSB_BONDS_REFRESH) window.RPGSB_BONDS_REFRESH();
        return true;
    }
};
return TBE_API;
})();

/* ============================================================
   ENGINE 3 — THE CHARACTER  (the third tab: body, cycle, ailments, pockets)
   ------------------------------------------------------------
   Everything here is counted by code, on the story's own clock: the Scene Card's date
   and time when it is there, the number of replies when it is not. The model is never
   called for it. What happened in the story (a meal, a night's sleep, a cold, a thing
   handed over) is read by the Status Bar's own update, inside the request it already
   makes. The main model hears one short line, and only when something is worth knowing.

     extension_settings.rpg_body      <- settings and each character's fixed traits
     chat_metadata.rpg_body           <- this chat: the clock, needs, cycle day, ailments, pockets
   ============================================================ */
const BODY = (function () {
const MODULE_NAME = 'rpg_body';
const PROMPT_KEY = 'rpg_body_state';

const defaultSettings = {
    enabled: false,
    language: '',           // '' = as the Status Bar
    needs: true,            // satiety, water, strength — wear down with the story's time
    needsSpeed: 100,        // %
    partEvery: 8,           // with no Scene Card clock: a new part of the day every N replies
    cycle: true,            // the menstrual cycle of the characters who have one
    pregnancy: false,       // a chance of pregnancy after an intimate scene — off until asked for
    hidePregnancy: true,    // nobody knows until the period is late
    ailments: true,         // small illnesses: from the story, and a die once a day
    ailmentChance: 5,       // % per character per day
    slots: true,            // the character's pockets
    slotCount: 5,
    dice: true,             // the body moves the relationship checks' difficulty
    itemsSelf: true,        // they pick things up for themselves and use what is in their pockets
    nights: true,           // a hangover after drinking, a bad day after a night without sleep
    adrenaline: true,       // after a fight: a rush, then the crash
    inject: true,
    injectDepth: 2,
    birth: true,            // at term: the newspaper window (play now / later / skip), then a child
    pregSpeed: 1,           // one story day is this many days of a pregnancy and of a child's growing up (1, 7, 30)
    childDesc: true,        // one model call writes the newborn's note (the Status Bar's connection)
    babyNights: true,       // a newborn with no one else to look after it: the parents do not sleep
    traits: {}              // per character, for good: { sex, cycle, fertile, len, period, pain, rolls }
};
let settings = {};

/* ---------------- language: the block follows the Status Bar's switch ---------------- */
// its own switch; left empty, it follows the Status Bar's
function lang() {
    if (settings && (settings.language === 'ru' || settings.language === 'en')) return settings.language;
    try { return SB.settings().language === 'ru' ? 'ru' : 'en'; } catch (e) { return 'en'; }
}
const I18N = {
    en: {
        tab: 'Character',
        sat: 'Satiety', hyd: 'Water', eng: 'Strength', hyg: 'Hygiene',
        dirty: 'has not washed in a while', own_low: '{n} is running out',
        needs_h: 'Needs', need_add: 'Add a need', need_name_ph: 'Blood, coffee…', need_icon_ph: '✦', rate: 'Wears down', rate_slow: 'slowly', rate_mid: 'normally', rate_fast: 'fast', need_del: 'Remove the need',
        hungry: 'hungry', very_hungry: 'starving', thirsty: 'thirsty', exhausted: 'exhausted', tired: 'tired',
        ph_period: 'Period', ph_follicular: 'Calm days', ph_ovulation: 'Ovulation', ph_luteal: 'Second half', ph_pms: 'Before the period',
        cycle_day: 'day {d} of {n}',
        pain0: 'no pain', pain1: 'mild cramps', pain2: 'cramps', pain3: 'strong cramps',
        late: 'Period late · {n} d', pregnant: 'Pregnant · {w} wk',
        no_cycle: 'No cycle', ailments: 'Ailments', none: 'Nothing hurts.',
        pockets: 'Pockets', empty_slot: 'empty', give_me: 'Give from my backpack', take_back: 'Take back', drop: 'Remove',
        no_backpack: 'Tavern RPG Engine is off — your backpack is not there.', backpack_empty: 'Your backpack is empty.',
        full: '{name} has no free pocket.', gave: '{name} took: {item}', got: '{name} gave you: {item}',
        dice_mod: 'Checks', dice_title: 'How the body moves the relationship checks right now (difficulty)',
        days: '{n} d', remove: 'Remove',
        more: 'Body settings', has_cycle: 'Has a cycle', fertile: 'Can have children', fert_roll: 'dice: {r}', len: 'Cycle length', period_len: 'Period days', pain: 'Period pain', set_day: 'Today is cycle day', reroll: 'Roll again',
        sex: 'Body', sex_f: 'female', sex_m: 'male', sex_x: 'other',
        for_who: 'For:', world_pick: 'Whose body:', nobody: 'No one to show yet.',
        new_day: 'A new day', day_n: 'Day {n}',
        // settings
        s_lang: 'Language', s_lang_follow: 'As the Status Bar',
        pill: 'Takes the pill', preg_end: 'The pregnancy is over', protected_by: 'Protected: {what}', condom_used: '{who} used a condom ({from})', from_pocket: 'from {name}\'s pocket', from_bag: 'from your backpack',
        what_condom: 'a condom', what_pill: 'the pill', what_story: 'contraception in the scene',
        s_enable: 'Enable the Character tab', s_needs_h: 'Needs', s_needs: 'Satiety, strength, hygiene and the needs of their own wear down with the story\'s time (which ones: in each character\'s body settings)',
        s_speed: 'Speed, %', s_partEvery: 'No Scene Card clock: a new part of the day every N replies',
        s_cycle_h: 'Cycle', s_cycle: 'Menstrual cycle (rolled once for each woman)', s_preg: 'A chance of pregnancy after an intimate scene', s_hide: 'Keep it hidden until the period is late',
        s_ail_h: 'Ailments', s_ail: 'Small ailments: from the story, and a die once a day', s_ailChance: 'Chance per day, %',
        s_slots_h: 'Pockets', s_slots: 'Pockets for things (given, taken back)', s_slotCount: 'Pockets',
        s_dice_h: 'Dice', s_dice: 'The body moves the relationship checks (cramps, a cold, hunger: harder)',
        s_inj_h: 'Main model', s_inj: 'Tell the main model what is worth knowing', s_depth: 'Depth',
        s_hint: 'Nothing here calls the model. The story is read inside the Status Bar\'s own update — turn the Status Bar on for meals, sleep, ailments and things handed over to be noticed.',
        ail_list: ['Headache', 'Toothache', 'A cold', 'Sore throat', 'Stomach ache', 'Back pain', 'A runny nose', 'Sleepless night'],
        inj_head: 'The characters\' bodies — this is already true. Let it show only where it matters; never list it, never mention any system.',
        inj_period: 'on her period ({pain})', inj_pms: 'the days before her period — touchier than usual', inj_ovu: 'ovulating — warmer and more drawn to closeness than usual',
        inj_late: 'her period is {n} days late (she has not thought about why)', inj_preg: 'pregnant, about {w} weeks{knows}', inj_preg_knows: '', inj_carry: 'has with her: {list}',
        concept_roll: 'Dice after the night with {who}: {r} — chance {c}%',
        st_hangover: 'Hangover', st_sleepless: 'Slept badly', st_rush: 'Adrenaline', st_crash: 'After the rush', states: 'State',
        inj_hangover: 'hungover — head heavy, light too bright', inj_sleepless: 'slept badly — slower and shorter-tempered', inj_rush: 'still running on adrenaline after the fight — bold, sharp, quick to flare', inj_crash: 'the adrenaline has worn off — shaky, drained, wants quiet',
        s_items: 'They pick things up for themselves and use what is in their pockets', s_nights_h: 'Nights and fights', s_nights: 'Hangover after drinking, a bad day after a night without sleep', s_adren: 'Adrenaline after a fight: a rush, then the crash',
        // pregnancy in weeks
        trim1: '1st trimester', trim2: '2nd trimester', trim3: '3rd trimester',
        sym1: 'nausea, odd cravings', sym2: 'the belly shows', sym3: 'heavy, tires quickly',
        due_in: 'due in about {n} d', due_now: 'due any day now',
        inj_trim1: 'nauseous in the mornings, odd cravings', inj_trim2: 'the belly is starting to show', inj_trim3: 'heavy now, tires quickly, her back aches',
        inj_term: 'her time has come — the first contractions come and go',
        st_baby: 'Newborn nights', inj_baby: 'a newborn keeps them up at night — short on sleep',
        // children
        children: 'Children', no_name: 'No name yet', rename: 'Rename', boy: 'boy', girl: 'girl', boy_acc: 'boy', girl_acc: 'girl',
        age_new: 'Newborn', age_inf: 'Baby', age_tod: 'Toddler', age_kid: 'Child', age_teen: 'Teenager', age_adult: 'Grown up',
        age_d: '{n} d', age_m: '{n} mo', age_y: '{n} y',
        care: 'Looked after by', care_parents: 'the parents', care_other: 'Someone else…', care_ph: 'Who?',
        from_m: 'from the mother', from_f: 'from the father', from_n: 'their own',
        kid_desc: 'Describe', kid_redesc: 'Write again', kid_busy: 'Writing…', kid_card: 'Tavern card', kid_card_done: 'Card made',
        kid_card_need_name: 'Give the child a name first.', kid_card_ok: 'Card made: {name}', kid_card_fail: 'The card could not be made.',
        kid_del: 'Remove', kid_del_sure: 'Sure?', kid_desc_fail: 'The note could not be written: {e}', kid_no_key: 'The Status Bar has no connection set — the note is not written.',
        card_parents: 'Mother: {m}. Father: {f}.', card_age: 'Age: {a}.', card_note: 'Born in a story; made by the Character tab (RPG Status Bar + Bonds).',
        born_toast: '👶 Born: {name} ({sex})', born_log: 'Gave birth: {name}',
        // the clipping
        np_paper: 'Family Chronicle', np_extra: 'Special edition', np_head: '{who} has gone into labor',
        np_lede: 'Week {w}. The father: {f}.', np_lede_nf: 'Week {w}.',
        np_name: 'Name', np_name_ph: 'it can wait', np_care: 'Who will look after the baby', np_how: 'How it goes',
        np_now: 'Play it now', np_now_d: 'the birth comes in the next reply', np_later: 'Later', np_later_d: 'remind me in three replies', np_skip: 'Skip', np_skip_d: 'the baby is born off-screen',
        np_foot: 'closing it means "later"', np_stamp: 'Labor', np_close: 'Close (later)', np_open: 'Open the clipping', np_playing: 'The birth — in the next reply',
        // for the main model — shown to her before they were added
        named: ', named {name}',
        labor: '{who} goes into labor now. Whatever else is happening in the story, let it break in: in this reply the contractions start and {who} gives birth to a {sex}{named}. Keep it true to the scene and to the people in it; no talk of any system.',
        labor_p: '{who} goes into labor now. Whatever else is happening in the story, let it break in: in this reply the contractions start and the baby, a {sexn}{named}, is born. Show it through the people around her and what her body does; do not write lines or decisions for the player\'s character ({who}). No talk of any system.',
        fact_skip: 'Off-screen, {who} has given birth to a {sex}{named}. The story picks up after it.',
        inj_kid: 'Their baby: {name} ({age}); parents — {parents}', care_inj_parents: 'they look after the baby themselves, the nights are short', care_inj: '{who} looks after the baby',
        // settings
        s_birth_h: 'Birth and children', s_birth: 'At term: the newspaper window, then a child', s_pregspeed: 'One story day is',
        sp1: 'one day of the pregnancy', sp7: 'one week', sp30: 'one month',
        s_childdesc: 'Write the newborn\'s note (one model call, the Status Bar\'s connection)', s_babynights: 'Newborn nights: the parents do not sleep while no one else looks after the baby'
    },
    ru: {
        tab: 'Персонаж',
        sat: 'Сытость', hyd: 'Вода', eng: 'Силы', hyg: 'Гигиена',
        dirty: 'давно не мылся(-ась)', own_low: '{n} на исходе',
        needs_h: 'Потребности', need_add: 'Добавить потребность', need_name_ph: 'Кровь, кофе…', need_icon_ph: '✦', rate: 'Убывает', rate_slow: 'медленно', rate_mid: 'обычно', rate_fast: 'быстро', need_del: 'Убрать потребность',
        hungry: 'голоден', very_hungry: 'очень голоден', thirsty: 'хочет пить', exhausted: 'без сил', tired: 'устал',
        ph_period: 'Месячные', ph_follicular: 'Спокойные дни', ph_ovulation: 'Овуляция', ph_luteal: 'Вторая половина', ph_pms: 'Перед месячными',
        cycle_day: 'день {d} из {n}',
        pain0: 'без боли', pain1: 'слабые спазмы', pain2: 'спазмы', pain3: 'сильные спазмы',
        late: 'Задержка · {n} дн.', pregnant: 'Беременна · {w} нед.',
        no_cycle: 'Без цикла', ailments: 'Недомогания', none: 'Ничего не болит.',
        pockets: 'Карманы', empty_slot: 'пусто', give_me: 'Дать из моего рюкзака', take_back: 'Забрать себе', drop: 'Убрать',
        no_backpack: 'Tavern RPG Engine выключен — твоего рюкзака нет.', backpack_empty: 'Твой рюкзак пуст.',
        full: 'У {name} нет свободного кармана.', gave: '{name} взял(а): {item}', got: '{name} отдал(а) тебе: {item}',
        dice_mod: 'Броски', dice_title: 'Как тело сейчас меняет сложность бросков в отношениях',
        days: '{n} дн.', remove: 'Убрать',
        more: 'Настройки тела', has_cycle: 'Есть цикл', fertile: 'Может иметь детей', fert_roll: 'кубик: {r}', len: 'Длина цикла', period_len: 'Дней месячных', pain: 'Боль в месячные', set_day: 'Сегодня день цикла', reroll: 'Бросить заново',
        sex: 'Тело', sex_f: 'женское', sex_m: 'мужское', sex_x: 'другое',
        for_who: 'Для:', world_pick: 'Чьё тело:', nobody: 'Пока некого показать.',
        new_day: 'Новый день', day_n: 'День {n}',
        s_lang: 'Язык', s_lang_follow: 'Как у Статус-бара',
        pill: 'Принимает противозачаточные', preg_end: 'Беременность закончилась', protected_by: 'Защита: {what}', condom_used: 'Использован презерватив ({from})', from_pocket: 'из кармана {name}', from_bag: 'из твоего рюкзака',
        what_condom: 'презерватив', what_pill: 'таблетки', what_story: 'предохранялись по сюжету',
        s_enable: 'Включить вкладку «Персонаж»', s_needs_h: 'Потребности', s_needs: 'Сытость, силы, гигиена и свои потребности убывают по времени истории (какие именно — в настройках тела каждого персонажа)',
        s_speed: 'Скорость, %', s_partEvery: 'Без часов Scene Card: новая часть дня каждые N ответов',
        s_cycle_h: 'Цикл', s_cycle: 'Менструальный цикл (бросается один раз для каждой женщины)', s_preg: 'Шанс беременности после интимной сцены', s_hide: 'Скрывать, пока нет задержки',
        s_ail_h: 'Недомогания', s_ail: 'Мелкие недомогания: из сюжета и кубик раз в день', s_ailChance: 'Шанс в день, %',
        s_slots_h: 'Карманы', s_slots: 'Карманы для вещей (отдать, забрать)', s_slotCount: 'Карманов',
        s_dice_h: 'Кубики', s_dice: 'Тело влияет на броски в отношениях (спазмы, простуда, голод — сложнее)',
        s_inj_h: 'Основная модель', s_inj: 'Сообщать основной модели то, что стоит знать', s_depth: 'Глубина',
        s_hint: 'Здесь ничто не вызывает модель. Сюжет читается внутри обновления Статус-бара — включи Статус-бар, чтобы замечались еда, сон, недомогания и переданные вещи.',
        ail_list: ['Головная боль', 'Зубная боль', 'Простуда', 'Болит горло', 'Болит живот', 'Болит спина', 'Насморк', 'Бессонная ночь'],
        inj_head: 'Тела персонажей — это уже правда. Пусть это проявляется только там, где важно; не перечисляй и не упоминай никаких систем.',
        inj_period: 'у неё месячные ({pain})', inj_pms: 'дни перед месячными — обидчивее обычного', inj_ovu: 'овуляция — теплее и больше тянется к близости, чем обычно',
        inj_late: 'у неё задержка {n} дн. (она ещё не думала почему)', inj_preg: 'беременна, около {w} нед.{knows}', inj_preg_knows: '', inj_carry: 'при себе: {list}',
        concept_roll: 'Кубик после ночи с {who}: {r} — шанс {c}%',
        st_hangover: 'Похмелье', st_sleepless: 'Не выспался(-ась)', st_rush: 'Адреналин', st_crash: 'Отходняк', states: 'Состояние',
        inj_hangover: 'похмелье — тяжёлая голова, свет слишком яркий', inj_sleepless: 'не выспался(-ась) — медленнее и раздражительнее', inj_rush: 'ещё на адреналине после драки — смелый(-ая), резкий(-ая), легко вспыхивает', inj_crash: 'адреналин схлынул — потряхивает, пусто, хочется тишины',
        s_items: 'Сами берут себе вещи и пользуются тем, что в карманах', s_nights_h: 'Ночи и драки', s_nights: 'Похмелье после выпивки, разбитый день после ночи без сна', s_adren: 'Адреналин после драки: подъём, потом отходняк',
        trim1: 'I триместр', trim2: 'II триместр', trim3: 'III триместр',
        sym1: 'тошнота, тянет на странное', sym2: 'живот уже заметен', sym3: 'тяжело, быстро устаёт',
        due_in: 'срок примерно через {n} дн.', due_now: 'срок подошёл',
        inj_trim1: 'подташнивает по утрам, тянет на странное', inj_trim2: 'живот уже начинает быть заметен', inj_trim3: 'ей уже тяжело, быстро устаёт, ноет спина',
        inj_term: 'срок подошёл — первые схватки то приходят, то отпускают',
        st_baby: 'Ночи с малышом', inj_baby: 'новорождённый не даёт спать по ночам — не высыпается',
        children: 'Дети', no_name: 'Пока без имени', rename: 'Переименовать', boy: 'мальчик', girl: 'девочка', boy_acc: 'мальчика', girl_acc: 'девочку',
        age_new: 'Новорождённый', age_inf: 'Младенец', age_tod: 'Малыш', age_kid: 'Ребёнок', age_teen: 'Подросток', age_adult: 'Взрослый',
        age_d: '{n} дн.', age_m: '{n} мес.', age_y: '{n} г.',
        care: 'Присматривает', care_parents: 'родители', care_other: 'Кто-то другой…', care_ph: 'Кто?',
        from_m: 'от мамы', from_f: 'от папы', from_n: 'своё',
        kid_desc: 'Описать', kid_redesc: 'Переписать', kid_busy: 'Пишу…', kid_card: 'Карточка Таверны', kid_card_done: 'Карточка есть',
        kid_card_need_name: 'Сначала дай ребёнку имя.', kid_card_ok: 'Карточка создана: {name}', kid_card_fail: 'Не удалось создать карточку.',
        kid_del: 'Убрать', kid_del_sure: 'Точно?', kid_desc_fail: 'Не удалось написать описание: {e}', kid_no_key: 'У Статус-бара не настроено подключение — описание не написано.',
        card_parents: 'Мать: {m}. Отец: {f}.', card_age: 'Возраст: {a}.', card_note: 'Родился(-ась) в истории; создано вкладкой «Персонаж» (RPG Status Bar + Bonds).',
        born_toast: '👶 Родился(-ась): {name} ({sex})', born_log: 'Родила: {name}',
        np_paper: 'Семейная хроника', np_extra: 'Экстренный выпуск', np_head: '{who}: схватки начались',
        np_lede: 'Срок — {w} нед. Отец — {f}.', np_lede_nf: 'Срок — {w} нед.',
        np_name: 'Имя', np_name_ph: 'можно потом', np_care: 'Кто будет смотреть за малышом', np_how: 'Как это будет',
        np_now: 'Играть сейчас', np_now_d: 'роды — в следующем ответе', np_later: 'Позже', np_later_d: 'напомнить через три ответа', np_skip: 'Пропустить', np_skip_d: 'малыш родится за кадром',
        np_foot: 'закрыть — значит «позже»', np_stamp: 'Роды', np_close: 'Закрыть (позже)', np_open: 'Развернуть вырезку', np_playing: 'Роды — в следующем ответе',
        named: ', по имени {name}',
        labor: '{who} рожает — прямо сейчас. Что бы ни происходило в сюжете, пусть это вмешается: в этом ответе начинаются схватки, и {who} рожает {sex}{named}. Держись сцены и характеров; никаких упоминаний систем.',
        labor_p: '{who} рожает — прямо сейчас. Что бы ни происходило в сюжете, пусть это вмешается: в этом ответе начинаются схватки, и на свет появляется {sexn}{named}. Покажи это через людей рядом и то, что происходит с её телом; не пиши реплик и решений за персонажа игрока ({who}). Никаких упоминаний систем.',
        fact_skip: 'За кадром {who} родила {sex}{named}. История продолжается после этого.',
        inj_kid: 'Ребёнок: {name} ({age}); родители — {parents}', care_inj_parents: 'смотрят за малышом сами, ночи короткие', care_inj: 'за малышом смотрит {who}',
        s_birth_h: 'Роды и дети', s_birth: 'Когда подошёл срок: газетное окошко, потом ребёнок', s_pregspeed: 'Один день истории —',
        sp1: 'один день беременности', sp7: 'одна неделя', sp30: 'один месяц',
        s_childdesc: 'Писать описание новорождённого (один вызов модели, подключение Статус-бара)', s_babynights: 'Ночи с малышом: родители не высыпаются, пока за ним никто другой не смотрит'
    }
};
function t(key, vars) {
    let s = (I18N[lang()] || I18N.en)[key];
    if (s === undefined) s = I18N.en[key];
    if (s === undefined) return key;
    if (typeof s === 'string' && vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
}
function esc(x) { return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function d100() { return 1 + Math.floor(Math.random() * 100); }
function genId() { return Math.random().toString(36).slice(2, 10); }
function keyOf(name) { return String(name || '').trim().toLowerCase(); }

/* ---------------- settings ---------------- */
function loadSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    settings = Object.assign({}, defaultSettings, extension_settings[MODULE_NAME]);
    if (!settings.traits || typeof settings.traits !== 'object') settings.traits = {};
    ['needsSpeed', 'partEvery', 'ailmentChance', 'slotCount', 'injectDepth'].forEach(k => { if (!Number.isFinite(+settings[k])) settings[k] = defaultSettings[k]; });
    if (![1, 7, 30].includes(+settings.pregSpeed)) settings.pregSpeed = 1;
    settings.pregSpeed = +settings.pregSpeed;
}
function saveSettings() { extension_settings[MODULE_NAME] = settings; saveSettingsDebounced(); }
function on() { return !!settings.enabled; }

/* ---------------- the chat's own state ---------------- */
function chatState() {
    const md = getContext().chatMetadata;
    if (!md) return null;
    if (!md.rpg_body || typeof md.rpg_body !== 'object') md.rpg_body = {};
    const s = md.rpg_body;
    if (!Number.isFinite(s.day)) s.day = 1;
    if (!s.chars || typeof s.chars !== 'object') s.chars = {};
    if (!Number.isFinite(s.partTick)) s.partTick = 0;
    if (!Number.isFinite(s.turn)) s.turn = 0;
    if (typeof s.part !== 'string') s.part = '';
    if (typeof s.dateKey !== 'string') s.dateKey = '';
    if (!s.lastRead || typeof s.lastRead !== 'object') s.lastRead = {};
    if (!Array.isArray(s.children)) s.children = [];
    if (s.birth && typeof s.birth !== 'object') s.birth = null;
    return s;
}
function saveChat() { saveChatDebounced(); }

/* Who is a woman, who has a cycle, can she have children, how long and how painful —
   rolled ONCE for each character and kept for good, the same in every chat. */
function genderOf(name) {
    try { const npc = TBE.npcFor(name); if (npc && (npc.gender === 'f' || npc.gender === 'm')) return npc.gender; } catch (e) { /* no Bonds page */ }
    const ch = characters.find(c => c && c.name === name);
    if (ch) { const g = TBE.guessGender([ch.description, ch.personality].filter(Boolean).join('\n')); if (g) return g; }
    return null;
}
function rollTraits(name) {
    const sex = genderOf(name) || 'x';
    const r = { fert: d100(), len: d100(), period: d100(), pain: d100() };
    return {
        name, sex,
        cycle: sex === 'f',
        fertile: r.fert > 12,                                  // about one in eight cannot
        len: 25 + Math.floor((r.len - 1) / 100 * 9),            // 25–33 days
        period: 3 + Math.floor((r.period - 1) / 100 * 5),       // 3–7 days
        pain: r.pain <= 20 ? 0 : r.pain <= 62 ? 1 : r.pain <= 88 ? 2 : 3,
        rolls: r, at: Date.now()
    };
}
function traitsOf(name) {
    const k = keyOf(name);
    if (!k) return null;
    let tr = settings.traits[k];
    if (!tr || typeof tr !== 'object') { tr = rollTraits(name); settings.traits[k] = tr; saveSettings(); }
    // a gender learned later (the Bonds page was made after the first roll) settles an unknown body
    if (tr.sex === 'x') { const g = genderOf(name); if (g) { tr.sex = g; tr.cycle = g === 'f'; saveSettings(); } }
    return tr;
}
function charOf(name, create = true) {
    const s = chatState();
    if (!s) return null;
    const k = keyOf(name);
    if (!k) return null;
    if (!s.chars[k]) {
        if (!create) return null;
        const tr = traitsOf(name);
        s.chars[k] = {
            name, sat: 80, eng: 85, hyg: 90, own: {}, merged: true, ailments: [], slots: [],
            // somewhere in her cycle when the story meets her
            cycleStart: s.day - Math.floor(Math.random() * (tr && tr.len ? tr.len : 28)),
            preg: null, lastIntim: -99, log: [], sleptSince: true
        };
        saveChat();
    }
    const c = s.chars[k];
    if (!Array.isArray(c.ailments)) c.ailments = [];
    if (!Array.isArray(c.slots)) c.slots = [];
    if (!Array.isArray(c.log)) c.log = [];
    // food and water were two scales before: one "Satiety" now, as in RPG Vitals — the two averaged once
    if (!c.merged) { if (Number.isFinite(c.hyd)) c.sat = Math.round(((Number.isFinite(c.sat) ? c.sat : 80) + c.hyd) / 2); delete c.hyd; c.merged = true; }
    if (!Number.isFinite(c.hyg)) c.hyg = 90;
    if (!c.own || typeof c.own !== 'object') c.own = {};
    return c;
}
/* Which needs this character has — chosen per character, kept with the body for good (a vampire:
   no satiety, a need of its own called "Blood"). Satiety, strength and hygiene are on until switched off. */
const OWN_RATE = { slow: 6, mid: 12, fast: 22 };   // a part of the day costs this much
function needsOf(name) {
    const tr = traitsOf(name);
    if (!tr) return { sat: true, eng: true, hyg: true, own: [] };
    if (!tr.needs || typeof tr.needs !== 'object') tr.needs = {};
    const n = tr.needs;
    ['sat', 'eng', 'hyg'].forEach(k => { if (typeof n[k] !== 'boolean') n[k] = true; });
    if (!Array.isArray(n.own)) n.own = [];
    return n;
}
function ownVal(c, o) { const v = c.own[o.id]; return Number.isFinite(v) ? v : 80; }
function logIt(c, text) { c.log.push({ day: chatState().day, text }); c.log = c.log.slice(-8); }

/* ---------------- the cycle ---------------- */
function cycleInfo(name) {
    const tr = traitsOf(name), c = charOf(name), s = chatState();
    if (!tr || !c || !s || !settings.cycle || !tr.cycle) return null;
    const len = clamp(tr.len || 28, 21, 40), per = clamp(tr.period || 5, 2, 9);
    if (c.preg) {
        // the cycle stops; the period she expected simply does not come
        const expect = c.cycleStart + len * Math.max(1, Math.ceil((c.preg.day - c.cycleStart + 1) / len));
        return Object.assign(pregInfo(c.preg, s, expect), { len, per });
    }
    const cd = ((((s.day - c.cycleStart) % len) + len) % len) + 1;
    const ovu = len - 14;
    let phase = 'follicular';
    if (cd <= per) phase = 'period';
    else if (cd >= ovu - 1 && cd <= ovu + 1) phase = 'ovulation';
    else if (cd >= len - 3) phase = 'pms';
    else if (cd > ovu + 1) phase = 'luteal';
    const fertile = cd >= ovu - 5 && cd <= ovu + 1;
    return { preg: false, cd, len, per, phase, fertile, ovu, pain: phase === 'period' ? (tr.pain || 0) : 0 };
}
/* ---------------- the pregnancy, in weeks ----------------
   The days of a pregnancy are counted on the pregnancy itself (gd: days since the night),
   one story day adding pregSpeed of them — so changing the speed changes what is still
   to come, never what has already passed. Weeks are told as a doctor tells them: from
   the last period, two weeks before the night. Term is about forty weeks, rolled once. */
function pregSpeed() { const v = +settings.pregSpeed; return v === 7 || v === 30 ? v : 1; }
function gestDays(p, s) {
    const today = s ? s.day : p.day;
    if (!Number.isFinite(p.gd)) { p.gd = Math.max(0, today - p.day); p.gdDay = today; }   // a pregnancy from before: its days so far
    if (!Number.isFinite(p.gdDay)) p.gdDay = today;
    if (today !== p.gdDay) { p.gd = Math.max(0, p.gd + (today - p.gdDay) * pregSpeed()); p.gdDay = today; }
    return p.gd;
}
// a child's days, the same way
function ageDays(ch, s) {
    const today = s ? s.day : ch.born;
    if (!Number.isFinite(ch.ageD)) { ch.ageD = 0; ch.ageDay = Number.isFinite(ch.born) ? ch.born : today; }
    if (!Number.isFinite(ch.ageDay)) ch.ageDay = today;
    if (today !== ch.ageDay) { ch.ageD = Math.max(0, ch.ageD + (today - ch.ageDay) * pregSpeed()); ch.ageDay = today; }
    return ch.ageD;
}
// everything counted up to today at the old speed — before the speed changes
function syncDays() {
    const s = chatState(); if (!s) return;
    Object.values(s.chars).forEach(c => { if (c.preg) gestDays(c.preg, s); });
    s.children.forEach(ch => ageDays(ch, s));
}
function dueGd(p) {
    if (!Number.isFinite(p.due)) p.due = 266 + Math.round((d100() - 50) / 5);      // 256–276 days: 38½–41½ weeks
    return p.due;
}
function trimester(w) { return w <= 13 ? 1 : w <= 27 ? 2 : 3; }
function pregInfo(p, s, expect) {
    const gd = gestDays(p, s), due = dueGd(p), sp = pregSpeed();
    // late: how far past the period she expected — on the pregnancy's own days
    const late = Math.max(0, Math.floor(gd - (expect - p.day)));
    const weeks = Math.max(1, Math.floor(gd / 7) + 2);
    const known = !settings.hidePregnancy || late >= 14 || weeks >= 14;
    return { preg: true, late, weeks, known, trim: trimester(weeks), gd, due, term: gd >= due, dueIn: Math.max(0, Math.ceil((due - gd) / sp)) };
}
// the chance of a child from one night, by the day of her cycle
function conceptionChance(ci) {
    if (!ci || ci.preg) return 0;
    if (ci.phase === 'period') return 0.5;
    if (ci.cd === ci.ovu - 1 || ci.cd === ci.ovu) return 30;
    if (ci.fertile) return 15;
    return 1;
}
function onIntimacy(detail) {
    try {
        if (!on() || !detail || detail.level !== 'sex') return;
        const s = chatState(); if (!s) return;
        if (detail.chatId && detail.chatId !== getContext().chatId) return;
        const who = String(detail.with || '').trim();
        // the partner named by the scene, else the one who wrote the reply
        const msg = Number.isInteger(detail.messageId) ? getContext().chat[detail.messageId] : null;
        const name = who && knownName(who) || (msg && !msg.is_user ? msg.name : '');
        if (!name) return;
        const c = charOf(name);
        if (!c) return;
        // Vitals and Bonds may both report the same night: one scene is one roll
        if (s.turn - c.lastIntim <= 2) return;
        c.lastIntim = s.turn;
        const tr = traitsOf(name);
        // the player is a woman too (RPG Vitals says so): no child from this night
        let playerF = false;
        try { playerF = (extension_settings.rpg_vitals || {}).playerSex === 'f'; } catch (e) { playerF = false; }
        if (playerF || !settings.pregnancy || !settings.cycle || !tr || !tr.cycle || !tr.fertile || c.preg) { saveChat(); return; }
        const ci = cycleInfo(name);
        const prot = protectionFor(detail, name, tr);
        const chance = Math.round(conceptionChance(ci) * prot.mul * 100) / 100;
        const roll = d100();
        if (prot.what.length) logIt(c, t('protected_by', { what: prot.what.join(', ') }));
        logIt(c, t('concept_roll', { who: userName(), r: roll, c: chance }));
        if (roll <= chance) c.preg = { day: s.day, roll, chance, gd: 0, gdDay: s.day, father: userName() };
        saveChat();
        refresh();
    } catch (e) { console.warn('[Character] intimacy', e); }
}
function userName() { try { return getContext().name1 || 'User'; } catch (e) { return 'User'; } }
/* Contraception on a night: the scene said they used it, she takes the pill, or there is a condom
   in her pocket or in the player's backpack — used up, once. The event is shared with RPG Vitals,
   so the condom taken here is marked on it and the player's side does not take a second one. */
const CONDOM_RE = /презерватив|кондом|condom|rubber/i;
function useCondom(detail, name) {
    if (detail.condomUsed) return true;
    const c = charOf(name, false);
    if (c) {
        const i = c.slots.findIndex(x => CONDOM_RE.test(x.name));
        if (i >= 0) { c.slots.splice(i, 1); detail.condomUsed = true; toastr.info(t('condom_used', { who: name, from: t('from_pocket', { name }) })); return true; }
    }
    const v = inv();
    const hit = v ? (v.list() || []).find(x => CONDOM_RE.test(x.name)) : null;
    if (hit) { v.remove(hit.id); detail.condomUsed = true; toastr.info(t('condom_used', { who: name, from: t('from_bag') })); return true; }
    return false;
}
function protectionFor(detail, name, tr) {
    let mul = 1; const what = [];
    if (detail.protected) { mul *= 0.1; what.push(t('what_story')); }
    else if (useCondom(detail, name)) { mul *= 0.1; what.push(t('what_condom')); }
    if (tr && tr.pill) { mul *= 0.02; what.push(t('what_pill')); }
    return { mul, what };
}
// a name as the scene wrote it, matched to someone this chat knows ("Lisa" for "Lisa Rowe")
function knownName(raw) {
    const k = keyOf(raw);
    const s = chatState();
    const names = new Set(Object.values(s ? s.chars : {}).map(c => c.name));
    try { Object.values((TBE.state() || {}).npcs || {}).forEach(n => names.add(n.name)); } catch (e) { /* no Bonds */ }
    cast().forEach(n => names.add(n));
    const list = [...names];
    return list.find(n => keyOf(n) === k)
        || list.find(n => keyOf(n).split(/\s+/)[0] === k.split(/\s+/)[0] && k.length >= 3)
        || null;
}

// over (a birth, a loss, an abortion — the story says which): her cycle starts again from today
function endPregnancy(c) {
    const s = chatState();
    c.preg = null;
    // a birth still waiting for her goes with it (ended by hand, or a loss)
    if (s && s.birth && s.birth.key === keyOf(c.name)) { s.birth = null; closeBirth(); }
    if (s) c.cycleStart = s.day;
    logIt(c, t('preg_end'));
}

/* ---------------- the clock ---------------- */
const PARTS = ['morning', 'day', 'evening', 'night'];
function partOf(timeText) {
    const x = String(timeText || '').toLowerCase();
    const hm = x.match(/(\d{1,2})[:.](\d{2})/);
    if (hm) { const h = +hm[1] % 24; return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'; }
    if (/утр|morning|dawn|рассвет|sunrise/.test(x)) return 'morning';
    if (/вечер|evening|dusk|закат|sunset/.test(x)) return 'evening';
    if (/ноч|night|midnight|полноч/.test(x)) return 'night';
    if (/дн[её]м|день|полдень|afternoon|noon|midday|day/.test(x)) return 'day';
    return '';
}
// one part of the day passes for everyone this chat knows
function passPart(toPart) {
    const s = chatState(); if (!s) return;
    const next = toPart || PARTS[(Math.max(0, PARTS.indexOf(s.part)) + 1) % 4];
    const sp = clamp(+settings.needsSpeed || 100, 25, 300) / 100;
    Object.values(s.chars).forEach(c => {
        if (!settings.needs) return;
        const nd = needsOf(c.name);
        if (!Number.isFinite(c.hyg)) charOf(c.name);   // an old record: brought up to date first
        if (nd.sat) c.sat = clamp(Math.round(c.sat - 18 * sp), 0, 100);
        if (nd.eng) c.eng = clamp(Math.round(c.eng - (s.part === 'night' ? 22 : 9) * sp), 0, 100);   // a night without sleep costs the most
        if (nd.hyg) c.hyg = clamp(Math.round(c.hyg - 8 * sp), 0, 100);
        nd.own.forEach(o => { c.own[o.id] = clamp(Math.round(ownVal(c, o) - (OWN_RATE[o.rate] || 12) * sp), 0, 100); });
    });
    if (next === 'morning') newDay();
    s.part = next;
}
function newDay() {
    const s = chatState(); if (!s) return;
    s.day += 1;
    syncDays();   // the pregnancies and the children count their own days: a story day is pregSpeed of them
    Object.values(s.chars).forEach(c => {
        // the night that just ended: slept through it or not; drank the evening before or not
        if (settings.nights) {
            // only someone the story kept awake: they spoke during the night and nobody saw them sleep
            c.sleepless = !!c.nightActive && c.sleptSince === false;
            if (Number.isFinite(c.drunkDay) && c.drunkDay === s.day - 1) c.hangoverDay = s.day;
        }
        c.sleptSince = false;
        c.nightActive = false;
        c.ailments = c.ailments.filter(a => { if (!Number.isFinite(a.days)) return true; a.days -= 1; return a.days > 0; });
        if (settings.ailments && d100() <= clamp(+settings.ailmentChance || 0, 0, 50)) {
            const list = t('ail_list');
            const free = list.filter(n => !c.ailments.some(a => keyOf(a.name) === keyOf(n)));
            if (free.length) { const nm = free[Math.floor(Math.random() * free.length)]; c.ailments.push({ id: genId(), name: nm, days: 1 + Math.floor(Math.random() * 3), from: 'dice' }); logIt(c, '🎲 ' + nm); }
        }
    });
}
// the Scene Card moved its clock: the parts of the day between then and now pass
function onScene() {
    try {
        if (!on()) return;
        const s = chatState(); if (!s) return;
        const sc = window.RPG && window.RPG.scene && window.RPG.scene.available && window.RPG.scene.get ? window.RPG.scene.get() : null;
        if (!sc) return;
        const part = partOf(sc.time || sc.timeLabel || '');
        const dk = String(sc.date || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        if (!part) return;
        s.clock = 'scene';
        if (!s.part) { s.part = part; s.dateKey = dk; saveChat(); return; }   // the first look at the clock sets it, nothing passes
        const from = PARTS.indexOf(s.part), to = PARTS.indexOf(part);
        let steps = 0;
        if (dk && s.dateKey && dk !== s.dateKey) steps = (4 - from) + to;          // the next day (or later: counted as one)
        else if (to > from) steps = to - from;
        else if (to < from && !dk) steps = (4 - from) + to;                         // no date: the clock came round
        steps = clamp(steps, 0, 8);
        for (let i = 0; i < steps; i++) passPart(i === steps - 1 ? part : null);
        if (dk) s.dateKey = dk;
        if (steps) { checkTerm(); saveChat(); updateInjection(); refresh(); }
    } catch (e) { console.warn('[Character] clock', e); }
}
// every bot reply: the turn counter; with no Scene Card clock, the replies are the clock
function onReply(speaker) {
    if (!on()) return;
    const s = chatState(); if (!s) return;
    s.turn += 1;
    // "play now" was chosen before this reply: the birth was in it
    if (s.birth && s.birth.stage === 'playing' && s.turn > s.birth.at) deliver({ played: true });
    // awake in the night: who wrote a reply then
    if (speaker && s.part === 'night') { const c = charOf(speaker, false); if (c) c.nightActive = true; }
    const sceneOn = !!(window.RPG && window.RPG.scene && window.RPG.scene.available && window.RPG.scene.isEnabled && window.RPG.scene.isEnabled());
    if (!sceneOn || s.clock !== 'scene') {
        s.partTick += 1;
        if (s.partTick >= clamp(+settings.partEvery || 8, 2, 60)) { s.partTick = 0; if (!s.part) s.part = 'day'; passPart(); }
    }
    checkTerm();
    saveChat();
    updateInjection();
    refresh();
}

/* ---------------- what the Status Bar's update read in the story ---------------- */
function fromStatus(charName, body, messageId) {
    try {
        if (!on() || !body || typeof body !== 'object') return;
        const s = chatState(); if (!s) return;
        const k = keyOf(charName);
        // a recalculation of an older message must not hand the same umbrella over twice
        if (Number.isInteger(messageId) && Number.isInteger(s.lastRead[k]) && messageId <= s.lastRead[k]) return;
        if (Number.isInteger(messageId)) s.lastRead[k] = messageId;
        const c = charOf(charName);
        if (!c) return;
        const yes = v => v === true || v === 'true';
        if (settings.needs) {
            const nd = needsOf(charName);
            // one satiety: a meal fills it much, a drink a little
            if (yes(body.ate)) c.sat = clamp(c.sat + 55, 0, 100);
            if (yes(body.drank)) c.sat = clamp(c.sat + 15, 0, 100);
            if (yes(body.slept)) c.eng = Math.max(c.eng, 92);
            if (nd.hyg && yes(body.washed)) c.hyg = 100;
            (Array.isArray(body.refilled) ? body.refilled : []).slice(0, 6).forEach(n => {
                const o = nd.own.find(x => keyOf(x.name) === keyOf(n) || same(x.name, n));
                if (o) c.own[o.id] = 100;
            });
        }
        if (yes(body.slept)) { c.sleptSince = true; c.sleepless = false; }
        // the story ended it: while the birth is waiting (her term came), that is the birth
        if (c.preg && yes(body.pregnancy_ended)) {
            if (s.birth && s.birth.key === k) deliver({ played: true });
            else endPregnancy(c);
        }
        if (settings.nights && yes(body.drank_alcohol)) c.drunkDay = s.day;   // the morning after is tomorrow
        if (settings.adrenaline && yes(body.fought)) c.adrenTurn = s.turn;
        if (settings.ailments) {
            (Array.isArray(body.new_ailments) ? body.new_ailments : []).slice(0, 3).forEach(a => {
                const nm = String((a && (a.name || a)) || '').trim().slice(0, 40);
                if (!nm || c.ailments.some(x => keyOf(x.name) === keyOf(nm))) return;
                c.ailments.push({ id: genId(), name: nm, days: clamp(parseInt(a && a.days, 10) || 2, 1, 14), from: 'story' });
            });
            (Array.isArray(body.healed) ? body.healed : []).forEach(n => { const kk = keyOf(n); c.ailments = c.ailments.filter(a => keyOf(a.name) !== kk && !keyOf(a.name).includes(kk)); });
        }
        if (settings.slots) {
            (Array.isArray(body.got_from_player) ? body.got_from_player : []).slice(0, 3).forEach(n => takeFromPlayer(charName, n, true));
            (Array.isArray(body.gave_to_player) ? body.gave_to_player : []).slice(0, 3).forEach(n => giveToPlayer(charName, n, true));
            if (settings.itemsSelf) {
                // picked up for themselves (not from the player): into a free pocket
                (Array.isArray(body.picked_up) ? body.picked_up : []).slice(0, 3).forEach(n => {
                    const nm = String(n || '').trim().slice(0, 60);
                    if (!nm || c.slots.length >= slotCap() || c.slots.some(x => same(x.name, nm))) return;
                    c.slots.push({ id: genId(), name: nm, desc: '', from: 'own', item: null });
                    logIt(c, '+ ' + nm);
                });
                // used up, eaten, given to someone else: out of the pocket
                (Array.isArray(body.used_up) ? body.used_up : []).slice(0, 3).forEach(n => {
                    const i = c.slots.findIndex(x => same(x.name, n));
                    if (i >= 0) logIt(c, '− ' + c.slots.splice(i, 1)[0].name);
                });
            }
        }
        saveChat(); updateInjection(); refresh();
    } catch (e) { console.warn('[Character] status read', e); }
}
// the extra the Status Bar asks for, in its own request — shown to her before it was added
function statusAsk(charName) {
    if (!on()) return '';
    const u = userName();
    // the extra questions, each only when its switch is on
    const c0 = charOf(charName, false);
    let more = '';
    if (settings.slots && settings.itemsSelf) more += `\n- picked_up: things ${charName} took for themselves from the scene (not from ${u}). used_up: things from ${charName}'s own pockets that ${charName} used up, ate, drank, broke or gave to someone other than ${u} — including what ${u} has just handed over, if ${charName} ate or used it there. ${charName}'s pockets now: ${c0 && c0.slots.length ? c0.slots.map(x => x.name).join(', ') : 'empty'}.`;
    // the needs this character has: washing, and needs of their own
    const nd0 = settings.needs ? needsOf(charName) : null;
    const askWash = !!(nd0 && nd0.hyg), askOwn = nd0 && nd0.own.length ? nd0.own.map(o => o.name) : [];
    if (askWash) more += `\n- washed: true only if ${charName} personally bathed, showered or washed up there.`;
    if (askOwn.length) more += `\n- refilled: which of ${charName}'s own needs (${askOwn.join(', ')}) ${charName} clearly satisfied there, by name. Empty if none.`;
    if (settings.nights) more += `\n- drank_alcohol: true only if ${charName} actually got drunk or drank a lot of alcohol there.`;
    if (settings.adrenaline) more += `\n- fought: true only if ${charName} was in a real fight there (blows, weapons, a struggle), not an argument.`;
    const preg = c0 && c0.preg;
    if (preg) more += `\n- pregnancy_ended: true only if the story clearly ends ${charName}'s pregnancy there (a birth, a miscarriage, an abortion).`;
    return `
6. Also report what happened to ${charName}'s body and belongings in the NEW part of the story only (after the line "=== NEW ==="), in a "body" object:
"body": {"ate": false, "drank": false, "slept": false, "new_ailments": [{"name": "", "days": 1}], "healed": [], "got_from_player": [], "gave_to_player": []${settings.slots && settings.itemsSelf ? ', "picked_up": [], "used_up": []' : ''}${settings.nights ? ', "drank_alcohol": false' : ''}${settings.adrenaline ? ', "fought": false' : ''}${c0 && c0.preg ? ', "pregnancy_ended": false' : ''}${askWash ? ', "washed": false' : ''}${askOwn.length ? ', "refilled": []' : ''}}
- ate / drank / slept: true only if ${charName} personally ate something, drank, or slept through a night there — never for what someone else in the scene did (${u}, another character, an animal).
- new_ailments: a small illness or injury ${charName} clearly got (a cold, a sprained ankle, a toothache) and how many days it lasts (1-7). healed: names of ailments that clearly passed.
- got_from_player: things ${u} actually handed to ${charName}, or ${charName} took from ${u}, by name. gave_to_player: things ${charName} actually handed to ${u}.${more}
Leave everything false or empty when nothing like that happened. ${lang() === 'ru' ? 'Write the names in Russian.' : 'Write the names in English.'}`;
}

/* ---------------- pockets, and the player's backpack (Tavern RPG Engine) ---------------- */
function inv() { const v = window.RPG && window.RPG.inventory; return v && v.available && (!v.isEnabled || v.isEnabled()) ? v : null; }
function same(a, b) {
    const x = keyOf(a), y = keyOf(b);
    if (!x || !y) return false;
    try { if (window.RPG && window.RPG.match && window.RPG.match.same(x, y)) return true; } catch (e) { /* no matcher */ }
    return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}
function slotCap() { return clamp(parseInt(settings.slotCount, 10) || 5, 1, 8); }
// a thing from the player's backpack (by name, or the item itself) into the character's pocket
function takeFromPlayer(charName, nameOrItem, quiet = false) {
    const c = charOf(charName); if (!c) return false;
    if (c.slots.length >= slotCap()) { toastr.info(t('full', { name: charName })); return false; }
    const v = inv();
    let item = null;
    if (nameOrItem && typeof nameOrItem === 'object') item = nameOrItem;
    else if (v) {
        const hit = (v.list() || []).find(i => same(i.name, nameOrItem));
        if (hit) item = v.remove(hit.id);
    }
    const nm = String(item ? item.name : nameOrItem || '').trim().slice(0, 60);
    if (!nm) return false;
    c.slots.push({ id: genId(), name: nm, desc: item && item.desc ? String(item.desc).slice(0, 200) : '', from: 'player', item: item || null });
    saveChat();
    toastr.info(t('gave', { name: charName, item: nm }));
    if (!quiet) { updateInjection(); refresh(); }
    return true;
}
// from the character's pocket (or, when the story says so, out of nowhere) into the player's backpack
function giveToPlayer(charName, nameOrId, quiet = false) {
    const c = charOf(charName); if (!c) return false;
    const i = c.slots.findIndex(sl => sl.id === nameOrId || same(sl.name, nameOrId));
    const slot = i >= 0 ? c.slots.splice(i, 1)[0] : null;
    const nm = slot ? slot.name : String(nameOrId || '').trim().slice(0, 60);
    if (!nm) return false;
    const v = inv();
    if (v) v.add(slot && slot.item ? slot.item : { name: nm, desc: slot ? slot.desc : '', type: 'misc' });
    saveChat();
    toastr.info(t('got', { name: charName, item: nm }));
    if (!quiet) { updateInjection(); refresh(); }
    return true;
}

/* ---------------- today's states: a hangover, a bad night, the adrenaline of a fight ---------------- */
function stateBits(c) {
    const s = chatState(); const out = [];
    if (!c || !s) return out;
    if (settings.nights) {
        if (c.hangoverDay === s.day && (s.part === 'morning' || s.part === 'day' || !s.part)) out.push('hangover');
        if (c.sleepless) out.push('sleepless');
    }
    if (settings.adrenaline && Number.isFinite(c.adrenTurn)) {
        const d = s.turn - c.adrenTurn;
        if (d >= 0 && d <= 2) out.push('rush');
        else if (d >= 3 && d <= 5) out.push('crash');
    }
    if (babyNights(c.name)) out.push('baby');
    return out;
}

/* ---------------- what the body does to the relationship dice ---------------- */
function needBits(c) {
    const out = [];
    if (!settings.needs || !c) return out;
    const nd = needsOf(c.name);
    if (nd.sat) { if (c.sat < 10) out.push('very_hungry'); else if (c.sat < 25) out.push('hungry'); }
    if (nd.eng) { if (c.eng < 15) out.push('exhausted'); else if (c.eng < 30) out.push('tired'); }
    if (nd.hyg && c.hyg < 20) out.push('dirty');
    nd.own.forEach(o => { if (ownVal(c, o) < 20) out.push('own:' + o.name); });
    return out;
}
function dcMod(name) {
    if (!on() || !settings.dice) return 0;
    const c = charOf(name, false); if (!c) return 0;
    let m = 0;
    const ci = cycleInfo(name);
    if (ci && !ci.preg) {
        if (ci.phase === 'period') m += [0, 1, 2, 2][ci.pain || 0];
        else if (ci.phase === 'pms') m += 1;
        else if (ci.phase === 'ovulation') m -= 1;
    }
    // the first months (nausea) and the last (heavy) make it harder; the middle ones do not
    if (ci && ci.preg && ci.weeks >= 5 && ci.trim !== 2) m += 1;
    m += Math.min(2, c.ailments.length);
    m += Math.min(2, needBits(c).length);
    stateBits(c).forEach(b => { m += b === 'rush' ? -1 : 1; });   // a rush makes them bolder; the rest make it harder
    return clamp(m, -1, 4);
}

/* ---------------- the line for the main model ---------------- */
// who is in the scene: whoever wrote the last ten replies
function presentNames() {
    const out = new Set();
    (getContext().chat || []).slice(-10).forEach(m => { if (m && !m.is_user && !m.is_system && m.name) out.add(m.name); });
    return [...out];
}
function updateInjection() {
    try {
        if (!on() || !getContext().chatId) { setExtensionPrompt(PROMPT_KEY, '', 1, 0, false); setExtensionPrompt(BIRTH_KEY, '', 1, 0, false); return; }
        const s = chatState(); if (!s) return;
        // the birth: "play now" is a directive for the next reply (asked for by hand, so it goes even with
        // the line below switched off); a skipped birth is one fact, told for three replies
        let bt = '';
        if (settings.birth && s.birth && s.birth.stage === 'playing') bt = laborDirective(s.birth);
        else if (s.fact && s.turn < s.fact.until) bt = `[${s.fact.text}]`;
        setExtensionPrompt(BIRTH_KEY, bt, 1, 0, false, extension_prompt_roles.SYSTEM);
        if (!settings.inject) { setExtensionPrompt(PROMPT_KEY, '', 1, 0, false); return; }
        const lines = [];
        presentNames().forEach(name => {
            if (isWorldName(name)) return;
            const c = charOf(name, false); if (!c) return;
            const bits = needBits(c).map(k => k.startsWith('own:') ? t('own_low', { n: k.slice(4) }) : t(k));
            const ci = cycleInfo(name);
            if (ci) {
                if (ci.preg) {
                    if (ci.known) bits.push(t('inj_preg', { w: ci.weeks, knows: '' }) + (ci.weeks >= 5 ? ' — ' + t('inj_trim' + ci.trim) : ''));
                    else if (ci.late >= 1) bits.push(t('inj_late', { n: ci.late }) + (ci.weeks >= 5 ? '; ' + t('inj_trim1') : ''));
                    if (s.birth && s.birth.key === keyOf(name) && s.birth.stage === 'later') bits.push(t('inj_term'));
                }
                else if (ci.phase === 'period') bits.push(t('inj_period', { pain: t('pain' + (ci.pain || 0)) }));
                else if (ci.phase === 'pms') bits.push(t('inj_pms'));
                else if (ci.phase === 'ovulation') bits.push(t('inj_ovu'));
            }
            c.ailments.forEach(a => bits.push(String(a.name).toLowerCase()));
            stateBits(c).forEach(b => bits.push(t('inj_' + b)));
            if (settings.slots && c.slots.length) bits.push(t('inj_carry', { list: c.slots.map(x => x.name).join(', ') }));
            if (bits.length) lines.push(`${name}: ${bits.join('; ')}.`);
        });
        childLines().forEach(l => lines.push(l));
        const text = lines.length ? `[${t('inj_head')}]\n${lines.join('\n')}` : '';
        setExtensionPrompt(PROMPT_KEY, text, 1, clamp(parseInt(settings.injectDepth, 10) || 0, 0, 20), false, extension_prompt_roles.SYSTEM);
    } catch (e) { console.warn('[Character] injection', e); }
}

/* ---------------- birth and children ----------------
   At term a newspaper clipping drops in (the style of the twist clipping): play the birth now
   (a directive for the next reply, after which the child is there), later (it waits, reminded
   in three replies), or skip (born off-screen, one fact told to the main model for a few
   replies). The child is a record of this chat: sex by a die, each trait by a die from the
   mother, the father or its own, an age counted in story days at the pregnancy's speed. */
const PLAYER_KEY = '__player';
const BIRTH_KEY = 'rpg_body_birth';
const STAGES = [[90, 'new'], [365, 'inf'], [1095, 'tod'], [4745, 'kid'], [6570, 'teen'], [Infinity, 'adult']];
function ageStage(d) { const n = Number.isFinite(d) ? d : 0; return STAGES.find(x => n < x[0])[1]; }
function ageText(d) {
    const n = Math.max(0, Math.floor(Number.isFinite(d) ? d : 0));
    if (n < 61) return t('age_d', { n });
    if (n < 730) return t('age_m', { n: Math.floor(n / 30.4) });
    return t('age_y', { n: Math.floor(n / 365.25) });
}
function isParent(ch, name) { const k = keyOf(name); return !!k && (keyOf(ch.mother) === k || keyOf(ch.father) === k); }
function kidsOf(name) { const s = chatState(); return s ? s.children.filter(ch => isParent(ch, name)) : []; }
// a newborn that nobody else looks after: its parents do not sleep
function babyNights(name) {
    if (!on() || !settings.birth || !settings.babyNights) return false;
    return kidsOf(name).some(ch => !ch.care && ageStage(ageDays(ch, chatState())) === 'new');
}
function sexWord(sex, form) { return t((sex === 'm' ? 'boy' : 'girl') + (form || '')); }

// her term came: the clipping, once (afterwards it waits in her tab)
function checkTerm() {
    if (!on() || !settings.birth) return;
    const s = chatState(); if (!s) return;
    if (s.birth) {
        if (s.birth.stage === 'later' && s.turn >= s.birth.remind) { s.birth.remind = s.turn + 3; showBirth(); }
        return;
    }
    for (const c of Object.values(s.chars)) {
        if (!c.preg) continue;
        const ci = cycleInfo(c.name);
        if (ci && ci.preg && ci.term) { startLabor({ key: keyOf(c.name), mother: c.name, father: c.preg.father || userName(), player: false, weeks: ci.weeks }); return; }
    }
}
function startLabor(o) {
    const s = chatState(); if (!s) return false;
    s.birth = {
        key: o.key, mother: String(o.mother || ''), father: String(o.father || ''), player: !!o.player,
        weeks: Number.isFinite(+o.weeks) ? +o.weeks : 40,
        sex: d100() <= 51 ? 'm' : 'f',          // a few more boys than girls, as everywhere
        stage: 'due', at: s.turn, remind: 0, name: '', care: ''
    };
    saveChat(); updateInjection(); refresh();
    showBirth();
    return true;
}
function chooseBirth(how, name, care) {
    const s = chatState(); const b = s && s.birth; if (!b) return;
    b.name = String(name || '').trim().slice(0, 40);
    b.care = String(care || '').trim().slice(0, 60);
    if (how === 'now') { b.stage = 'playing'; b.at = s.turn; toastr.info(t('np_playing')); }
    else if (how === 'later') { b.stage = 'later'; b.remind = s.turn + 3; }
    else { deliver({ played: false }); return; }
    saveChat(); updateInjection(); refresh();
}
// the child is here
function deliver(o) {
    const s = chatState(); const b = s && s.birth; if (!b) return null;
    const mt = b.player ? null : npcTraits(b.mother);
    const ft = keyOf(b.father) === keyOf(userName()) ? null : npcTraits(b.father);
    const inh = inherit(mt, ft);
    const ch = {
        id: genId(), name: b.name, sex: b.sex, born: s.day, ageD: 0, ageDay: s.day,
        mother: b.mother, father: b.father, motherPlayer: !!b.player, fatherPlayer: !b.player && keyOf(b.father) === keyOf(userName()),
        care: b.care, traits: inh.traits, from: inh.from, rolls: inh.rolls, desc: '', card: ''
    };
    s.children.push(ch);
    s.birth = null;
    if (!b.player) {
        const c = charOf(b.mother, false);
        if (c && c.preg) endPregnancy(c);
        if (c) logIt(c, t('born_log', { name: ch.name || t('no_name') }));
    } else {
        // RPG Vitals ends the player's own pregnancy on this
        try { window.dispatchEvent(new CustomEvent('rpg:birth', { detail: { player: true, chatId: getContext().chatId, child: { name: ch.name, sex: ch.sex } } })); } catch (e) { /* no Vitals */ }
    }
    if (!o || !o.played) s.fact = { text: t('fact_skip', { who: b.mother, sex: sexWord(ch.sex, '_acc'), named: ch.name ? t('named', { name: ch.name }) : '' }), until: s.turn + 3 };
    toastr.success(t('born_toast', { name: ch.name || t('no_name'), sex: sexWord(ch.sex) }));
    saveChat(); updateInjection(); refresh();
    if (settings.childDesc) describeChild(ch.id, true);
    return ch;
}
function npcTraits(name) {
    if (!name) return null;
    try { const n = TBE.npcFor(name); return n && n.traits ? n.traits : null; } catch (e) { return null; }
}
// each trait: a die — 1–45 the mother's, 46–90 the father's, 91–100 its own; a parent with no page gives way to the other
function inherit(mt, ft) {
    let keys = [];
    try { keys = TBE.traitKeys(); } catch (e) { keys = []; }
    const traits = {}, from = {}, rolls = {};
    keys.forEach(k => {
        const r = d100(); rolls[k] = r;
        let src = r <= 45 ? 'm' : r <= 90 ? 'f' : 'n';
        if (src === 'm' && !mt) src = ft ? 'f' : 'n';
        else if (src === 'f' && !ft) src = mt ? 'm' : 'n';
        const base = src === 'm' ? +mt[k] : src === 'f' ? +ft[k] : 15 + Math.floor(Math.random() * 71);
        traits[k] = clamp(Math.round((Number.isFinite(base) ? base : 50) + (src === 'n' ? 0 : Math.random() * 20 - 10)), 0, 100);
        from[k] = src;
    });
    return { traits, from, rolls };
}
// the traits worth saying (far from the middle), each with where it came from
function kidTraits(ch, limit = 4) {
    const keys = Object.keys(ch.traits || {});
    return keys.map(k => ({ k, v: ch.traits[k], dist: Math.abs(ch.traits[k] - 50) }))
        .filter(x => x.dist >= 15).sort((a, b) => b.dist - a.dist).slice(0, limit)
        .map(x => {
            let w = '';
            try { w = (TBE.traitWords(Object.fromEntries(keys.map(y => [y, y === x.k ? x.v : 50])), ch.sex === 'm' ? 'm' : 'f', 1) || [])[0] || ''; } catch (e) { w = ''; }
            return { k: x.k, word: w || x.k, from: (ch.from || {})[x.k] || 'n', roll: (ch.rolls || {})[x.k] };
        });
}
function cardText(name) {
    try {
        if (keyOf(name) === keyOf(userName())) return String((getContext().powerUserSettings || {}).persona_description || '').slice(0, 700);
        const ch = characters.find(c => c && c.name === name);
        return ch ? String(ch.description || '').slice(0, 700) : '';
    } catch (e) { return ''; }
}
// the newborn's note — the one model call here; shown to her before it was added
const busyKids = new Set();
async function describeChild(id, quiet) {
    const s = chatState(); const ch = s && s.children.find(x => x.id === id); if (!ch || busyKids.has(id)) return;
    let hasKey = false;
    try { hasKey = SB.hasKey(); } catch (e) { hasKey = false; }
    if (!hasKey) { if (!quiet) toastr.warning(t('kid_no_key')); return; }
    const chatId = getContext().chatId;
    busyKids.add(id); refresh();
    try {
        const sys = 'You write short notes about characters for a roleplay. Plain prose only: no lists, no headings, no quotation marks around the whole text.';
        const user = `A child has just been born in the story. Write a note of 3-4 lines about this child: what the baby looks like now and whose features show (from the parents' descriptions below), and the temperament the child will likely grow into (from the traits given). Do not invent events, names or places that are not given here.

Child: ${ch.name || 'not named yet'}, a ${ch.sex === 'm' ? 'boy' : 'girl'}.
Temperament (rolled from the parents): ${kidTraits(ch, 5).map(x => x.word).join(', ') || 'nothing marked yet'}.
Mother: ${ch.mother}. ${cardText(ch.mother)}
Father: ${ch.father || 'unknown'}. ${ch.father ? cardText(ch.father) : ''}

${lang() === 'ru' ? 'Write in Russian.' : 'Write in English.'}`;
        const text = await SB.aiText(sys, user, 400);
        if (getContext().chatId !== chatId) return;           // the chat changed meanwhile: not this one's child
        if (text) { ch.desc = text; saveChat(); }
    } catch (e) {
        toastr.warning(t('kid_desc_fail', { e: String(e && e.message || e) }));
    } finally { busyKids.delete(id); refresh(); }
}
// a Tavern card for the child (only when asked): the note, the parents, the age
async function createCard(id) {
    const s = chatState(); const ch = s && s.children.find(x => x.id === id); if (!ch) return;
    if (!ch.name) { toastr.info(t('kid_card_need_name')); return; }
    try {
        const ctx = getContext();
        const fd = new FormData();
        fd.append('ch_name', ch.name);
        fd.append('description', [ch.desc, t('card_parents', { m: ch.mother, f: ch.father || '—' }), t('card_age', { a: `${t('age_' + ageStage(ageDays(ch, chatState())))}, ${ageText(ageDays(ch, chatState()))}` })].filter(Boolean).join('\n\n'));
        fd.append('personality', kidTraits(ch, 5).map(x => x.word).join(', '));
        fd.append('first_mes', '');
        fd.append('creator_notes', t('card_note'));
        const h = Object.assign({}, ctx.getRequestHeaders()); delete h['Content-Type'];
        const resp = await fetch('/api/characters/create', { method: 'POST', headers: h, body: fd });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        ch.card = (await resp.text()).trim();
        // the body it was born with, kept for the new card
        settings.traits[keyOf(ch.name)] = Object.assign(rollTraits(ch.name), { sex: ch.sex, cycle: ch.sex === 'f' });
        saveSettings(); saveChat();
        try { if (typeof ctx.getCharacters === 'function') await ctx.getCharacters(); } catch (e) { /* the list refreshes on its own later */ }
        toastr.success(t('kid_card_ok', { name: ch.name }));
    } catch (e) { console.warn('[Character] card', e); toastr.error(t('kid_card_fail')); }
    refresh();
}
// who looks after the baby: '' is the parents themselves
function careOptions(cur, parents) {
    const seen = new Set(parents.map(keyOf));
    const names = cast().filter(n => !seen.has(keyOf(n)) && keyOf(n) !== keyOf(userName()));
    if (cur && !names.some(n => keyOf(n) === keyOf(cur))) names.unshift(cur);
    return `<option value="">${esc(t('care_parents'))}</option>${names.map(n => `<option value="${esc(n)}"${keyOf(n) === keyOf(cur) ? ' selected' : ''}>${esc(n)}</option>`).join('')}<option value="__other">${esc(t('care_other'))}</option>`;
}
function laborDirective(b) {
    const named = b.name ? t('named', { name: b.name }) : '';
    return `[${t(b.player ? 'labor_p' : 'labor', { who: b.mother, sex: sexWord(b.sex, '_acc'), sexn: sexWord(b.sex), named })}]`;
}
function childLines() {
    const s = chatState(); if (!s || !settings.birth) return [];
    const here = new Set(presentNames().map(keyOf)); here.add(keyOf(userName()));
    return s.children.filter(ch => ageDays(ch, s) < 365 && (here.has(keyOf(ch.mother)) || here.has(keyOf(ch.father)))).map(ch => {
        const parents = [ch.mother, ch.father].filter(Boolean).join(' & ');
        const care = ch.care ? t('care_inj', { who: ch.care }) : t('care_inj_parents');
        return `${t('inj_kid', { name: ch.name || t('no_name'), age: ageText(ageDays(ch, chatState())), parents })}; ${care}.`;
    });
}

/* the clipping itself */
function sceneNow() {
    try { const sc = window.RPG && window.RPG.scene && window.RPG.scene.available && window.RPG.scene.get ? window.RPG.scene.get() : null; return sc || null; } catch (e) { return null; }
}
function birthHtml(b) {
    const s = chatState(), sc = sceneNow();
    const when = sc && (sc.date || sc.time) ? [sc.date, sc.time || sc.timeLabel].filter(Boolean).join(' · ') : `${t('day_n', { n: s.day })}${s.part ? ' · ' + partWord(s.part) : ''}`;
    const where = sc && (sc.location || sc.place) ? String(sc.location || sc.place) : `№ ${s.day}`;
    const parents = [b.mother, b.father];
    return `<div class="rbd-np-wrap">
        <div class="rbd-np-shadow" aria-hidden="true"></div>
        <div class="rbd-np-drop">
            <div class="rbd-np-tape" aria-hidden="true"></div>
            <article class="rbd-np rbd-paper rbd-torn">
                <button type="button" class="rbd-np-x" aria-label="${esc(t('np_close'))}" title="${esc(t('np_close'))}">✕</button>
                <header class="rbd-np-head">
                    <div class="rbd-np-mast"><span></span><span class="rbd-np-title">${esc(t('np_paper'))}</span><span></span></div>
                    <div class="rbd-np-line"><span>${esc(t('np_extra'))}</span><span>${esc(when)}</span><span>${esc(where)}</span></div>
                </header>
                <h2 class="rbd-np-h" id="rbd-np-h">${esc(t('np_head', { who: b.mother }))}</h2>
                <p class="rbd-np-lede">${esc(b.father ? t('np_lede', { w: b.weeks, f: b.father }) : t('np_lede_nf', { w: b.weeks }))}</p>
                <div class="rbd-np-form">
                    <label class="rbd-np-f"><span>${esc(t('np_name'))} · ${b.sex === 'm' ? '👦' : '👧'} ${esc(sexWord(b.sex))}</span>
                        <input type="text" class="rbd-np-name" maxlength="40" placeholder="${esc(t('np_name_ph'))}" value="${esc(b.name)}"></label>
                    <label class="rbd-np-f"><span>${esc(t('np_care'))}</span>
                        <select class="rbd-np-care">${careOptions(b.care, parents)}</select>
                        <input type="text" class="rbd-np-care-other" maxlength="60" placeholder="${esc(t('care_ph'))}" hidden></label>
                </div>
                <div class="rbd-np-div"><span></span><span>${esc(t('np_how'))}</span><span></span></div>
                <div class="rbd-np-opts">
                    <button type="button" class="rbd-np-opt" data-how="now"><span class="rbd-np-n">1.</span><span><b>${esc(t('np_now'))}</b><i>${esc(t('np_now_d'))}</i></span></button>
                    <button type="button" class="rbd-np-opt" data-how="later"><span class="rbd-np-n">2.</span><span><b>${esc(t('np_later'))}</b><i>${esc(t('np_later_d'))}</i></span></button>
                    <button type="button" class="rbd-np-opt" data-how="skip"><span class="rbd-np-n">3.</span><span><b>${esc(t('np_skip'))}</b><i>${esc(t('np_skip_d'))}</i></span></button>
                </div>
                <p class="rbd-np-foot">${esc(t('np_foot'))}</p>
                <div class="rbd-np-stamp" aria-hidden="true">${esc(t('np_stamp'))}</div>
            </article>
        </div>
    </div>`;
}
function closeBirth() { document.querySelectorAll('.rbd-birth-ov').forEach(el => el.remove()); }
function showBirth() {
    const s = chatState(); const b = s && s.birth;
    if (!on() || !settings.birth || !b || b.stage === 'playing' || document.querySelector('.rbd-birth-ov')) return;
    const chatId = getContext().chatId;
    const ov = document.createElement('div');
    ov.className = 'rbd-birth-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'rbd-np-h');
    ov.innerHTML = birthHtml(b);
    document.body.appendChild(ov);
    const name = ov.querySelector('.rbd-np-name'), care = ov.querySelector('.rbd-np-care'), other = ov.querySelector('.rbd-np-care-other');
    care.addEventListener('change', () => { other.hidden = care.value !== '__other'; if (!other.hidden) other.focus(); });
    const careVal = () => care.value === '__other' ? other.value : care.value;
    const pickIt = how => {
        const left = getContext().chatId !== chatId;   // the chat changed under it: it is not this chat's birth
        closeBirth();
        if (!left) chooseBirth(how, name.value, careVal());
    };
    ov.querySelectorAll('.rbd-np-opt').forEach(btn => btn.addEventListener('click', () => pickIt(btn.dataset.how)));
    ov.querySelector('.rbd-np-x').addEventListener('click', () => pickIt('later'));
    ov.addEventListener('click', e => { if (e.target === ov) pickIt('later'); });
    ov.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); pickIt('later'); }
        if (e.key === 'Tab') {                     // the focus stays inside the clipping
            const f = [...ov.querySelectorAll('button, input:not([hidden]), select')];
            const i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
            else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
    });
    setTimeout(() => { try { name.focus({ preventScroll: true }); } catch (e) { /* gone */ } }, 60);
}
// a new chat: the old clipping goes; this chat's unanswered one comes back
function onChat() {
    closeBirth();
    updateInjection(); refresh();
    if (!on()) return;
    const s = chatState();
    if (s && s.birth && s.birth.stage === 'due') setTimeout(showBirth, 400);
}

/* ---------------- a world card is not a body ---------------- */
function isWorldName(name) {
    const n = String(name || '').trim();
    const main = n.split(/\s[-–—:|]\s|[(\[]/)[0].trim();
    if (/&/.test(main)) return true;
    if (/\b(academy|school|manor|atelier|service|guild|kingdom|empire|world|city|town|village|tavern|inn|hotel|rpg|simulator|adventure|story)\b/i.test(main)) return true;
    if (/(?<![\p{L}])(академи[яи]|школ[аы]|гильди[яи]|королевств[оа]|импери[яи]|мир|город|деревн[яи]|таверн[аы]|приключени[ея]|симулятор)(?![\p{L}])/iu.test(main)) return true;
    return main.split(/\s+/).length >= 4;
}
// who the tab can show for this block: the character, or — on a world card — the people inside it
function cast() {
    const out = new Set();
    try { Object.values((TBE.state() || {}).npcs || {}).forEach(n => { if (n && n.name && !isWorldName(n.name)) out.add(n.name); }); } catch (e) { /* no Bonds */ }
    const s = chatState();
    if (s) Object.values(s.chars).forEach(c => { if (c && c.name && !isWorldName(c.name)) out.add(c.name); });
    presentNames().forEach(n => { if (!isWorldName(n)) out.add(n); });
    return [...out];
}

/* ---------------- the pane ---------------- */
const pick = {};   // block -> whose body it shows (a world card)
const moreOpen = new Set();   // whose body settings are open — they stay open while you change them
function meter(icon, label, val, cls) {
    const v = clamp(Math.round(val), 0, 100);
    const band = v < 25 ? 'low' : v < 55 ? 'mid' : 'high';
    return `<div class="rbd-need ${cls} ${band}"><span class="rbd-need-i" aria-hidden="true">${icon}</span><span class="rbd-need-l">${esc(label)}</span><span class="rbd-need-bar"><span style="width:${v}%"></span></span><span class="rbd-need-v">${v}</span></div>`;
}
// the clipping folded into a strip, in the mother's tab (or the father's, when the mother is the player)
function birthStrip(name) {
    const s = chatState(); const b = s && s.birth;
    if (!settings.birth || !b || !(keyOf(name) === b.key || (b.player && keyOf(name) === keyOf(b.father)))) return '';
    if (b.stage === 'playing') return `<div class="rbd-quiet rbd-playing">👶 ${esc(t('np_playing'))}</div>`;
    return `<button type="button" class="rbd-strip rbd-paper rbd-torn-strip" aria-label="${esc(t('np_open'))}"><span class="rbd-strip-stamp">${esc(t('np_stamp'))}</span><span class="rbd-strip-t">${esc(t('np_head', { who: b.mother }))}</span><span class="rbd-strip-chev" aria-hidden="true">▾</span></button>`;
}
function kidsHtml(name) {
    if (!settings.birth) return '';
    const list = kidsOf(name);
    if (!list.length) return '';
    const FROM = { m: '♀', f: '♂', n: '✦' };
    return `<div class="rbd-sect">👶 ${esc(t('children'))}</div><div class="rbd-kids">${list.map(ch => {
        const parents = [ch.mother, ch.father];
        const traits = kidTraits(ch);
        const busy = busyKids.has(ch.id);
        return `<div class="rbd-kid" data-kid="${esc(ch.id)}">
            <div class="rbd-kid-top"><span class="rbd-kid-sex" aria-hidden="true">${ch.sex === 'm' ? '👦' : '👧'}</span>
                <b class="rbd-kid-name">${esc(ch.name || t('no_name'))}</b>
                <button type="button" class="rbd-kid-btn rbd-kid-ren" title="${esc(t('rename'))}" aria-label="${esc(t('rename'))}">✎</button>
                <span class="rbd-kid-age">${esc(t('age_' + ageStage(ageDays(ch, chatState()))))} · ${esc(ageText(ageDays(ch, chatState())))}</span></div>
            <div class="rbd-kid-par">${esc(sexWord(ch.sex))} · ${esc(parents.filter(Boolean).join(' & '))}</div>
            <label class="rbd-kid-care">${esc(t('care'))} <select class="rbd-kid-carep">${careOptions(ch.care, parents)}</select><input type="text" class="rbd-kid-care-other text_pole" maxlength="60" placeholder="${esc(t('care_ph'))}" hidden></label>
            ${traits.length ? `<div class="rbd-kid-traits">${traits.map(x => `<span class="rbd-kid-tr from-${x.from}" title="🎲 ${esc(String(x.roll ?? '—'))} — ${esc(t('from_' + x.from))}"><i aria-hidden="true">${FROM[x.from]}</i> ${esc(x.word)}</span>`).join('')}</div>` : ''}
            ${busy ? `<div class="rbd-kid-desc busy">${esc(t('kid_busy'))}</div>` : ch.desc ? `<div class="rbd-kid-desc">${esc(ch.desc)}</div>` : ''}
            <div class="rpg-tools rbd-kid-tools">
                <button type="button" class="rpg-tool rbd-kid-d"${busy ? ' disabled' : ''}>✍ ${esc(ch.desc ? t('kid_redesc') : t('kid_desc'))}</button>
                <button type="button" class="rpg-tool rbd-kid-c"${ch.card ? ' disabled' : ''}>🃏 ${esc(ch.card ? t('kid_card_done') : t('kid_card'))}</button>
                <button type="button" class="rpg-tool rbd-kid-x">✕ ${esc(t('kid_del'))}</button>
            </div>
        </div>`;
    }).join('')}</div>`;
}
// in the character's body settings: which needs this one has, and needs of their own
function needsEditHtml(name) {
    const nd = needsOf(name);
    const box = (k, icon) => `<label class="rbd-nd-chk"><input type="checkbox" class="rbd-nd" data-nd="${k}"${nd[k] ? ' checked' : ''}> ${icon} ${esc(t(k))}</label>`;
    const rateSel = (cur, cls) => `<select class="${cls}" aria-label="${esc(t('rate'))}" title="${esc(t('rate'))}">${['slow', 'mid', 'fast'].map(r => `<option value="${r}"${cur === r ? ' selected' : ''}>${esc(t('rate_' + r))}</option>`).join('')}</select>`;
    return `<fieldset class="rbd-nds"><legend>${esc(t('needs_h'))}</legend>
        <div class="rbd-nd-row">${box('sat', '🍞')}${box('eng', '🌙')}${box('hyg', '🧼')}</div>
        ${nd.own.map(o => `<div class="rbd-nd-own" data-own="${esc(o.id)}"><span class="rbd-nd-ic">${esc(o.icon || '✦')}</span><b>${esc(o.name)}</b>${rateSel(o.rate || 'mid', 'rbd-nd-rate')}<button type="button" class="rbd-nd-x" title="${esc(t('need_del'))}" aria-label="${esc(t('need_del'))}">✕</button></div>`).join('')}
        <div class="rbd-nd-add"><input type="text" class="rbd-nd-icon" maxlength="4" placeholder="${esc(t('need_icon_ph'))}" aria-label="emoji"><input type="text" class="rbd-nd-name" maxlength="24" placeholder="${esc(t('need_name_ph'))}" aria-label="${esc(t('need_add'))}">${rateSel('mid', 'rbd-nd-newrate')}<button type="button" class="rbd-nd-plus" title="${esc(t('need_add'))}" aria-label="${esc(t('need_add'))}">＋</button></div>
    </fieldset>`;
}
function paneHtml(name, blockChar) {
    const tr = traitsOf(name), c = charOf(name), s = chatState();
    if (!tr || !c || !s) return `<div class="rpg-bonds-note">${esc(t('nobody'))}</div>`;
    const world = isWorldName(blockChar);
    let h = '';
    if (world) {
        const list = cast();
        h += `<div class="rbd-who">${list.map(n => `<span class="rbd-chip${n === name ? ' on' : ''}" data-who="${esc(n)}">${esc(n)}</span>`).join('')}</div>`;
    }
    // the dice line: how the body moves her checks right now
    const mod = dcMod(name);
    const head = `<div class="rbd-head"><span class="rbd-day">☀ ${esc(t('day_n', { n: s.day }))}${s.part ? ` · ${esc(partWord(s.part))}` : ''}</span>${settings.dice ? `<span class="rbd-mod ${mod > 0 ? 'bad' : mod < 0 ? 'good' : ''}" title="${esc(t('dice_title'))}">🎲 ${esc(t('dice_mod'))} ${mod > 0 ? '+' : ''}${mod}</span>` : ''}</div>`;
    h += head;
    if (settings.needs) {
        const nd = needsOf(name);
        const ms = (nd.sat ? meter('🍞', t('sat'), c.sat, 'sat') : '') + (nd.eng ? meter('🌙', t('eng'), c.eng, 'eng') : '') + (nd.hyg ? meter('🧼', t('hyg'), c.hyg, 'hyg') : '')
            + nd.own.map(o => meter(o.icon || '✦', o.name, ownVal(c, o), 'own')).join('');
        if (ms) h += `<div class="rbd-needs">${ms}</div>`;
    }
    // the cycle
    if (settings.cycle && tr.sex === 'f') {
        const ci = cycleInfo(name);
        if (!ci) h += `<div class="rbd-cycle off">🌸 ${esc(t('no_cycle'))}</div>`;
        else if (ci.preg) {
            const txt = ci.known ? t('pregnant', { w: ci.weeks }) : ci.late >= 1 ? t('late', { n: ci.late }) : null;
            if (txt && ci.known) {
                // the weeks as a bar to term, the trimester, what it feels like, and when
                const pct = clamp(Math.round(ci.gd / ci.due * 100), 0, 100);
                h += `<div class="rbd-cycle preg rbd-preg"><span class="rbd-preg-t">🌸 <b>${esc(txt)}</b> · ${esc(t('trim' + ci.trim))}</span>
                    <span class="rbd-preg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
                    <span class="rbd-preg-s">${ci.weeks >= 5 ? esc(t('sym' + ci.trim)) + ' · ' : ''}${esc(ci.term ? t('due_now') : t('due_in', { n: ci.dueIn }))}</span></div>`;
            } else if (txt) h += `<div class="rbd-cycle preg">🌸 <b>${esc(txt)}</b></div>`;
            else h += `<div class="rbd-cycle">🌸 <b>${esc(t('ph_luteal'))}</b></div>`;   // nothing to see yet
        } else {
            const ring = Math.round(ci.cd / ci.len * 100);
            h += `<div class="rbd-cycle ph-${ci.phase}"><span class="rbd-ring" style="--p:${ring}"><i>${ci.cd}</i></span><span class="rbd-cyc-t"><b>${esc(t('ph_' + ci.phase))}</b> · ${esc(t('cycle_day', { d: ci.cd, n: ci.len }))}${ci.phase === 'period' ? ` · ${esc(t('pain' + (ci.pain || 0)))}` : ''}</span></div>`;
        }
    }
    // today's states
    const sb = stateBits(c);
    if (sb.length) {
        const ICON = { hangover: '🍺', sleepless: '😵', rush: '⚡', crash: '🫠', baby: '🍼' };
        h += `<div class="rbd-states">${sb.map(k => `<span class="rbd-state st-${k}">${ICON[k]} ${esc(t('st_' + k))}</span>`).join('')}</div>`;
    }
    // ailments
    if (settings.ailments) {
        h += `<div class="rbd-sect">${esc(t('ailments'))}</div>`;
        h += c.ailments.length
            ? `<div class="rbd-ails">${c.ailments.map(a => `<span class="rbd-ail" data-id="${esc(a.id)}">${a.from === 'dice' ? '🎲' : '🤒'} ${esc(a.name)}${Number.isFinite(a.days) ? ` <i>${esc(t('days', { n: a.days }))}</i>` : ''}<b class="rbd-x" title="${esc(t('remove'))}" role="button" tabindex="0">✕</b></span>`).join('')}</div>`
            : `<div class="rbd-quiet">${esc(t('none'))}</div>`;
    }
    // pockets
    if (settings.slots) {
        const cap = slotCap();
        let cells = '';
        for (let i = 0; i < cap; i++) {
            const sl = c.slots[i];
            cells += sl
                ? `<button type="button" class="rbd-slot full" data-id="${esc(sl.id)}" title="${esc(sl.name + (sl.desc ? ' — ' + sl.desc : ''))}"><span>${esc(sl.name)}</span></button>`
                : `<button type="button" class="rbd-slot" data-empty="1" title="${esc(t('give_me'))}"><span>＋</span></button>`;
        }
        h += `<div class="rbd-sect">${esc(t('pockets'))}</div><div class="rbd-slots">${cells}</div><div class="rbd-pop" hidden></div>`;
    }
    h += birthStrip(name) + kidsHtml(name);
    // the fixed traits, behind a fold
    const opt = (v, cur, lbl) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${esc(lbl)}</option>`;
    const ci2 = cycleInfo(name);
    h += `<details class="rbd-more"${moreOpen.has(keyOf(name)) ? ' open' : ''}><summary>⚙ ${esc(t('more'))}</summary>
        <label>${esc(t('sex'))} <select class="rbd-f" data-f="sex">${opt('f', tr.sex, t('sex_f'))}${opt('m', tr.sex, t('sex_m'))}${opt('x', tr.sex, t('sex_x'))}</select></label>
        ${tr.sex === 'f' ? `
        <label><input type="checkbox" class="rbd-f" data-f="cycle"${tr.cycle ? ' checked' : ''}> ${esc(t('has_cycle'))}</label>
        <label><input type="checkbox" class="rbd-f" data-f="fertile"${tr.fertile ? ' checked' : ''}> ${esc(t('fertile'))} <i>(${esc(t('fert_roll', { r: tr.rolls ? tr.rolls.fert : '—' }))})</i></label>
        <label>${esc(t('len'))} <input type="number" class="rbd-f" data-f="len" min="21" max="40" value="${tr.len}"></label>
        <label>${esc(t('period_len'))} <input type="number" class="rbd-f" data-f="period" min="2" max="9" value="${tr.period}"></label>
        <label>${esc(t('pain'))} <select class="rbd-f" data-f="pain">${[0, 1, 2, 3].map(p => opt(p, tr.pain, t('pain' + p))).join('')}</select></label>
        <label><input type="checkbox" class="rbd-f" data-f="pill"${tr.pill ? ' checked' : ''}> ${esc(t('pill'))}</label>
        ${c.preg ? `<button type="button" class="rbd-reroll rbd-pregend">${esc(t('preg_end'))}</button>` : ''}
        ${ci2 && !ci2.preg ? `<label>${esc(t('set_day'))} <input type="number" class="rbd-f" data-f="day" min="1" max="${ci2.len}" value="${ci2.cd}"></label>` : ''}` : ''}
        ${settings.needs ? needsEditHtml(name) : ''}
        <button type="button" class="rbd-reroll">🎲 ${esc(t('reroll'))}</button>
        ${c.log.length ? `<div class="rbd-log">${c.log.slice(-4).map(l => `<div>${esc(l.text)}</div>`).join('')}</div>` : ''}
    </details>`;
    return `<div class="rbd" data-who="${esc(name)}">${h}</div>`;
}
function partWord(p) {
    const W = { en: { morning: 'morning', day: 'day', evening: 'evening', night: 'night' }, ru: { morning: 'утро', day: 'день', evening: 'вечер', night: 'ночь' } };
    return (W[lang()] || W.en)[p] || p;
}
function bindPane(pane, name, container) {
    const repaint = () => { saveChat(); updateInjection(); refresh(); };
    pane.querySelectorAll('.rbd-chip').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); pick[container.getAttribute('data-mesid')] = el.getAttribute('data-who'); paint(container, true); }));
    pane.querySelectorAll('.rbd-ail .rbd-x').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        const c = charOf(name); const id = el.closest('.rbd-ail').getAttribute('data-id');
        c.ailments = c.ailments.filter(a => a.id !== id); repaint();
    }));
    const pop = pane.querySelector('.rbd-pop');
    const showPop = (html, anchor) => { if (!pop) return; pop.innerHTML = html; pop.hidden = false; pop.style.setProperty('--x', `${anchor.offsetLeft}px`); };
    pane.querySelectorAll('.rbd-slot').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        if (pop && !pop.hidden && pop.dataset.for === (el.dataset.id || 'new')) { pop.hidden = true; return; }
        if (pop) pop.dataset.for = el.dataset.id || 'new';
        if (el.dataset.empty) {
            const v = inv();
            if (!v) return showPop(`<div class="rbd-pop-note">${esc(t('no_backpack'))}</div>`, el);
            const items = v.list() || [];
            if (!items.length) return showPop(`<div class="rbd-pop-note">${esc(t('backpack_empty'))}</div>`, el);
            showPop(`<div class="rbd-pop-h">${esc(t('give_me'))}</div>` + items.slice(0, 30).map(i => `<button type="button" class="rbd-pop-i" data-item="${esc(i.id)}">${esc(i.name)}</button>`).join(''), el);
            pop.querySelectorAll('.rbd-pop-i').forEach(b => b.addEventListener('click', ev => {
                ev.stopPropagation();
                // a full pocket is said before anything leaves the backpack, so nothing is lost
                if (charOf(name).slots.length >= slotCap()) { toastr.info(t('full', { name })); return; }
                const it = v.remove(b.getAttribute('data-item'));
                if (it) takeFromPlayer(name, it);
            }));
        } else {
            showPop(`<button type="button" class="rbd-pop-i" data-a="back">↩ ${esc(t('take_back'))}</button><button type="button" class="rbd-pop-i" data-a="drop">✕ ${esc(t('drop'))}</button>`, el);
            pop.querySelectorAll('.rbd-pop-i').forEach(b => b.addEventListener('click', ev => {
                ev.stopPropagation();
                if (b.dataset.a === 'back') giveToPlayer(name, el.dataset.id);
                else { const c = charOf(name); c.slots = c.slots.filter(sl => sl.id !== el.dataset.id); repaint(); }
            }));
        }
    }));
    pane.querySelectorAll('.rbd-f').forEach(el => el.addEventListener('change', e => {
        e.stopPropagation();
        const tr = traitsOf(name), f = el.dataset.f;
        if (f === 'cycle' || f === 'fertile' || f === 'pill') tr[f] = el.checked;
        else if (f === 'sex') { tr.sex = el.value; tr.cycle = el.value === 'f' ? tr.cycle !== false : false; }
        else if (f === 'len') tr.len = clamp(parseInt(el.value, 10) || 28, 21, 40);
        else if (f === 'period') tr.period = clamp(parseInt(el.value, 10) || 5, 2, 9);
        else if (f === 'pain') tr.pain = clamp(parseInt(el.value, 10) || 0, 0, 3);
        else if (f === 'day') { const c = charOf(name), s = chatState(); c.cycleStart = s.day - (clamp(parseInt(el.value, 10) || 1, 1, 40) - 1); saveChat(); }
        saveSettings(); repaint();
    }));
    const more = pane.querySelector('.rbd-more');
    if (more) more.addEventListener('toggle', () => { if (more.open) moreOpen.add(keyOf(name)); else moreOpen.delete(keyOf(name)); });
    pane.querySelectorAll('.rbd-more, .rbd-more *').forEach(el => el.addEventListener('click', e => e.stopPropagation()));
    const pe = pane.querySelector('.rbd-pregend');
    if (pe) pe.addEventListener('click', e => { e.stopPropagation(); endPregnancy(charOf(name)); repaint(); });
    const rr = pane.querySelector('.rbd-reroll:not(.rbd-pregend)');
    if (rr) rr.addEventListener('click', e => { e.stopPropagation(); settings.traits[keyOf(name)] = rollTraits(name); saveSettings(); repaint(); });
    // the needs this character has
    pane.querySelectorAll('.rbd-nd').forEach(el => el.addEventListener('change', () => { needsOf(name)[el.dataset.nd] = el.checked; saveSettings(); repaint(); }));
    pane.querySelectorAll('.rbd-nd-own').forEach(row => {
        const id = row.dataset.own;
        row.querySelector('.rbd-nd-rate').addEventListener('change', e => { const o = needsOf(name).own.find(x => x.id === id); if (o) { o.rate = e.target.value; saveSettings(); } });
        row.querySelector('.rbd-nd-x').addEventListener('click', () => {
            const nd = needsOf(name); nd.own = nd.own.filter(x => x.id !== id);
            const c = charOf(name, false); if (c) delete c.own[id];
            saveSettings(); repaint();
        });
    });
    const plus = pane.querySelector('.rbd-nd-plus');
    if (plus) {
        const add = () => {
            const nm = pane.querySelector('.rbd-nd-name').value.trim().slice(0, 24);
            if (!nm) { pane.querySelector('.rbd-nd-name').focus(); return; }
            const nd = needsOf(name);
            if (nd.own.some(x => keyOf(x.name) === keyOf(nm)) || nd.own.length >= 4) return;
            nd.own.push({ id: genId(), name: nm, icon: pane.querySelector('.rbd-nd-icon').value.trim().slice(0, 4) || '✦', rate: pane.querySelector('.rbd-nd-newrate').value });
            saveSettings(); repaint();
        };
        plus.addEventListener('click', add);
        pane.querySelector('.rbd-nd-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    }
    // the folded clipping opens again
    const strip = pane.querySelector('.rbd-strip');
    if (strip) strip.addEventListener('click', e => { e.stopPropagation(); showBirth(); });
    // the children
    pane.querySelectorAll('.rbd-kid').forEach(card => {
        const id = card.dataset.kid;
        const kid = () => (chatState().children || []).find(x => x.id === id);
        card.addEventListener('click', e => e.stopPropagation());
        const ren = card.querySelector('.rbd-kid-ren');
        ren.addEventListener('click', () => {
            const b = card.querySelector('.rbd-kid-name');
            const inp = document.createElement('input');
            inp.type = 'text'; inp.className = 'text_pole rbd-kid-name-in'; inp.maxLength = 40; inp.value = (kid() || {}).name || '';
            b.replaceWith(inp); inp.focus();
            let done = false;
            const commit = keep => { if (done) return; done = true; const k = kid(); if (k && keep) k.name = inp.value.trim().slice(0, 40); repaint(); };
            inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') commit(true); if (ev.key === 'Escape') commit(false); });
            inp.addEventListener('blur', () => commit(true));
        });
        const sel = card.querySelector('.rbd-kid-carep'), other = card.querySelector('.rbd-kid-care-other');
        sel.addEventListener('change', () => {
            if (sel.value === '__other') { other.hidden = false; other.focus(); return; }
            const k = kid(); if (k) { k.care = sel.value; repaint(); }
        });
        const saveOther = () => { const k = kid(); const v = other.value.trim().slice(0, 60); if (k && v) { k.care = v; repaint(); } };
        other.addEventListener('keydown', ev => { if (ev.key === 'Enter') saveOther(); });
        other.addEventListener('change', saveOther);
        card.querySelector('.rbd-kid-d').addEventListener('click', () => describeChild(id, false));
        card.querySelector('.rbd-kid-c').addEventListener('click', () => createCard(id));
        const del = card.querySelector('.rbd-kid-x');
        // two clicks, no browser dialog: the first asks, the second removes
        del.addEventListener('click', () => {
            if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '✕ ' + t('kid_del_sure'); setTimeout(() => { if (del.isConnected) { del.dataset.sure = ''; del.textContent = '✕ ' + t('kid_del'); } }, 3000); return; }
            const s = chatState(); s.children = s.children.filter(x => x.id !== id); repaint();
        });
    });
}
// draw the pane of one block — only when it is on screen, like the relationship page
function paneVisible(container) {
    const wrap = container.querySelector('.rpg-accordion-wrapper');
    const pane = container.querySelector('.rpg-pane-body');
    return !!(wrap && wrap.classList.contains('expanded') && pane && pane.classList.contains('active'));
}
function paint(container, force) {
    const pane = container.querySelector('.rpg-pane-body');
    if (!pane) return;
    if (!force && !paneVisible(container)) { pane.setAttribute('data-stale', '1'); return; }
    const blockChar = container.getAttribute('data-char') || '';
    let name = blockChar;
    if (isWorldName(blockChar)) {
        const list = cast();
        name = pick[container.getAttribute('data-mesid')] && list.includes(pick[container.getAttribute('data-mesid')]) ? pick[container.getAttribute('data-mesid')] : list[0];
        if (!name) { pane.innerHTML = `<div class="rpg-bonds-note">${esc(t('nobody'))}</div>`; return; }
    }
    pane.removeAttribute('data-stale');
    pane.innerHTML = paneHtml(name, blockChar);
    bindPane(pane, name, container);
}
function paintIfNeeded(container) {
    const pane = container.querySelector('.rpg-pane-body');
    if (!pane || !paneVisible(container)) return;
    if (pane.getAttribute('data-stale') === '1' || !pane.innerHTML.trim()) paint(container, true);
}
let refreshTimer = null;
function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        document.querySelectorAll('.rpg-inline-container').forEach(c => {
            const pane = c.querySelector('.rpg-pane-body');
            if (pane) pane.setAttribute('data-stale', '1');
            if (paneVisible(c)) paint(c, true);
        });
    }, 80);
}

/* ---------------- settings pane: frames, an emoji each ---------------- */
function settingsHtml() {
    const sub = (title, body) => `<div class="rpg-sub"><div class="rpg-subhead">${title}</div>${body}</div>`;
    const chk = (id, label) => `<label class="checkbox_label"><input type="checkbox" id="${id}"> <span>${esc(label)}</span></label>`;
    const num = (id, label, attrs) => `<div class="rpg-srow"><label for="${id}">${esc(label)}</label><input type="number" id="${id}" class="text_pole" ${attrs}></div>`;
    return `
        <div class="rpg-top">${chk('rbd-enabled', t('s_enable'))}
            <select id="rbd-lang" class="text_pole" title="${esc(t('s_lang'))}" aria-label="${esc(t('s_lang'))}">
                <option value="">${esc(t('s_lang_follow'))}</option><option value="en">English</option><option value="ru">Русский</option>
            </select></div>
        <div class="rpg-hint">${esc(t('s_hint'))}</div>
        ${sub(`🍞 ${esc(t('s_needs_h'))}`, `${chk('rbd-needs', t('s_needs'))}<div class="rpg-in">${num('rbd-speed', t('s_speed'), 'min="25" max="300" step="5"')}${num('rbd-partevery', t('s_partEvery'), 'min="2" max="60"')}</div>`)}
        ${sub(`🌸 ${esc(t('s_cycle_h'))}`, `${chk('rbd-cycle', t('s_cycle'))}<div class="rpg-in">${chk('rbd-preg', t('s_preg'))}<div class="rpg-in">${chk('rbd-hide', t('s_hide'))}</div></div>`)}
        ${sub(`👶 ${esc(t('s_birth_h'))}`, `${chk('rbd-birth', t('s_birth'))}<div class="rpg-in">
            <div class="rpg-srow"><label for="rbd-pregspeed">${esc(t('s_pregspeed'))}</label><select id="rbd-pregspeed" class="text_pole"><option value="1">${esc(t('sp1'))}</option><option value="7">${esc(t('sp7'))}</option><option value="30">${esc(t('sp30'))}</option></select></div>
            ${chk('rbd-childdesc', t('s_childdesc'))}${chk('rbd-babynights', t('s_babynights'))}</div>`)}
        ${sub(`🤒 ${esc(t('s_ail_h'))}`, `${chk('rbd-ail', t('s_ail'))}<div class="rpg-in">${num('rbd-ailchance', t('s_ailChance'), 'min="0" max="50"')}</div>`)}
        ${sub(`🎒 ${esc(t('s_slots_h'))}`, `${chk('rbd-slots', t('s_slots'))}<div class="rpg-in">${num('rbd-slotcount', t('s_slotCount'), 'min="1" max="8"')}${chk('rbd-itemsself', t('s_items'))}</div>`)}
        ${sub(`🍺 ${esc(t('s_nights_h'))}`, `${chk('rbd-nights', t('s_nights'))}${chk('rbd-adren', t('s_adren'))}`)}
        ${sub(`🎲 ${esc(t('s_dice_h'))}`, chk('rbd-dice', t('s_dice')))}
        ${sub(`🪄 ${esc(t('s_inj_h'))}`, `${chk('rbd-inject', t('s_inj'))}<div class="rpg-in">${num('rbd-depth', t('s_depth'), 'min="0" max="20"')}</div>`)}`;
}
function mountSettings() {
    const $pane = $('#rpg-tab-pane-body');
    if (!$pane.length) return;
    $pane.html(settingsHtml());
    const after = () => { saveSettings(); updateInjection(); refresh(); if (window.RPGSB_SYNC_ALL) window.RPGSB_SYNC_ALL(); };
    const bindC = (id, k) => $('#' + id).prop('checked', !!settings[k]).on('change', function () { settings[k] = this.checked; after(); });
    const bindN = (id, k, lo, hi) => $('#' + id).val(settings[k]).on('change', function () { settings[k] = clamp(parseInt(this.value, 10) || defaultSettings[k], lo, hi); this.value = settings[k]; after(); });
    $('#rbd-lang').val(settings.language || '').on('change', function () { settings.language = this.value === 'ru' || this.value === 'en' ? this.value : ''; saveSettings(); mountSettings(); updateInjection(); refresh(); });
    bindC('rbd-enabled', 'enabled'); bindC('rbd-needs', 'needs'); bindC('rbd-cycle', 'cycle'); bindC('rbd-preg', 'pregnancy'); bindC('rbd-hide', 'hidePregnancy');
    bindC('rbd-ail', 'ailments'); bindC('rbd-slots', 'slots'); bindC('rbd-dice', 'dice'); bindC('rbd-inject', 'inject');
    bindC('rbd-itemsself', 'itemsSelf'); bindC('rbd-nights', 'nights'); bindC('rbd-adren', 'adrenaline');
    bindC('rbd-birth', 'birth'); bindC('rbd-childdesc', 'childDesc'); bindC('rbd-babynights', 'babyNights');
    $('#rbd-pregspeed').val(String(pregSpeed())).on('change', function () {
        // what has passed stays counted at the old speed; RPG Vitals counts the player's own up to today too
        syncDays();
        try { window.dispatchEvent(new CustomEvent('rpg:preg-speed', { detail: { from: pregSpeed() } })); } catch (e) { /* nobody listens */ }
        settings.pregSpeed = [1, 7, 30].includes(+this.value) ? +this.value : 1; saveChat(); after();
    });
    bindN('rbd-speed', 'needsSpeed', 25, 300); bindN('rbd-partevery', 'partEvery', 2, 60); bindN('rbd-ailchance', 'ailmentChance', 0, 50);
    bindN('rbd-slotcount', 'slotCount', 1, 8); bindN('rbd-depth', 'injectDepth', 0, 20);
}

/* ---------------- wiring ---------------- */
function init() {
    loadSettings();
    window.addEventListener('rpg:scene-updated', () => setTimeout(onScene, 0));
    window.addEventListener('rpg:intimacy', e => onIntimacy(e && e.detail));
}

/* ---------------- the bridge: the RPG Engine's backpack hands things over through it ---------------- */
window.RPG = window.RPG || {};
window.RPG.body = {
    available: true,
    isEnabled: () => on() && !!settings.slots,
    cast: () => (on() ? cast() : []),
    give: (name, item) => (on() && settings.slots && item ? takeFromPlayer(name, item) : false),
    slots: (name) => { const c = on() ? charOf(name, false) : null; return c ? c.slots.map(s => ({ id: s.id, name: s.name, desc: s.desc })) : []; },
    takeBack: (name, slotId) => (on() ? giveToPlayer(name, slotId) : false),
    // a night's condom, used once whoever asks first (RPG Vitals asks for the player's side)
    useCondom: (detail, name) => (detail ? useCondom(detail, name) : false),
    dcMod: (name) => dcMod(name),
    cycle: (name) => { const ci = on() ? cycleInfo(name) : null; return ci ? Object.assign({}, ci) : null; },
    // birth and children — RPG Vitals reads the speed, and hands over the player's own birth at term
    pregSpeed: () => pregSpeed(),
    labor: (o) => {
        if (!on() || !settings.birth || !o) return false;
        const s = chatState(); if (!s) return false;
        if (s.birth) return s.birth.key === PLAYER_KEY;    // already waiting (another birth waits first)
        return startLabor({ key: PLAYER_KEY, mother: o.mother || userName(), father: o.father || '', player: true, weeks: o.weeks });
    },
    // the player's pregnancy ended in the story while the birth was waiting: that was the birth
    born: () => { const s = on() ? chatState() : null; return s && s.birth && s.birth.key === PLAYER_KEY ? !!deliver({ played: true }) : false; },
    cancelLabor: () => { const s = on() ? chatState() : null; if (s && s.birth && s.birth.key === PLAYER_KEY) { s.birth = null; closeBirth(); saveChat(); updateInjection(); refresh(); } },
    laborPending: () => { const s = on() ? chatState() : null; return !!(s && s.birth && s.birth.key === PLAYER_KEY); },
    babyNights: (name) => babyNights(name),
    children: () => { const s = on() ? chatState() : null; return s ? s.children.map(ch => ({ id: ch.id, name: ch.name, sex: ch.sex, mother: ch.mother, father: ch.father, age: ageText(ageDays(ch, chatState())), stage: ageStage(ageDays(ch, chatState())), care: ch.care })) : []; }
};

// one character in and out of a file: the fixed traits, and this chat's state told relative to its day
function exportChar(name) {
    const k = keyOf(name);
    const tr = settings.traits[k];
    const c = charOf(name, false);
    if (!tr && !c) return null;
    const s = chatState();
    const out = { traits: tr ? JSON.parse(JSON.stringify(tr)) : null };
    if (c && s) {
        const ci = cycleInfo(name);
        out.state = {
            sat: c.sat, eng: c.eng, hyg: c.hyg, own: Object.assign({}, c.own),
            ailments: JSON.parse(JSON.stringify(c.ailments)),
            slots: c.slots.map(sl => ({ name: sl.name, desc: sl.desc, from: sl.from, item: sl.item || null })),
            cycleDay: ci && !ci.preg ? ci.cd : null,
            pregDays: c.preg ? gestDays(c.preg, s) : null,
            pregFather: c.preg ? c.preg.father || null : null
        };
    }
    return out;
}
function importChar(name, data) {
    if (!data || typeof data !== 'object') return false;
    const k = keyOf(name);
    if (data.traits && typeof data.traits === 'object') { settings.traits[k] = Object.assign({}, data.traits, { name }); saveSettings(); }
    const st = data.state;
    const s = chatState();
    if (st && s) {
        const c = charOf(name);
        ['sat', 'eng', 'hyg'].forEach(f => { if (Number.isFinite(+st[f])) c[f] = clamp(Math.round(+st[f]), 0, 100); });
        // a file from before: food and water averaged into the one satiety
        if (Number.isFinite(+st.hyd) && Number.isFinite(+st.sat)) c.sat = clamp(Math.round((+st.sat + +st.hyd) / 2), 0, 100);
        if (st.own && typeof st.own === 'object') Object.keys(st.own).forEach(id => { if (Number.isFinite(+st.own[id])) c.own[id] = clamp(Math.round(+st.own[id]), 0, 100); });
        if (Array.isArray(st.ailments)) c.ailments = st.ailments.filter(a => a && a.name).slice(0, 8).map(a => ({ id: genId(), name: String(a.name).slice(0, 40), days: Number.isFinite(+a.days) ? +a.days : 2, from: a.from === 'dice' ? 'dice' : 'story' }));
        if (Array.isArray(st.slots)) c.slots = st.slots.filter(x => x && x.name).slice(0, slotCap()).map(x => ({ id: genId(), name: String(x.name).slice(0, 60), desc: String(x.desc || '').slice(0, 200), from: x.from || 'own', item: x.item || null }));
        if (Number.isFinite(+st.cycleDay)) c.cycleStart = s.day - (clamp(+st.cycleDay, 1, 40) - 1);
        c.preg = st.pregDays !== null && st.pregDays !== undefined && Number.isFinite(+st.pregDays)
            ? { day: s.day - Math.max(0, +st.pregDays), gd: Math.max(0, +st.pregDays), gdDay: s.day, roll: null, chance: null, father: st.pregFather ? String(st.pregFather).slice(0, 60) : userName() }
            : null;
        saveChat();
    }
    updateInjection(); refresh();
    return true;
}

return {
    exportChar, importChar,
    settings: () => settings, init, on, mountSettings, paint, paintIfNeeded, refresh, onReply, onScene,
    fromStatus, statusAsk, dcMod, updateInjection, isWorldName, t, onChat,
    hasPane: (charName) => on() && (!isWorldName(charName) || cast().length > 0)
};
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

const HOST_TABS = ['status', 'bonds', 'body'];
let activeInlineTab = 'status';          // remembered across redraws, per session

function hostLang() {
    // The two engines each have their own language switch. The block follows the
    // Status Bar's, because the block is the Status Bar's object.
    return SB.settings().language === 'ru' ? 'ru' : 'en';
}
function hostT(key) {
    const D = {
        en: { tab_status: 'Status', tab_bonds: 'Relationship', tab_body: 'Character', bonds_off: 'The relationship engine is switched off.', bonds_none: 'No relationship page for this character yet.', toggle: 'Show / hide' },
        ru: { tab_status: 'Статус', tab_bonds: 'Отношения', tab_body: 'Персонаж', bonds_off: 'Движок отношений выключен.', bonds_none: 'На этого персонажа страница отношений ещё не заведена.', toggle: 'Показать / скрыть' }
    };
    return (D[hostLang()] || D.en)[key] || key;
}

function hostEscape(x) {
    return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sbOn() { return !!SB.settings().enabled; }
function bondsOn() { return !!TBE.settings().enabled; }
function bodyOn() { try { return BODY.on(); } catch (e) { return false; } }
const bodyTicked = new Set();

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
                        <span class="rpg-tab" data-tab="body"><i class="fa-solid fa-person"></i> ${hostEscape(hostT('tab_body'))}</span>
                    </div>
                    <div class="rpg-pane rpg-pane-status"></div>
                    <div class="rpg-pane rpg-pane-bonds"></div>
                    <div class="rpg-pane rpg-pane-body"></div>
                </div>
            </div>
        </div>`;
    mesText.insertAdjacentElement('afterend', container);

    const header = container.querySelector('.rpg-inline-header');
    const wrapper = container.querySelector('.rpg-accordion-wrapper');
    header.addEventListener('click', () => {
        header.classList.toggle('expanded');
        wrapper.classList.toggle('expanded');
        // the status bars of a folded block are written in now, when it opens
        if (wrapper.classList.contains('expanded') && typeof container.__sbPaint === 'function') container.__sbPaint();
        paintIfNeeded(container);
        try { BODY.paintIfNeeded(container); } catch (e) { console.error('[Character] paint failed:', e); }
    });

    container.querySelectorAll('.rpg-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            activeInlineTab = tab.getAttribute('data-tab');
            document.querySelectorAll('.rpg-inline-container').forEach(c => { syncTabs(c); paintIfNeeded(c); try { BODY.paintIfNeeded(c); } catch (e) { /* drawn next time */ } });
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
    if (key === 'body') { try { return BODY.hasPane(container.getAttribute('data-char') || ''); } catch (e) { return false; } }
    const pane = container.querySelector('.rpg-pane-status');
    if (!pane) return false;
    if (pane.getAttribute('data-empty') === '1') return false;
    if (pane.getAttribute('data-has') === '1') return true;     // bars waiting to be written when it opens
    return pane.innerHTML.trim().length > 0;
}

function syncTabs(container) {
    const avail = HOST_TABS.filter(k => (k === 'status' ? sbOn() : k === 'bonds' ? bondsOn() : bodyOn()) && paneHasContent(container, k));
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
        const k = p.classList.contains('rpg-pane-status') ? 'status' : p.classList.contains('rpg-pane-body') ? 'body' : 'bonds';
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
// the Character tab switched on or off: the tab rows follow, and blocks appear where there were none
window.RPGSB_SYNC_ALL = function () { document.querySelectorAll('.rpg-inline-container').forEach(c => { syncTabs(c); try { BODY.paintIfNeeded(c); } catch (e) { /* later */ } }); scheduleMount(); };

/* ------------------------------------------------------------
   MOUNTING
   The Status Bar mounts a block for every message it has a snapshot for. That is
   not enough on its own any more: with the Status Bar off and relationships on,
   nothing would ever create a block. So the host also mounts one on the character
   messages of the current chat.
   ------------------------------------------------------------ */
function mountAll() {
    if (!sbOn() && !bondsOn() && !bodyOn()) return;
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
                <div class="rpg-settings-tab" data-tab="body"><i class="fa-solid fa-person"></i> ${hostEscape(hostT('tab_body'))}</div>
            </div>
            <div id="rpg-tab-pane-status" class="rpg-settings-pane active"></div>
            <div id="rpg-tab-pane-bonds" class="rpg-settings-pane"></div>
            <div id="rpg-tab-pane-body" class="rpg-settings-pane"></div>
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
    try { BODY.mountSettings(); } catch (e) { console.error('[Character] settings failed:', e); }
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

    try { BODY.init(); } catch (e) { console.error('[Character] settings load failed:', e); }

    // one drawer, three tabs — fills every pane
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

        setTimeout(() => { try { BODY.onChat(); } catch (e) { console.warn('[Character] chat switch', e); } }, 150);

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

    // who is in the scene changes with each reply and with the Scene Card: the status note follows
    window.addEventListener('rpg:scene-updated', () => { try { SB.updateContextInjection(); } catch (e) { /* next reply */ } });
    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
        try { SB.updateContextInjection(); } catch (e) { console.warn('[RPG Status Bar] note', e); }
        // Bonds first: it is what registers whoever just spoke, so the relationship
        // tab has a page to draw by the time the block is mounted.
        try { TBE.onCharacterReply(); } catch (e) { console.error('[Bonds] reply failed:', e); }
        // the Character tab's clock: one more reply (the Scene Card's own clock, when there, moves it instead)
        // (once per message: a swipe or a regeneration fires this again for the same one)
        try { const m0 = getContext().chat[messageId]; const k0 = `${getContext().chatId}#${messageId}`; if (m0 && !m0.is_user && !m0.is_system && !bodyTicked.has(k0)) { bodyTicked.add(k0); BODY.onReply(m0.name); } } catch (e) { console.error('[Character] reply failed:', e); }
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
