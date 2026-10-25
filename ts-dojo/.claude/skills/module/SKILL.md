---
name: module
description: Writes one ts-dojo module under content/modules — its module.yaml from the §8 curriculum, then every lesson in order through the content-author agent, then a review of the whole module by the content-reviewer agent and the content lint. Use during the content waves (F11–F14) when Kim says "write module 3", "do M05", "author the generics module", or invokes /module <module-id>.
argument-hint: "[m03-unions]"
---

# Write a module

Module: `$0`, a module id such as `m03-unions`. The number is the §8 module number (`M03` → `m03`); the slug is the one already used in `content/roadmap.yaml` or, for a new module, a short noun from the §8 title (`m05-generics`, `m10-mapped-types`). An id is stable once a lesson exists under it (§7).

## Steps

1. **Read the curriculum.** docs/spec.md §8: the module's row (title, prerequisites in parentheses, tier) and its lesson table (number, title, minutes, `(opt)` marks). Read `content/roadmap.yaml` and the neighbouring modules' `module.yaml` for the ids and voice already in use. Load the `lesson` skill for the file rules.
2. **module.yaml** (spec §3):

   ```yaml
   id: m03-unions
   title: Unions and narrowing
   summary: One sentence for the roadmap card.
   prerequisites: [m02-functions]
   lessons: [01-union-and-literal-types, 02-null-undefined-strict, 03-narrowing, 04-control-flow-analysis, 05-discriminated-unions]
   ```

   `lessons` are folder names in §8 order, `NN-<slug>`. Prerequisites are module ids from the §8 parentheses. Make sure the module id is listed under its tier in `content/roadmap.yaml` (§3), in roadmap order; add it if the tier exists and the module is missing.
3. **Each lesson, in order.** Launch the `content-author` subagent (Agent tool, `subagent_type: "content-author"`) with the lesson id, the §8 row (title, minutes, `(opt)`), and the previous lesson's id so it can build on it. One lesson per launch; wait for its report; read the files it wrote; only then launch the next. Optional lessons (`(opt)` in §8) are written too, with `optional: true` in the frontmatter (pre-F13 fixes): the roadmap card and the module page tag them "optional" and module completion leaves them out, while the lesson itself completes as any lesson does. Their exercises may be `challenge: true` where the lesson says so.
4. **Review the module.** Launch `content-reviewer` (Agent tool, `subagent_type: "content-reviewer"`) with the module id. Send every FIX finding back to `content-author` for that lesson (or fix a one-line problem directly), then re-run the reviewer on the lessons that changed.
5. **Lint.** `pnpm content:lint` for the whole tree. Every line for this module must pass; a failure goes back to step 3 for that exercise.
6. **Report.** Lessons written with minutes and exercise counts, the reviewer's verdicts, the lint lines for the module, and anything for "Spec questions" in docs/progress.md (an §8 title that doesn't fit one lesson, a flag a lesson needs that the defaults forbid, a behaviour that differs in TypeScript 7).

This skill does not commit: the content wave's `/feature` session commits the whole wave.

## Rules

- §8 is the curriculum; don't add, merge or reorder lessons. A lesson that can't be written as its row says is a spec question, not a quiet change.
- Ids never change once written. A rename goes through `content/renames.yaml`, and only with Kim's OK.
- docs/spec.md is never edited.
