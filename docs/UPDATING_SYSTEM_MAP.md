# Updating the System Map

The system map at `docs/system-map.html` is a self-contained Claude Design bundle — three views (Layered, Lifecycle, Graph), 17+ subsystems, a 4-step demo walkthrough, and a stub user-guide outline. It's static: it does **not** auto-update when the project changes. Refresh it manually on the cadence below.

## When to refresh

- A subsystem moves status (Planned → Building → Shipped → etc.)
- You add or remove a subsystem
- You want to rework the visual or add a new map variation
- Roughly: every time HANDOFF.md's "what shipped this session" section includes structural work

Do NOT refresh for every code change — only when the system-level picture changes.

## Refresh process (preferred — Claude Code does the prep)

1. Start a Claude Code session in the Forms Project folder.
2. Say: **"Generate a system map update prompt."**
3. Claude Code will:
   - Read `docs/system-map.html` and extract the current subsystem list + statuses
   - Cross-check against `CLAUDE.md`, `HANDOFF.md`, `forms.json`, and recent git commits
   - Produce a concise change summary
   - Wrap it in a ready-to-paste prompt for Claude Design
4. Copy the generated prompt.
5. Open Claude Design (claude.ai → Design / Artifacts with the System Map).
6. Paste the prompt.
7. Upload the current `docs/system-map.html` as a style reference.
8. Let Claude Design regenerate the bundle.
9. Download the new HTML, save it over `docs/system-map.html`.
10. Commit: `git add docs/system-map.html && git commit -m "Refresh system map — <summary>" && git push`.

## Fallback: write the Design prompt by hand

If Claude Code isn't available, use this template directly in Claude Design:

> I'm attaching the current version of a system map I built with you previously. Please regenerate it preserving the exact visual style, typography, and bundler output format. The only changes should be:
>
> **Subsystem status changes:**
> - [subsystem] moved from [old status] → [new status]
>
> **New subsystems:**
> - [name]: [one-sentence description], status [Shipped/Building/Planned/Future], lives in [layer]
>
> **Removed subsystems:**
> - [name]
>
> **Updated counts** (cover page + legend):
> - X subsystems · Y shipped · Z building · W planned · V future
>
> Keep the same three map variations (Layered, Lifecycle, Graph), the same User Guide outline stub, and the same demo walkthrough unless I explicitly flag changes to those. Return the full standalone HTML bundle.

## Where the map lives publicly

Once pushed, GitHub Pages serves it at:
https://davidshulman22.github.io/guardianship-forms/docs/system-map.html

(Useful for showing to Jill, Maribel, or prospective collaborators without them cloning anything.)

## File anatomy — for future you

`docs/system-map.html` is ~2MB. That weight is the three inline `<script type="__bundler/...">` blocks at the bottom containing base64'd JSX modules. Do NOT try to hand-edit the bundle — regenerate via Claude Design every time.
