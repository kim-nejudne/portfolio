{
  "project": {
    "name": "FORME — Production System UI",
    "tone": [
      "technical-manual precision",
      "press-side job ticket",
      "dense, confident, exact",
      "no decoration beyond real print furniture"
    ],
    "non_negotiables": {
      "radius": "0 everywhere",
      "shadows": "none",
      "gradients": "none",
      "cards": "avoid card-grid SaaS patterns",
      "icons": "use simple geometric marks + rules; no emoji; no illustrative icon sets",
      "numbers": "IBM Plex Mono for every number/unit/code/dimension/timestamp/percentage/job ref/status label; tabular-nums",
      "status": "never colour alone; always colour + label + distinct mark shape"
    }
  },

  "globals_css_tokens": {
    "file": "/app/frontend/src/app/globals.css",
    "note": "This project already has a partial @theme token set. Extend it (do not replace palette/type families). Components must reference tokens (no hex literals in components).",
    "colors": {
      "substrate": {
        "paper": "--color-paper (#F4F2ED)",
        "ink": "--color-ink (#0B0B0B)"
      },
      "process_states": {
        "automated": {
          "token": "--color-cyan (#00A0D8)",
          "usage": "system-generated results: preflight, imposition, price calc, press assignment"
        },
        "action_required": {
          "token": "--color-magenta (#D6006E)",
          "usage": "human required: failed checks, proofs awaiting approval, overdue"
        },
        "held": {
          "token": "--color-yellow (#F2B705)",
          "usage": "marks + large numerals only; never body text on paper"
        },
        "final": {
          "token": "--color-ink (#0B0B0B)",
          "usage": "approved/plated/despatched; registration black"
        }
      },
      "text": {
        "muted_on_paper": "--color-muted (#6B675F)",
        "muted_on_ink": "--color-muted-ink (#8C877D)",
        "critical": "use --color-magenta + label + mark; never rely on colour alone"
      },
      "rules_and_hairlines": {
        "rule": "--color-rule (#CDC9BE) — default 1px dividers on paper",
        "rule_strong": "--color-rule-strong (#A8A49A) — table header underline / key separators",
        "rule_on_ink": "--color-rule-ink (#2B2B28) — dividers on ink ground"
      },
      "semantic_tokens_to_add": {
        "instruction": "Add these tokens to @theme so components can be semantic (avoid hardcoding cyan/magenta in components).",
        "tokens": {
          "--color-bg": "var(--color-paper)",
          "--color-fg": "var(--color-ink)",
          "--color-bg-inverse": "var(--color-ink)",
          "--color-fg-inverse": "var(--color-paper)",

          "--color-focus": "var(--color-cyan)",
          "--color-danger": "var(--color-magenta)",
          "--color-warning": "var(--color-yellow)",

          "--color-field-bg": "var(--color-paper)",
          "--color-field-fg": "var(--color-ink)",
          "--color-field-border": "var(--color-rule-strong)",
          "--color-field-border-subtle": "var(--color-rule)",

          "--color-skeleton": "color-mix(in oklab, var(--color-ink) 8%, var(--color-paper))",
          "--color-skeleton-strong": "color-mix(in oklab, var(--color-ink) 14%, var(--color-paper))"
        }
      }
    },

    "typography": {
      "fonts": {
        "ui": "--font-sans (IBM Plex Sans Variable)",
        "mono": "--font-mono (IBM Plex Mono 400/600)"
      },
      "scale_to_add": {
        "instruction": "Keep app base dense: 13px/14px. Add a complete scale including large floor-board numerals. Use tokens so Tailwind utilities can reference them.",
        "tokens": {
          "--text-3xs": "0.625rem (10px)",
          "--text-3xs--line-height": "0.875rem",

          "--text-2xs": "0.6875rem (11px)",
          "--text-2xs--line-height": "1rem",

          "--text-xs": "0.75rem (12px)",
          "--text-xs--line-height": "1.05rem",

          "--text-sm": "0.8125rem (13px)",
          "--text-sm--line-height": "1.15rem",

          "--text-base": "0.875rem (14px)",
          "--text-base--line-height": "1.3rem",

          "--text-md": "0.9375rem (15px)",
          "--text-md--line-height": "1.35rem",

          "--text-lg": "1.0625rem (17px)",
          "--text-lg--line-height": "1.45rem",

          "--text-xl": "1.25rem (20px)",
          "--text-xl--line-height": "1.6rem",

          "--text-2xl": "1.5rem (24px) — max for in-app headings",
          "--text-2xl--line-height": "1.85rem",

          "--text-floor": "clamp(3.5rem, 6cqi, 8rem) — press floor job ref numerals",
          "--text-floor--line-height": "0.95"
        }
      },
      "usage_rules": {
        "headings": "Compact; in-app H1/H2 never exceed --text-2xl.",
        "numbers": "Always apply the `num` utility (mono + tabular-nums) to numeric fields.",
        "status_labels": "Always mono, uppercase, tight tracking: tracking-[0.08em].",
        "long_text": "Marketing/spec pages can use --text-base/--text-md; keep line length controlled."
      }
    },

    "spacing_rhythm": {
      "instruction": "Use a print-like modular rhythm. Prefer multiples of 4px, with a few named steps for layout decisions.",
      "tokens_to_add": {
        "--space-1": "0.25rem (4px)",
        "--space-2": "0.5rem (8px)",
        "--space-3": "0.75rem (12px)",
        "--space-4": "1rem (16px)",
        "--space-5": "1.25rem (20px)",
        "--space-6": "1.5rem (24px)",
        "--space-8": "2rem (32px)",
        "--space-10": "2.5rem (40px)",
        "--space-12": "3rem (48px)",
        "--space-16": "4rem (64px)"
      },
      "layout_defaults": {
        "field_gap": "--space-2",
        "panel_padding": "--space-4",
        "table_cell_padding_x": "--space-2",
        "table_cell_padding_y": "--space-1"
      }
    },

    "rules_and_borders": {
      "weights": {
        "--rule-hairline": "1px",
        "--rule-strong": "2px"
      },
      "usage": {
        "hairline": "all panel dividers, table grid, crop marks",
        "strong": "section breaks, table header underline, key totals separators"
      }
    }
  },

  "grid_and_page_shell": {
    "containers": {
      "marketing": {
        "max_width": "72rem (1152px)",
        "gutter": "16px mobile, 24px md, 32px lg",
        "columns": "12-column grid; content typically spans 8–10 columns; diagrams can span full 12",
        "notes": "No hero photography; use rules + SVG diagrams + tables."
      },
      "app_portal_prepress_admin": {
        "max_width": "none; use full width with internal max for readability",
        "content_max": "90rem (1440px) for dense tables; allow full bleed for floor board",
        "gutter": "12px mobile, 16px md, 20px lg",
        "columns": "12-column grid; prefer 3/9, 4/8, 5/7 splits",
        "panel_division": "Panels separated by 1px rules, not elevation."
      },
      "floor_board": {
        "max_width": "none",
        "layout": "3 equal press panels at >= 1100px; stack at smaller widths",
        "background": "ink ground",
        "chrome": "no competing nav; only a minimal top strip with clock + role"
      }
    },
    "route_group_shells": {
      "marketing_routes": {
        "routes": ["/", "/specs", "/quote"],
        "header": {
          "anatomy": "Top rule + wordmark (FORME) left, nav links right; second line optional for standards.",
          "height": "56px",
          "border_bottom": "1px var(--color-rule-strong)",
          "skip_link": "first focusable element; appears at top-left on focus"
        }
      },
      "sign_in": {
        "routes": ["/sign-in"],
        "layout": "single column centered vertically with left-aligned form; max width 28rem; rules for separation",
        "role_indicator": "below submit button as a mono block; demo role picker clearly marked"
      },
      "customer_portal": {
        "routes": ["/app", "/app/jobs/[id]", "/app/new"],
        "header": {
          "height": "48px",
          "left": "FORME + role badge (mono) + current customer",
          "right": "links: Jobs, New job, Specs, Sign out (mock)",
          "border_bottom": "1px var(--color-rule-strong)"
        }
      },
      "prepress": {
        "routes": ["/prepress", "/prepress/jobs/[id]"],
        "header": {
          "height": "48px",
          "left": "PREPRESS (mono label) + shift hours 07:00–19:00",
          "right": "Queue, Floor board, Specs",
          "border_bottom": "1px var(--color-rule-strong)"
        }
      },
      "admin": {
        "routes": ["/admin/pricing"],
        "header": {
          "height": "48px",
          "left": "ADMIN / PRICING MATRIX",
          "right": "Export (mock), Reset (mock)",
          "border_bottom": "1px var(--color-rule-strong)"
        }
      }
    }
  },

  "component_anatomy": {
    "status_mark_and_label": {
      "requirement": "Never colour alone: each state uses (1) colour, (2) mono label, (3) distinct mark shape.",
      "size": {
        "mark_box": "12×12px",
        "gap": "8px",
        "label": "mono, 11–12px, uppercase"
      },
      "shapes": {
        "AUTOMATED": "square outline with a centered dot (cyan)",
        "ACTION_REQUIRED": "diamond (rotated square) filled (magenta)",
        "HELD": "triangle outline (yellow) — use only with label; avoid yellow text on paper",
        "FINAL": "solid square (ink)"
      },
      "data_testid": {
        "mark": "data-testid=\"status-mark\"",
        "label": "data-testid=\"status-label\""
      }
    },

    "cmyk_progress_strip": {
      "description": "A horizontal CMYK bar per job row; progress reads as a colour bar filling left→right.",
      "geometry": {
        "height": "8px",
        "width": "min(160px, 18vw)",
        "border": "1px hairline",
        "segments": "4 equal segments (C,M,Y,K) as background ticks; fill overlays as progress"
      },
      "states": {
        "fill": "use current job state colour as overlay + keep CMYK ticks visible via 1px rules",
        "held": "yellow overlay only at >= 50% opacity on ink ground; on paper use yellow as hatch marks"
      },
      "data_testid": "data-testid=\"job-progress-strip\""
    },

    "registration_target_processing_mark": {
      "description": "Loading/processing mark: registration target rotates.",
      "svg": {
        "size": "24px default; 40px in upload showpiece",
        "stroke": "1px hairline",
        "colors": "ink on paper; paper on ink"
      },
      "data_testid": "data-testid=\"processing-registration-target\""
    },

    "crop_mark_frame": {
      "description": "Proof viewer frame uses crop marks at corners + hairline rules; decorative furniture aria-hidden.",
      "geometry": {
        "frame_padding": "12px",
        "crop_length": "14px",
        "stroke": "1px",
        "inner_rule": "1px var(--color-rule)"
      },
      "toggles": {
        "bleed_guides": "checkbox",
        "safety_margin": "checkbox",
        "separations": "checkbox"
      },
      "data_testid": {
        "viewer": "data-testid=\"proof-viewer\"",
        "toggle_bleed": "data-testid=\"proof-toggle-bleed\"",
        "toggle_safety": "data-testid=\"proof-toggle-safety\"",
        "toggle_seps": "data-testid=\"proof-toggle-separations\""
      }
    },

    "tables": {
      "row_height": "32px",
      "header_height": "36px",
      "cell_padding": "8px x, 4px y",
      "alignment": {
        "text": "left",
        "numbers": "right (mono)",
        "codes": "left (mono)",
        "timestamps": "right (mono)"
      },
      "truncation": {
        "description": "single-line ellipsis; show full on row expand or title attribute",
        "customer_name": "allow wrap to 2 lines only in detail views; in tables keep 1 line ellipsis"
      },
      "sortable_headers": {
        "pattern": "<th scope=col aria-sort> contains <button> with label + sort glyph (ASCII ▲▼ or SVG hairline)",
        "hover": "100ms colour change only",
        "data_testid": "data-testid=\"table-sort-button-{column}\""
      },
      "loading_skeleton": {
        "geometry": "match exact column widths; use hairline rules; skeleton bars are 10px tall with 6px gap"
      }
    },

    "vertical_state_timeline": {
      "stages": [
        "ESTIMATE",
        "ARTWORK RECEIVED",
        "PREFLIGHT",
        "PROOFING",
        "APPROVED",
        "IMPOSED",
        "PLATED",
        "ON PRESS",
        "FINISHING",
        "DESPATCHED"
      ],
      "terminal": ["HELD", "CANCELLED"],
      "layout": {
        "rail": "1px rule",
        "node": "8px mark + label",
        "gap": "10px between stages",
        "current": "uses state colour + bold mono label"
      },
      "data_testid": "data-testid=\"job-state-timeline\""
    },

    "preflight_check_row": {
      "collapsed": {
        "height": "32px",
        "left": "severity mark + check name",
        "right": "measured value (mono) + tolerance (mono) + chevron",
        "severity": {
          "PASS": "ink + square outline",
          "WARN": "cyan + square outline with dot",
          "FAIL": "magenta + diamond"
        }
      },
      "expanded": {
        "adds": "2-row detail: measured vs tolerance, file location/path, remediation text",
        "background": "paper; separated by top hairline rule"
      },
      "data_testid": "data-testid=\"preflight-check-row\""
    },

    "buttons": {
      "primary_consequential": {
        "name": "Approve",
        "style": "hairline outlined, ink text on paper; on hover invert to ink background with paper text (100ms)",
        "confirmation": "second step modal/panel with explicit consequences; requires checkbox + confirm",
        "data_testid": "data-testid=\"approve-proof-button\""
      },
      "secondary": {
        "style": "hairline outlined; muted text; hover to ink text",
        "data_testid": "data-testid=\"secondary-action-button\""
      },
      "destructive": {
        "style": "hairline outlined; magenta text + magenta rule; hover fills magenta with paper text",
        "data_testid": "data-testid=\"destructive-action-button\""
      }
    },

    "form_field": {
      "anatomy": {
        "label": "12px sans; muted; above field",
        "field": "32px height; 1px border; no radius; mono for numeric inputs",
        "help_error": "11–12px mono; error uses magenta + explicit text; aria-describedby"
      },
      "data_testid": {
        "input": "data-testid=\"form-field-{name}\"",
        "error": "data-testid=\"form-field-{name}-error\""
      }
    },

    "editable_spreadsheet_cell": {
      "geometry": {
        "cell": "min-height 28px; padding 6px 8px; 1px grid rules",
        "active": "focus ring cyan; show inline editor",
        "invalid": "magenta underline + error text in row footer"
      },
      "keyboard": "arrow keys move; enter edits; esc cancels",
      "data_testid": "data-testid=\"pricing-matrix-cell-{row}-{col}\""
    },

    "empty_state": {
      "style": "No illustrations. Use a ruled box with a short declarative sentence + next action link.",
      "example_copy": "No jobs match this filter.",
      "data_testid": "data-testid=\"empty-state\""
    }
  },

  "screen_by_screen_layout": {
    "1_home": {
      "route": "/",
      "layout": "12-col marketing grid",
      "sections": [
        "Restrained hero: FORME wordmark + one-sentence standards statement + two CTAs (/quote, /specs)",
        "Press list: XL75, G40, INDIGO with spec tables",
        "Sheet sizes table (SRA3/B2/B1)",
        "Turnaround table (standard/express/rush with multiplier)",
        "Standards block (PDF/X-4, CMYK, ink limits, bleed/safety)"
      ],
      "reading_order": "Hero → presses → sheets → turnaround → standards"
    },

    "2_specs": {
      "route": "/specs",
      "layout": "Left anchor nav (3 cols) + content (9 cols) on desktop; single column on mobile",
      "must_include": [
        "SVG diagram of trim/bleed/safety with mm labels",
        "Deep anchor links per section",
        "Downloadable-looking spec summary block (ruled, mono bullets)"
      ]
    },

    "3_quote": {
      "route": "/quote",
      "layout": "Two-column: inputs left (7 cols), sticky output right (5 cols) at >= lg; stack on mobile",
      "output_panel": {
        "contents": [
          "Assigned press (XL75/G40/INDIGO) + sentence why",
          "Sheets required, up-count",
          "Unit price, subtotal, VAT 12% line, total (all mono, pesos integer formatting)",
          "Despatch date (working-day math, Asia/Manila)"
        ],
        "url_state": "All inputs reflected in query string; show a mono 'URL state' line for debugging"
      }
    },

    "4_sign_in": {
      "route": "/sign-in",
      "layout": "Single column form; demo role picker clearly marked as demo; no auth claims"
    },

    "5_customer_jobs": {
      "route": "/app",
      "layout": "Full-width dense table; filters in a top strip; state filter stored in URL",
      "table": "Real <table> with sortable headers; progress strip per row"
    },

    "6_job_detail": {
      "route": "/app/jobs/[id]",
      "layout": "Three-column at >= xl: left rail timeline (3 cols), main spine (6 cols), right spec/meta (3 cols). Stack on mobile.",
      "main_spine": [
        "Header: reference (mono), description, state, due time, press",
        "Preflight report",
        "Proof viewer with crop marks + toggles",
        "Approve/Reject + comment thread"
      ]
    },

    "7_new_job": {
      "route": "/app/new",
      "layout": "Spec form top; upload showpiece below with streaming checks",
      "upload": "Drop zone with real input[type=file]; aria-live region for streaming check results"
    },

    "8_prepress_queue": {
      "route": "/prepress",
      "layout": "Denser table than customer; due-time prominent; overdue magenta + label + mark",
      "interaction": "Keyboard navigable rows; enter opens detail"
    },

    "9_prepress_detail": {
      "route": "/prepress/jobs/[id]",
      "layout": "Two-panel split at >= lg: left preflight (6 cols), right imposition planner (6 cols).",
      "waive_override": "Requires typed reason; waived checks remain visible struck-through with reason + who"
    },

    "10_floor_board": {
      "route": "/floor",
      "layout": "Ink ground; three press panels; minimal chrome",
      "type_sizes": {
        "at_1280": {
          "job_ref": "clamp(3.5rem, 5vw, 5rem)",
          "fraction": "clamp(2.5rem, 4vw, 3.5rem)",
          "labels": "14px sans / 12px mono"
        },
        "at_3840": {
          "job_ref": "clamp(6rem, 6cqi, 8rem)",
          "fraction": "clamp(4rem, 5cqi, 6rem)",
          "labels": "18px sans / 14px mono"
        }
      }
    },

    "11_admin_pricing": {
      "route": "/admin/pricing",
      "layout": "Spreadsheet-like grid; sticky header row + first column; inline validation; keyboard nav"
    }
  },

  "motion_spec": {
    "rule": "CSS only; transform/opacity only; no animation library. Only the allowed six motions.",
    "tokens_to_add": {
      "--ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
      "--ease-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      "--dur-1": "100ms",
      "--dur-2": "180ms",
      "--dur-3": "240ms"
    },
    "allowed": {
      "preflight_stagger": {
        "effect": "rows land one at a time",
        "stagger": "120ms",
        "duration": "180ms",
        "props": "opacity + translateY(4px)"
      },
      "timeline_advance": {
        "duration": "240ms",
        "props": "opacity + translateX(0) (no bounce)"
      },
      "imposition_relayout": {
        "duration": "240ms",
        "props": "opacity crossfade between SVG states"
      },
      "progress_strip_fill": {
        "duration": "240ms",
        "props": "scaleX from left"
      },
      "registration_target_rotate": {
        "duration": "900ms linear infinite",
        "props": "rotate"
      },
      "queue_row_entrance": {
        "duration": "180ms",
        "props": "opacity + translateY(2px)"
      }
    },
    "reduced_motion": {
      "media": "@media (prefers-reduced-motion: reduce)",
      "behavior": "All animations disabled; screens render complete and static; processing mark becomes static target."
    }
  },

  "contrast_audit": {
    "note": "Run a real WCAG contrast check during implementation. Below are allowed pairs and pairs to avoid based on known risk (yellow on paper).",
    "allowed_pairs": [
      {
        "fg": "Ink (#0B0B0B)",
        "bg": "Paper (#F4F2ED)",
        "use": "default text"
      },
      {
        "fg": "Muted on paper (#6B675F)",
        "bg": "Paper (#F4F2ED)",
        "use": "secondary labels; verify AA at 13px"
      },
      {
        "fg": "Paper (#F4F2ED)",
        "bg": "Ink (#0B0B0B)",
        "use": "floor board primary text"
      },
      {
        "fg": "Muted on ink (#8C877D)",
        "bg": "Ink (#0B0B0B)",
        "use": "floor board secondary labels"
      },
      {
        "fg": "Cyan (#00A0D8)",
        "bg": "Paper (#F4F2ED)",
        "use": "focus rings, automated marks; avoid for long body text"
      },
      {
        "fg": "Magenta (#D6006E)",
        "bg": "Paper (#F4F2ED)",
        "use": "action required marks + short labels"
      }
    ],
    "pairs_to_avoid": [
      {
        "fg": "Yellow (#F2B705)",
        "bg": "Paper (#F4F2ED)",
        "why": "fails contrast at body size; use only for marks and large numerals"
      },
      {
        "fg": "Muted on paper (#6B675F)",
        "bg": "Rule (#CDC9BE)",
        "why": "too low contrast for small text"
      }
    ]
  },

  "component_path": {
    "note": "Per constraints: NO component library (no shadcn). Hand-roll components in plain React/Next. Use <select> where appropriate.",
    "paths": {
      "tokens": "/app/frontend/src/app/globals.css",
      "domain_state_labels": "/app/frontend/src/lib/domain.ts",
      "money": "/app/frontend/src/lib/money.ts",
      "dates": "/app/frontend/src/lib/dates.ts"
    }
  },

  "instructions_to_main_agent": [
    "Do not introduce shadcn/Radix/MUI. Hand-roll components with Tailwind + CSS variables.",
    "Never use border-radius; enforce via base reset already present.",
    "Never use shadows/gradients/glass/glow.",
    "All numbers/codes/timestamps/status labels must use mono + tabular-nums (use the existing `num` utility).",
    "All interactive and key informational elements MUST include data-testid in kebab-case.",
    "Status must be communicated by colour + label + distinct mark shape.",
    "Use real <table> semantics with aria-sort patterns as specified.",
    "SVG furniture (crop marks, registration targets, colour bars) must be aria-hidden when decorative.",
    "Motion: CSS only; only the six allowed motions; respect prefers-reduced-motion.",
    "No images anywhere; all graphics are SVG/rules/type."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
