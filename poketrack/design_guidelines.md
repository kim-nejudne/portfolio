{
  "project": {
    "name": "PokéTrack",
    "north_star": "A browser-based Nintendo-style game HUD where task completion fuels Pokémon XP, level-ups, and authentic evolutions. Must never read as a SaaS dashboard.",
    "hard_requirements": [
      "Maximalist Nintendo battle HUD × Game Boy vibe: chunky beveled frames, thick outlines, glossy highlights, hard shadows, scanline/noise texture.",
      "Dark mode default (neon battle screen). Light mode secondary (Poké-Center bright).",
      "Palette engine = 18 canonical Pokémon type colors. UI derives chips/stripes/glows/gradients from types.",
      "Pixel font (Press Start 2P) ONLY for game chrome (HUD labels, buttons, headings, stats). Body text uses Inter (or similar).",
      "Sprites must be crisp: image-rendering: pixelated; idle-bob + shadow ellipse.",
      "XP bar is hero element with segmented tick-fill animation; level-up slam + shake + particles (reduced-motion fallback required).",
      "Evolution cutscene is full-screen takeover with silhouette flashes, rays, confetti/sparks, shockwave ring, typed dialogue box.",
      "No off-the-shelf visual component libraries. Hand-built primitives only. Radix primitives allowed only for a11y plumbing if needed.",
      "All interactive + key informational elements MUST include data-testid (kebab-case, role-based)."
    ]
  },

  "deliverable_1_tailwind_config_snippet": {
    "notes": [
      "Drop this into tailwind.config.js under theme.extend.",
      "Uses CSS variables for type colors so runtime can swap based on Pokémon types.",
      "Animations include reduced-motion handling via Tailwind's motion-reduce variants in components."
    ],
    "tailwind_config_js_snippet": "// tailwind.config.js (snippet)\nmodule.exports = {\n  theme: {\n    extend: {\n      fontFamily: {\n        pixel: [\"'Press Start 2P'\", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],\n        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],\n      },\n      colors: {\n        // Canonical Pokémon type palette (base + dark + light).\n        // Use as: bg-type-fire, text-type-water-ink, shadow-type-electricGlow, etc.\n        type: {\n          normal: { DEFAULT: '#A8A77A', dark: '#6D6B45', light: '#D7D6B2', ink: '#0B0D10' },\n          fire: { DEFAULT: '#EE8130', dark: '#A84A12', light: '#FFC08A', ink: '#0B0D10' },\n          water: { DEFAULT: '#6390F0', dark: '#1F4FB8', light: '#A9C4FF', ink: '#070A12' },\n          electric: { DEFAULT: '#F7D02C', dark: '#B08A00', light: '#FFF1A6', ink: '#0B0D10' },\n          grass: { DEFAULT: '#7AC74C', dark: '#2F7A2A', light: '#B9F29A', ink: '#07110A' },\n          ice: { DEFAULT: '#96D9D6', dark: '#2E8F8A', light: '#CFF7F5', ink: '#071012' },\n          fighting: { DEFAULT: '#C22E28', dark: '#7A1410', light: '#F08A86', ink: '#0B0D10' },\n          poison: { DEFAULT: '#A33EA1', dark: '#5E1B5D', light: '#E0A0DF', ink: '#0B0D10' },\n          ground: { DEFAULT: '#E2BF65', dark: '#9B7A2A', light: '#FFE2A8', ink: '#0B0D10' },\n          flying: { DEFAULT: '#A98FF3', dark: '#5B3FD6', light: '#D9CCFF', ink: '#0B0D10' },\n          psychic: { DEFAULT: '#F95587', dark: '#B3123F', light: '#FFB0C6', ink: '#0B0D10' },\n          bug: { DEFAULT: '#A6B91A', dark: '#5E6E00', light: '#DDEB7A', ink: '#0B0D10' },\n          rock: { DEFAULT: '#B6A136', dark: '#6E5F12', light: '#E9D98A', ink: '#0B0D10' },\n          ghost: { DEFAULT: '#735797', dark: '#3A245A', light: '#B9A7D6', ink: '#0B0D10' },\n          dragon: { DEFAULT: '#6F35FC', dark: '#2E0FB8', light: '#B9A2FF', ink: '#0B0D10' },\n          dark: { DEFAULT: '#705746', dark: '#2F241C', light: '#B59A86', ink: '#F7F7FB' },\n          steel: { DEFAULT: '#B7B7CE', dark: '#6E6E86', light: '#E7E7F2', ink: '#0B0D10' },\n          fairy: { DEFAULT: '#D685AD', dark: '#8A3E63', light: '#F6C7DD', ink: '#0B0D10' },\n        },\n        // Game neutrals (keep minimal; types do the heavy lifting)\n        game: {\n          bg: '#070A12',\n          bg2: '#0B1020',\n          panel: '#0E1630',\n          panel2: '#101B3A',\n          ink: '#EAF0FF',\n          inkDim: '#B9C6E6',\n          outline: '#05070D',\n          highlight: 'rgba(255,255,255,0.22)',\n          scanline: 'rgba(0,0,0,0.22)',\n        },\n      },\n      boxShadow: {\n        // Beveled frame: hard drop + inner highlight + inner shade\n        frame: '0 10px 0 rgba(0,0,0,0.65), 0 18px 28px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.45)',\n        frameSm: '0 6px 0 rgba(0,0,0,0.65), 0 12px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -8px 14px rgba(0,0,0,0.45)',\n        buttonHard: '0 6px 0 rgba(0,0,0,0.75), 0 10px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',\n        buttonPressed: '0 2px 0 rgba(0,0,0,0.75), 0 6px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',\n        glow: '0 0 0 2px rgba(255,255,255,0.08), 0 0 24px rgba(99,144,240,0.35)',\n      },\n      borderRadius: {\n        frame: '18px',\n        frameInner: '14px',\n        chip: '999px',\n      },\n      keyframes: {\n        'idle-bob': { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },\n        'shine-sweep': { '0%': { transform: 'translateX(-120%) skewX(-18deg)' }, '100%': { transform: 'translateX(120%) skewX(-18deg)' } },\n        'tick-fill': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },\n        'level-up-slam': { '0%': { transform: 'translateY(-18px) scale(0.92)', opacity: '0' }, '60%': { transform: 'translateY(0px) scale(1.06)', opacity: '1' }, '100%': { transform: 'translateY(0px) scale(1)' } },\n        'screen-shake': { '0%,100%': { transform: 'translate(0,0)' }, '20%': { transform: 'translate(-6px, 2px)' }, '40%': { transform: 'translate(5px, -3px)' }, '60%': { transform: 'translate(-3px, -2px)' }, '80%': { transform: 'translate(4px, 3px)' } },\n        'capture-wobble': { '0%,100%': { transform: 'rotate(0deg) translateY(0)' }, '25%': { transform: 'rotate(-10deg) translateY(1px)' }, '50%': { transform: 'rotate(10deg) translateY(-1px)' }, '75%': { transform: 'rotate(-6deg) translateY(1px)' } },\n        'silhouette-morph': { '0%': { filter: 'brightness(1) contrast(1)', transform: 'scale(1)' }, '35%': { filter: 'brightness(6) contrast(0)', transform: 'scale(1.06)' }, '70%': { filter: 'brightness(10) contrast(0)', transform: 'scale(1.12)' }, '100%': { filter: 'brightness(1) contrast(1)', transform: 'scale(1)' } },\n        'ray-burst': { '0%': { transform: 'scale(0.6)', opacity: '0' }, '40%': { opacity: '1' }, '100%': { transform: 'scale(1.25)', opacity: '0' } },\n        'typewriter-caret': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },\n        'dialogue-arrow-blink': { '0%,100%': { opacity: '0.25', transform: 'translateY(0)' }, '50%': { opacity: '1', transform: 'translateY(-2px)' } },\n      },\n      animation: {\n        'idle-bob': 'idle-bob 2.2s ease-in-out infinite',\n        'shine-sweep': 'shine-sweep 1.2s ease-in-out infinite',\n        'tick-fill': 'tick-fill 0.18s steps(6) forwards',\n        'level-up-slam': 'level-up-slam 520ms cubic-bezier(0.2, 1.2, 0.2, 1)',\n        'screen-shake': 'screen-shake 420ms linear',\n        'capture-wobble': 'capture-wobble 1.2s ease-in-out infinite',\n        'silhouette-morph': 'silhouette-morph 1.4s ease-in-out',\n        'ray-burst': 'ray-burst 900ms ease-out',\n        'typewriter-caret': 'typewriter-caret 700ms step-end infinite',\n        'dialogue-arrow-blink': 'dialogue-arrow-blink 650ms step-end infinite',\n      },\n      backgroundImage: {\n        // Scanlines + subtle noise (use as overlay pseudo-elements in components)\n        scanlines: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 3px, rgba(0,0,0,0.22) 4px)',\n        speedstripes: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 10px, rgba(255,255,255,0) 10px 22px)',\n      },\n    },\n  },\n};"
  },

  "deliverable_2_type_colors_and_text_rule": {
    "type_hex": {
      "normal": "#A8A77A",
      "fire": "#EE8130",
      "water": "#6390F0",
      "electric": "#F7D02C",
      "grass": "#7AC74C",
      "ice": "#96D9D6",
      "fighting": "#C22E28",
      "poison": "#A33EA1",
      "ground": "#E2BF65",
      "flying": "#A98FF3",
      "psychic": "#F95587",
      "bug": "#A6B91A",
      "rock": "#B6A136",
      "ghost": "#735797",
      "dragon": "#6F35FC",
      "dark": "#705746",
      "steel": "#B7B7CE",
      "fairy": "#D685AD"
    },
    "text_color_rule": {
      "rule": "Pick text color by relative luminance. If background luminance > 0.55 use near-black (#0B0D10). Else use near-white (#F7F7FB).",
      "js_helper": "// utils/getReadableTextColor.js\nexport function getReadableTextColor(hex) {\n  const c = hex.replace('#','');\n  const r = parseInt(c.slice(0,2),16)/255;\n  const g = parseInt(c.slice(2,4),16)/255;\n  const b = parseInt(c.slice(4,6),16)/255;\n  const lin = (v) => (v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));\n  const L = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);\n  return L > 0.55 ? '#0B0D10' : '#F7F7FB';\n}\n"
    },
    "type_gradient_rule": {
      "rule": "Partner panel background = diagonal gradient from primary type to secondary type (if dual-type). Add a dark overlay for readability in dark mode.",
      "example": "background: linear-gradient(135deg, var(--type-a) 0%, var(--type-b) 100%);"
    }
  },

  "deliverable_3_layout_blueprint_main_project_screen": {
    "route": "/projects/:projectId",
    "layout": {
      "desktop": {
        "grid": "lg:grid lg:grid-cols-[420px_1fr] lg:gap-6",
        "left": "PartnerPanel (sticky-ish) + tabs (Board/Leaderboard) header chrome",
        "right": "Board arenas OR Leaderboard screen",
        "notes": [
          "PartnerPanel stays visible; board is the arena.",
          "Avoid SaaS-like top nav; use game title bar + HUD tabs."
        ]
      },
      "mobile": {
        "stack_order": [
          "GameTitleBar (compact)",
          "PartnerPanel (sprite + XP bar hero)",
          "Tabs (Board / Leaderboard)",
          "Board arenas"
        ],
        "breakpoints": {
          "sm": "tighten padding; keep frames chunky",
          "md": "2-column board arenas optional (Backlog/In Progress stacked, Done full width)",
          "lg": "full split layout"
        }
      }
    },
    "spacing": {
      "outer_padding": "px-3 sm:px-4 lg:px-6",
      "section_gap": "gap-4 sm:gap-5 lg:gap-6",
      "frame_padding": "p-3 sm:p-4"
    }
  },

  "deliverable_4_hand_built_primitives_recipes": {
    "global_css_notes": [
      "Use pseudo-elements for glossy highlight + scanlines overlay.",
      "Use outline + outline-offset for thick outer frame; inner border for bevel.",
      "Never use generic Card components; everything is a GameFrame.",
      "All primitives must accept className + data-testid passthrough."
    ],

    "GameFrame": {
      "purpose": "Universal HUD window frame (replaces cards).",
      "structure": ["Outer frame (outline)", "Bevel border", "Inner content", "Overlay: gloss + scanlines"],
      "tailwind_recipe": {
        "wrapper": "relative rounded-frame bg-game-panel text-game-ink shadow-frame outline outline-4 outline-game-outline outline-offset-2",
        "bevel": "border border-white/10",
        "inner": "rounded-frameInner bg-gradient-to-b from-white/10 via-white/0 to-black/25",
        "overlay_before": "before:absolute before:inset-0 before:rounded-frame before:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.22),rgba(255,255,255,0)_45%)] before:pointer-events-none",
        "overlay_after": "after:absolute after:inset-0 after:rounded-frame after:bg-scanlines after:opacity-25 after:mix-blend-overlay after:pointer-events-none"
      },
      "details": {
        "corner_rivets": "Add 4 tiny circles via absolutely positioned spans (top-left etc) with bg-white/10 + border-black/40.",
        "notch_cuts": "Optional: clip-path polygon for notched corners on special frames (settings, modals)."
      }
    },

    "DialogueBox": {
      "purpose": "Toasts, confirmations, evolution congratulations, system messages.",
      "tailwind_recipe": {
        "box": "relative rounded-[14px] bg-[#F7F7FB] text-[#0B0D10] shadow-frameSm outline outline-4 outline-black outline-offset-2",
        "double_border": "border-2 border-black/90 ring-2 ring-white/70",
        "text": "font-pixel text-[10px] leading-5 tracking-wide",
        "arrow": "absolute bottom-2 right-3 h-0 w-0 border-l-[7px] border-r-[7px] border-t-[9px] border-l-transparent border-r-transparent border-t-black/90 animate-dialogue-arrow-blink"
      },
      "typewriter": {
        "approach": "Prefer JS-driven typewriter for multi-line; CSS steps works for single-line.",
        "data-testid": "dialogue-box"
      }
    },

    "GameButton": {
      "purpose": "3D pressable game buttons (primary/secondary/ghost).",
      "tailwind_recipe": {
        "base": "relative inline-flex items-center justify-center select-none rounded-[12px] px-4 py-3 font-pixel text-[10px] tracking-wide outline-none",
        "face": "bg-[var(--btn-face)] text-[var(--btn-ink)]",
        "rim": "ring-2 ring-black/70",
        "shadow": "shadow-buttonHard",
        "hover": "hover:brightness-110 hover:-translate-y-[1px]",
        "active": "active:translate-y-[3px] active:shadow-buttonPressed",
        "focus": "focus-visible:ring-4 focus-visible:ring-[var(--btn-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-game-bg",
        "motion": "transition-[filter,transform,box-shadow] duration-150"
      },
      "variants": {
        "primary": "--btn-face: var(--type); --btn-ink: var(--type-ink); --btn-glow: color-mix(in srgb, var(--type) 55%, white)",
        "secondary": "--btn-face: rgba(255,255,255,0.10); --btn-ink: #EAF0FF; --btn-glow: rgba(255,255,255,0.35)",
        "danger": "--btn-face: #C22E28; --btn-ink: #F7F7FB; --btn-glow: rgba(255,80,80,0.55)"
      },
      "data-testid_examples": [
        "data-testid=\"starter-confirm-button\"",
        "data-testid=\"project-settings-save-button\""
      ]
    },

    "TypeChip": {
      "purpose": "Solid glowing type label chip.",
      "tailwind_recipe": {
        "chip": "inline-flex items-center gap-2 rounded-chip px-3 py-1 font-pixel text-[9px] tracking-wide ring-2 ring-black/70",
        "bg": "bg-[var(--type)] text-[var(--type-ink)]",
        "glow": "shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_0_18px_color-mix(in_srgb,var(--type)_55%,transparent)]"
      },
      "contrast": "Use getReadableTextColor(typeHex) to set --type-ink."
    },

    "PokeBallLoader": {
      "purpose": "Loading spinner with capture wobble.",
      "tailwind_recipe": {
        "wrap": "relative h-12 w-12 rounded-full ring-4 ring-black bg-[linear-gradient(to_bottom,#E53935_0_50%,#F7F7FB_50_100%)] animate-capture-wobble",
        "band": "after:absolute after:left-0 after:top-1/2 after:h-[6px] after:w-full after:-translate-y-1/2 after:bg-black",
        "button": "before:absolute before:left-1/2 before:top-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-[#F7F7FB] before:ring-4 before:ring-black"
      },
      "data-testid": "pokeball-loader"
    },

    "XPBar": {
      "purpose": "Hero XP bar: segmented, beveled, shine sweep, tick-fill awarding animation.",
      "structure": ["Frame", "Segments row", "Fill overlay per segment", "Shine sweep pseudo"],
      "tailwind_recipe": {
        "frame": "relative rounded-[14px] bg-black/40 ring-2 ring-black/70 shadow-frameSm overflow-hidden",
        "segments": "grid grid-cols-12 gap-[3px] p-[6px]",
        "segment": "relative h-3 rounded-[6px] bg-white/10 overflow-hidden",
        "fill": "absolute inset-0 origin-left bg-[var(--xp-fill)]",
        "shine": "pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-60"
      },
      "animation": {
        "tick_fill": "Apply animate-tick-fill to each segment fill as it becomes active (staggered).",
        "shine_sweep": "Animate shine element with animate-shine-sweep only while awarding XP."
      },
      "data-testid": "partner-xp-bar"
    },

    "LevelUpBanner": {
      "purpose": "LEVEL UP! slam banner with optional screen shake + particles.",
      "tailwind_recipe": {
        "banner": "pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-[16px] bg-white text-black ring-4 ring-black shadow-frame px-5 py-3 font-pixel text-[12px] tracking-widest",
        "anim": "animate-level-up-slam",
        "shake": "motion-safe:animate-screen-shake"
      },
      "data-testid": "level-up-banner"
    },

    "EvolutionCutscene": {
      "purpose": "Full-screen staged evolution takeover.",
      "layers": [
        "Backdrop dim + aurora",
        "Sprite stage (old -> silhouette -> new)",
        "Flashes (white overlay)",
        "Rays + confetti/sparks + shockwave ring",
        "DialogueBox typed message"
      ],
      "tailwind_recipe": {
        "root": "fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm",
        "stage": "absolute inset-0 grid place-items-center",
        "sprite": "w-40 sm:w-52 image-rendering-pixelated",
        "flash": "absolute inset-0 bg-white opacity-0",
        "rays": "absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0.0),rgba(255,255,255,0.35),rgba(255,255,255,0.0))] opacity-0",
        "dialogue": "absolute bottom-6 left-1/2 w-[min(720px,92vw)] -translate-x-1/2"
      },
      "reduced_motion": "If prefers-reduced-motion: skip flashes/shake/morph; show a single crossfade + dialogue result."
    },

    "BranchChoiceModal": {
      "purpose": "Radial/fanned evolution choices.",
      "layout": {
        "radial": "relative grid place-items-center",
        "cards": "absolute left-1/2 top-1/2 origin-bottom",
        "angles": "Map choices to angles (-35..35deg) and translate outward (e.g., 140px)."
      },
      "card_recipe": "w-40 rounded-frame bg-game-panel shadow-frame ring-2 ring-black/70 hover:scale-[1.04] hover:brightness-110 transition-[transform,filter] duration-150",
      "data-testid": "branch-choice-modal"
    },

    "LeaderboardPlate": {
      "purpose": "Tournament bracket / battle rankings screen plates.",
      "metallic_gradients": {
        "gold": "linear-gradient(135deg,#FFF2B0,#D6A400 55%,#FFF7C9)",
        "silver": "linear-gradient(135deg,#F2F5FF,#9AA3B2 55%,#FFFFFF)",
        "bronze": "linear-gradient(135deg,#FFD2B0,#B86A2A 55%,#FFE7D6)"
      },
      "recipe": {
        "plate": "relative rounded-frame ring-4 ring-black/70 shadow-frame overflow-hidden",
        "shine": "after:absolute after:inset-y-0 after:left-[-40%] after:w-[40%] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] after:skew-x-[-18deg] after:opacity-60",
        "current_user": "animate-[shine-sweep_1.2s_ease-in-out_infinite]"
      },
      "semantics": "Use real <table> with <thead>, <tbody>, <th scope=\"row\"> for rank/name."
    },

    "TicketCard": {
      "purpose": "Task ticket with type stripe, story points badge, assignee avatar; draggable + keyboard reachable.",
      "recipe": {
        "card": "relative rounded-frame bg-game-panel shadow-frameSm ring-2 ring-black/70 overflow-hidden",
        "stripe": "absolute left-0 top-0 h-full w-[10px] bg-[var(--type)]",
        "body": "pl-4 pr-3 py-3",
        "title": "font-pixel text-[10px] tracking-wide text-game-ink",
        "desc": "mt-2 font-body text-sm text-game-inkDim",
        "hover": "hover:-translate-y-[2px] hover:brightness-110 transition-[transform,filter,box-shadow] duration-150",
        "drag": "data-[dragging=true]:rotate-[-2deg] data-[dragging=true]:scale-[1.02]"
      },
      "data-testid": "ticket-card"
    }
  },

  "deliverable_5_motion_recipes_framer_motion": {
    "spring_presets": {
      "panelEnter": { "type": "spring", "stiffness": 420, "damping": 32, "mass": 0.9 },
      "cardLift": { "type": "spring", "stiffness": 520, "damping": 28, "mass": 0.7 },
      "slam": { "type": "spring", "stiffness": 760, "damping": 26, "mass": 0.8 }
    },
    "recipes": {
      "panel_enter": "<motion.div initial={{ y: 14, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={springs.panelEnter} />",
      "ticket_hover_drag": "Hover: whileHover={{ y: -4, rotate: -0.6, filter: 'brightness(1.08)' }} transition={springs.cardLift}. Drag: whileDrag={{ scale: 1.04, rotate: -2, boxShadow: '0 18px 0 rgba(0,0,0,0.65), 0 28px 40px rgba(0,0,0,0.55)' }}",
      "xp_tick_award": "Animate segments with staggerChildren (0.06s) and each segment fill scales X from 0->1 using steps-like ease (or CSS animate-tick-fill).",
      "level_up_slam": "Banner: initial y:-18 scale:0.92 opacity:0 -> animate y:0 scale:1.06 opacity:1 -> settle scale:1. Use slam spring. Optional screen shake on root container.",
      "screen_shake": "Apply to a wrapper motion.div: animate={{ x: [0,-6,5,-3,4,0], y:[0,2,-3,-2,3,0] }} transition={{ duration: 0.42, ease: 'linear' }} (motion-safe only).",
      "silhouette_timeline": "Use useAnimate() or variants sequence: oldSprite opacity 1->0, silhouette opacity 0->1 with brightness filter pulses, flash overlay toggles opacity, then newSprite opacity 0->1."
    },
    "reduced_motion": {
      "rule": "Use useReducedMotion() from framer-motion. If true: disable shake, disable repeated flashes, replace with single fade + dialogue.",
      "snippet": "import { useReducedMotion } from 'framer-motion';\nconst reduce = useReducedMotion();\nconst shake = reduce ? {} : { x: [0,-6,5,-3,4,0], y:[0,2,-3,-2,3,0] };"
    }
  },

  "deliverable_6_ambient_background_recipe": {
    "goal": "Deep saturated battle-screen backdrop with parallax layers + aurora behind content; never feels like a flat dashboard.",
    "layer_stack": [
      {
        "name": "Base",
        "recipe": "bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(99,144,240,0.18),transparent_60%),radial-gradient(900px_500px_at_80%_20%,rgba(249,85,135,0.12),transparent_55%),linear-gradient(180deg,#070A12,#0B1020)]"
      },
      {
        "name": "Aurora blur",
        "recipe": "absolute inset-0 blur-3xl opacity-60 bg-[radial-gradient(600px_300px_at_50%_20%,rgba(150,217,214,0.18),transparent_60%),radial-gradient(700px_400px_at_30%_70%,rgba(122,199,76,0.14),transparent_60%)]"
      },
      {
        "name": "Hex-grid drift",
        "recipe": "absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px] motion-safe:animate-[idle-bob_12s_ease-in-out_infinite]"
      },
      {
        "name": "Speed stripes accent (small area)",
        "recipe": "absolute -top-10 left-0 h-40 w-[70vw] opacity-20 bg-speedstripes rotate-[-8deg]"
      }
    ],
    "parallax": {
      "implementation": "Use a small requestAnimationFrame loop reading scrollY and translating layers at different rates (or Framer Motion useScroll + useTransform).",
      "note": "Respect prefers-reduced-motion: disable parallax transforms."
    }
  },

  "deliverable_7_accessibility_notes": {
    "reduced_motion": [
      "Use prefers-reduced-motion to disable: screen shake, repeated flashes, particle bursts, parallax drift.",
      "Evolution cutscene fallback: single fade old->new + static rays (no flashing) + dialogue box with full text (no typewriter).",
      "XP award fallback: fill bar instantly (or 1-step) without tick-by-tick; still show LEVEL UP banner without shake."
    ],
    "keyboard": [
      "Drag-and-drop must be keyboard reachable: provide arrow-key move between columns + Enter to pick up/drop (announce via aria-live).",
      "All buttons/interactive chips must be focusable with thick colored focus ring (2-4px).",
      "Modals must trap focus and close on Escape; restore focus to trigger."
    ],
    "contrast": [
      "Type chips must compute ink color (near-black vs near-white) based on luminance.",
      "Never place small pixel text directly on bright type gradients without a dark overlay."
    ],
    "semantics": [
      "Leaderboard uses real <table> semantics.",
      "Use aria-labels for icon-only buttons (custom SVG icons)."
    ],
    "testing": {
      "data_testid_rule": "Every interactive + key info element includes data-testid in kebab-case describing role.",
      "examples": [
        "data-testid=\"board-column-done\"",
        "data-testid=\"ticket-story-points-badge\"",
        "data-testid=\"partner-level-text\"",
        "data-testid=\"evolution-cutscene-continue-button\""
      ]
    }
  },

  "deliverable_8_do_this_not_that": {
    "do_this": [
      "Use GameFrame everywhere (frames, not cards).",
      "Use thick outlines + bevel + hard shadows; add scanlines/noise overlays subtly.",
      "Use type colors as the engine: chips, stripes, glows, hover states, partner gradients.",
      "Use Press Start 2P for HUD labels/buttons/headings only; Inter for paragraphs.",
      "Make XP bar the visual hero; animate XP awards tick-by-tick.",
      "Use custom SVG icons that feel game-authentic (Poké Ball, badge, lightning bolt, etc.).",
      "Add micro-interactions: hover lift, count-up numbers, springy entrances.",
      "Default dark mode; light mode is a deliberate Poké-Center theme."
    ],
    "not_that": [
      "No SaaS dashboard patterns: flat cards, subtle gray borders, tiny shadows, minimalist whitespace-only UI.",
      "No generic component libraries for visuals (no shadcn/ui visuals, no Material/Chakra).",
      "No paragraphs in pixel font.",
      "No lucide-react generic icons when a custom SVG would be more authentic.",
      "No purple/pink SaaS gradients; type colors drive accents instead.",
      "No transition: all; only transition specific properties."
    ]
  },

  "typography": {
    "fonts": {
      "pixel": "Press Start 2P (Google Fonts)",
      "body": "Inter (Google Fonts)"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-pixel tracking-[0.06em]",
      "h2": "text-base md:text-lg font-pixel tracking-[0.06em]",
      "hud_label": "font-pixel text-[10px] tracking-wide",
      "body": "font-body text-sm sm:text-base leading-6",
      "small": "text-xs font-body"
    },
    "rules": [
      "Never set long paragraphs in Press Start 2P.",
      "Use text-stroke or shadow for pixel headings on busy backgrounds."
    ]
  },

  "component_path": {
    "note": "Visual layer must be hand-built. Existing /src/components/ui (shadcn) should NOT be used for visuals per spec. Radix primitives allowed only for a11y plumbing if needed.",
    "new_components_to_create": [
      "/app/frontend/src/components/game/GameFrame.js",
      "/app/frontend/src/components/game/DialogueBox.js",
      "/app/frontend/src/components/game/GameButton.js",
      "/app/frontend/src/components/game/TypeChip.js",
      "/app/frontend/src/components/game/PokeBallLoader.js",
      "/app/frontend/src/components/game/XPBar.js",
      "/app/frontend/src/components/game/LevelUpBanner.js",
      "/app/frontend/src/components/game/EvolutionCutscene.js",
      "/app/frontend/src/components/game/BranchChoiceModal.js",
      "/app/frontend/src/components/game/LeaderboardPlate.js",
      "/app/frontend/src/components/game/TicketCard.js",
      "/app/frontend/src/components/game/AmbientBackground.js"
    ]
  },

  "image_urls": {
    "note": "Sprites come from PokéAPI sprite CDN (pixel art). No stock photography needed.",
    "categories": [
      {
        "category": "pokemon_sprites",
        "description": "Use PokéAPI sprites; ensure image-rendering: pixelated.",
        "urls": [
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png",
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png",
          "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png"
        ]
      }
    ]
  },

  "instructions_to_main_agent": [
    "Implement Tailwind theme snippet and load Google Fonts (Press Start 2P + Inter) in index.html or CSS.",
    "Replace any existing centered App-header styles; build a full-screen game backdrop with AmbientBackground.",
    "Build primitives first (GameFrame, GameButton, DialogueBox, XPBar) and use them everywhere.",
    "Ensure every interactive element and key info element has data-testid.",
    "Use framer-motion with useReducedMotion for all spectacle features."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
