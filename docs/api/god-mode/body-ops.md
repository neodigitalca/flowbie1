---
title: Body operations
slug: god-mode/body-ops
section: God Mode
order: 30
---

<!-- manual -->

In-place post body edits use **`add_content`** with **`mode: ops`**. The pipeline classifies intent, plans a JSON op list, and applies deterministic HTML transforms via `Flowbie_Wp_Backend_Assist_Body_Ops`. No full-body LLM regeneration.

Plan mode shows op descriptions before Build runs them. Plan cache keeps Plan/Build parity for the same message.

## Allowed operations (14)

| Op | Purpose |
| --- | --- |
| `remove_section` | Remove one H2/H3 section by index or heading match |
| `truncate_after_table` | Keep HTML through closing `</table>`; delete everything after |
| `remove_sections_after` | Keep through anchor section; delete all following sections |
| `convert_section_to_table` | Restructure section body into table rows |
| `insert_table_in_section` | Insert new table; existing prose stays |
| `convert_list_in_section` | Swap ul/ol in section body |
| `remove_table_in_section` | Remove first table from section; prose stays |
| `replace_section_html` | Replace entire section HTML in place |
| `strip_json_ld` | Remove JSON-LD script blocks from body |
| `wrap` | Wrap phrase in strong, em, or link |
| `replace_text` | Single find/replace in body |
| `replace_heading` | Rename H2/H3 only; body copy unchanged |
| `add_internal_links` | Insert internal links (optional section scope) |
| `insert_overview_links` | Insert overview link block |

## Common routing

| User request | Typical op |
| --- | --- |
| Delete content after FAQ table | `truncate_after_table` |
| Delete everything after section X | `remove_sections_after` |
| Convert section to table | `convert_section_to_table` |
| Add/insert table in section | `insert_table_in_section` |
| Change intro H2 / rename heading | `replace_heading` |
| Add N internal links | `add_internal_links` |
| Strip schema from body | `strip_json_ld` |
| Bold/emphasize phrase | `wrap` |

Follow-up edits ("change the intro h2") use conversation history to target the section the assistant just created.

## Compound body runners

| Runner | Behavior |
| --- | --- |
| FAQ table append | Deterministic FAQ HTML table append path |
| Body schema cleanup | `strip_json_ld` on body + FAQ schema saved to ACF via `save_post_meta` |
| FAQ compound | FAQ schema (ACF) + visible FAQ table in one Build request |

## Planner constraints

- Never emit multiple `remove_section` ops for bulk tail delete; use `truncate_after_table` or `remove_sections_after`
- "Add table" → `insert_table_in_section`, not `convert_section_to_table`
- List format changes → `convert_list_in_section`, not `replace_section_html`
- Never replace or regenerate the full post body

Source: `class-flowbie-wp-backend-assist-pipeline-content-prep.php`, `class-flowbie-wp-backend-assist-body-ops.php`
