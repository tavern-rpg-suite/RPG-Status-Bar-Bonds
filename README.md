# RPG-Status Bar+Bonds

A SillyTavern extension that gives your characters a **living status bar** — health, mana, stamina, mood, trust, attraction, relationships, and more.

The status is updated from the story and shown directly under character messages. Different systems can work independently or together, so you can use RPG stats, relationship tracking, or both.

**Version 2.0.0**

## ✨ Features

### 📊 RPG Stats

<img width="673" height="336" alt="Screenshot_16" src="https://github.com/user-attachments/assets/cc64cd51-55b7-4e6b-9756-a15ef2fd1996" />

- 📊 **Inline stat bars** under character messages, in a smooth collapsible accordion.
- 🎯 **Custom stats** — create any stats you want with custom names, colors and descriptions.
- 🧙 **Presets** — Fantasy, Survival, Romance, or your own.
- ✨ **AI stat designer** — reads the character card and creates four fitting stats automatically.
- 🤖 **AI-updated** — a GM-style model updates values from the recent story every N messages or on demand.
- 🎨 **Trends & critical states** — animated bars, trend arrows and critical-state warnings.
- 🧠 **Context injection** — a short state summary can be injected into the prompt so the model knows the character's current condition.
- 🗂️ **Per-character or per-chat** — keep persistent stats or give each chat its own state.
- 👥 **Group chats** — every speaking character gets their own status.
- 💾 **Export / import** character profiles.

### 💞 Tavern Bonds

<img width="679" height="523" alt="Screenshot_15" src="https://github.com/user-attachments/assets/3af61e61-b4e3-4940-bc67-510e0d81d7ae" />

A relationship system that makes characters **remember how they feel about you and act accordingly**.

- 🎲 **Dice-based interactions** — flirting, apologies, boundary-pushing and other actions are resolved before the model writes, based on the character's personality and your current relationship.
- 🧠 **Personality matters** — each character gets an archetype and eight fixed personality traits. Their personality doesn't magically change just because the story does.
- 📈 **Five long-term feelings + three short-term moods** — trust, comfort, attraction, respect, affection, plus mood, arousal and excitement.
- 🚪 **Relationship stages must be earned** — Stranger → Acquaintance → Friend → Close Friend → Crush → Dating → Partner → Wife/Husband.
- 💌 **Character initiative** — characters can take the first step themselves: start conversations, flirt, invite you somewhere, give gifts, ask you out, or otherwise act on their feelings without waiting for the player to initiate everything.
- 🌹 **Courtship** — relationships can develop through gradual mutual attention and romantic initiative instead of jumping straight from friendship to dating.
- 💔 **Consequences that persist** — serious failures can cause lasting offence and make future interactions harder until the relationship is properly repaired.
- 🗒️ **Negative memories** — the worst thing you've done can remain attached to the relationship and influence future interactions.
- 🧱 **Relationship ceilings** — some characters simply won't reach certain stages depending on their personality.

### 🧠 Built for LLMs

The relationship system does **not** dump tables of numbers into the prompt.

The extension handles the calculations itself and gives the model a short description of what is already true — for example, that someone is wary, comfortable, attracted, or upset.

The model doesn't decide whether you succeeded. **The state is calculated first, then the model writes the consequences.**

## 📦 Install

Copy the `RPG Status Bar` folder into:

```text
SillyTavern/data/<user>/extensions/
```

Reload SillyTavern and enable it in **Extensions → RPG Status Bar**.

## ⚙️ Setup

1. Enable **RPG Status Bar+Bonds**.
2. Choose the interface language.
3. Configure the API URL, key and model. Any OpenAI-compatible endpoint should work.
4. Choose how often stats should update and whether to inject their summary.
5. Configure your stats or use the AI stat designer.
6. Enable and configure **Tavern Bonds** if you want relationship tracking.

## 📊 How stat updates work

Every N character messages, the extension sends the recent story to the configured model. It returns updated 0–100 values and a short summary. Snapshots are stored per message, so scrolling back through the chat shows the state at that point.

You can choose how many recent messages the extension reads. It does not need to scan the entire conversation.

## 🗂️ Per-character vs per-chat

By default, a character's status is global and follows them between chats. Enable **Separate status for each chat** to give every chat its own independent state.

Resetting a character restores their status to a fresh baseline.

## 💾 Export / import

Export a character's full profile as JSON, including stat setup, values and summary. Profiles can be imported or moved between machines.

## 👥 Group chats

Fully supported. Each speaking character gets their own status, and the relationship state can track the members independently.

## 🌍 Languages

Bilingual UI: **English / Русский**. AI-generated summaries follow the selected interface language.

## Credits

Inspired in part by [MVU Game Maker](https://github.com/KritBlade/MVU_Game_Maker) by KritBlade, particularly its approach to persistent personality, relationship progression, and dice-based social interactions.
