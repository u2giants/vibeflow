# Component 20: Memory, Skills, and Decision Knowledge

## 1. Purpose

This component stores project-specific intelligence that should not live in every active context window but must remain retrievable when relevant.

## 2. Responsibilities

It shall manage:
- prior fixes,
- architectural decisions,
- coding standards,
- release rules,
- fragile area notes,
- service and environment idiosyncrasies,
- reusable investigation playbooks,
- selectively invokable memory packs or "skills."

## 3. Memory pack model

A memory pack shall include:
- title,
- scope,
- tags,
- description,
- trigger conditions,
- freshness/validity notes,
- source material,
- structured facts,
- free-form notes,
- examples,
- owner/reviewer,
- revision history.

## 4. Trigger model

Memory packs should be loaded when:
- mission intent overlaps tags or trigger rules,
- affected subsystem matches,
- similar incident pattern appears,
- risky area is touched,
- operator explicitly pins a pack.

They should not be loaded constantly.

## 5. Required pack categories

- prior bug fix packs,
- architecture rule packs,
- deployment rule packs,
- auth and identity packs,
- provider-specific gotcha packs,
- style/pattern packs,
- incident postmortem packs.

## 6. Retrieval UX

The system shall show:
- why a pack was suggested,
- what it contributed,
- whether it is stale,
- who last reviewed it,
- operator option to include/exclude it.

## 7. Skill-like execution packs

Some packs may include executable guidance or structured runbooks, for example:
- "When upload failures occur, inspect storage auth, signed URLs, and file size limits."
- "When changing auth, verify redirect URLs in all environments."

These packs must be governed and versioned.

## 8. Acceptance criteria

This component is complete only when:
- memory is a first-class subsystem,
- packs can be retrieved selectively,
- prior decisions and fixes stop vanishing between sessions,
- the system can explain when prior knowledge influenced a plan or change.
