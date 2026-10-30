#!/usr/bin/env bash
# Unattended roadmap runner: builds every remaining docs/ROADMAP.md feature with one fresh
# `claude -p "/next-feature"` session each (a fresh session is the same as /clear), retries
# failures, then gates, pushes and deploys once nothing is left.
#
#   scripts/autopilot.sh [--dry-run] [--no-deploy] [--max-attempts N]
#
# Sessions run with --dangerously-skip-permissions and a hard deny list (push, reset, clean,
# checkout, rebase, gh, ssh, scp, docker, rm -rf, sudo). Their environment also points
# origin's push URL nowhere and gives gh a dead token, so a push or gh call that slips past
# the deny list still fails. This script does the push and deploy itself. A live-games deploy
# failure is forced at once (force=true ends live games).
# Logs: ~/.cache/buzzr-autopilot/<UTC timestamp>/ (run.log, status.txt, one .jsonl per session).
#
# Test hooks (environment; unset in a real run): AUTOPILOT_SESSION_TIMEOUT (default 3h),
# AUTOPILOT_LIVE_URL (default https://buzzr.kimnejudne.dev), AUTOPILOT_WAIT_DIVISOR (default 1;
# divides every fixed wait, backoff and poll interval, but not the wait for a usage-limit
# reset), AUTOPILOT_PLAIN=1 (no pinned status area). XDG_CACHE_HOME moves the logs and lock.

set -Eeuo pipefail

# ---------------------------------------------------------------------------------------------
# Options and paths

DRY_RUN=0
DEPLOY=1
MAX_ATTEMPTS=3
MAX_SESSIONS=40
MAX_GIVEUPS_IN_A_ROW=3
SESSION_TIMEOUT=${AUTOPILOT_SESSION_TIMEOUT:-3h}
LIVE_URL=${AUTOPILOT_LIVE_URL:-'https://buzzr.kimnejudne.dev'}
WAIT_DIVISOR=${AUTOPILOT_WAIT_DIVISOR:-1}
WORKFLOW='deploy-buzzer.yml'
# The option loop shifts them away; the systemd-inhibit re-exec below needs them all.
ORIG_ARGS=("$@")

while (($#)); do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    --no-deploy) DEPLOY=0 ;;
    --max-attempts)
      MAX_ATTEMPTS=${2:?--max-attempts needs a number}
      shift
      ;;
    -h | --help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done
[[ $MAX_ATTEMPTS =~ ^[1-9][0-9]*$ ]] || {
  echo "--max-attempts needs a positive number" >&2
  exit 2
}
[[ $WAIT_DIVISOR =~ ^[1-9][0-9]*$ ]] || {
  echo "AUTOPILOT_WAIT_DIVISOR needs a positive number" >&2
  exit 2
}

SELF=$(realpath -- "${BASH_SOURCE[0]}")
BUZZER=$(dirname -- "$(dirname -- "$SELF")")
cd "$BUZZER"
REPO=$(git rev-parse --show-toplevel)
ROADMAP_JS=(node .claude/scripts/roadmap.mjs)

# Keep the machine awake for the whole run (Kim is away). Re-exec once under systemd-inhibit.
if [[ -z ${AUTOPILOT_INHIBITED:-} ]] && command -v systemd-inhibit >/dev/null &&
  systemd-inhibit --what=idle:sleep:handle-lid-switch --who=buzzr-autopilot --why=probe true 2>/dev/null; then
  export AUTOPILOT_INHIBITED=1
  exec systemd-inhibit --what=idle:sleep:handle-lid-switch --who=buzzr-autopilot \
    --why="Buzzr autopilot is building the roadmap" --mode=block "$SELF" "${ORIG_ARGS[@]}"
fi

CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/buzzr-autopilot
mkdir -p "$CACHE"
# Children never inherit fd 9 (see run_session), so a stray dev server cannot keep the lock.
exec 9>"$CACHE/lock"
if ! flock -n 9; then
  echo "Another autopilot run holds $CACHE/lock." >&2
  exit 1
fi

RUN="$CACHE/$(date -u +%Y%m%dT%H%M%SZ)"
STATE="$RUN/state"
mkdir -p "$STATE"
RUN_LOG="$RUN/run.log"

# ---------------------------------------------------------------------------------------------
# Terminal UI: a scrolling timeline with a pinned 4-row status area at the bottom.

UI_TTY=0
[[ -t 1 && -z ${AUTOPILOT_PLAIN:-} ]] && UI_TTY=1
# All UI output goes to fd 3, so functions whose stdout is captured with $( ) stay clean.
exec 3>&1
ROWS=0
COLS=80
C_DIM=$'\e[2m' C_BOLD=$'\e[1m' C_GOLD=$'\e[33m' C_RED=$'\e[31m' C_GREEN=$'\e[32m' C_OFF=$'\e[0m'
SPIN=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
SPIN_I=0

term_size() { stty size </dev/tty 2>/dev/null || echo '24 80'; }

ui_setup() {
  ((UI_TTY)) || return 0
  read -r ROWS COLS < <(term_size)
  if ((ROWS < 10 || COLS < 30)); then
    # Too small for a pinned area, or a pty that reports 0 0: plain timeline from here on.
    UI_TTY=0
    printf '\e[r' >&3
    return 0
  fi
  {
    printf '\n%.0s' $(seq 1 4)
    tput csr 0 $((ROWS - 5))
    tput cup $((ROWS - 5)) 0
  } >&3
}

ui_teardown() {
  ((UI_TTY)) || return 0
  local r c
  read -r r c < <(term_size)
  {
    # \e[r resets the scroll region to the whole screen, whatever its size is now.
    printf '\e[r'
    ((r > 0)) && tput cup $((r - 1)) 0
    printf '\n\e]0;%s\a' 'Buzzr autopilot: stopped'
  } >&3 || true
}

ui_check_resize() {
  ((UI_TTY)) || return 0
  local r c
  read -r r c < <(term_size)
  if ((r != ROWS || c != COLS)); then
    tput clear >&3
    ui_setup
  fi
}

# Globals the status reads. The session reader (a subshell) updates its own copies.
RUN_START=$(date +%s)
SESSION_START=0
FEATURE='' FEATURE_TITLE='' ATTEMPT=0
PHASE='starting'
LAST='—'
TOOLS=0 EDITS=0
SESSION_COST=0 TOTAL_COST=0
RL_5H='' RL_7D=''
START_TODO=0 DONE_IN_RUN=0 RM_DONE=0 RM_TOTAL=0

fmt_dur() {
  local s=$1
  if ((s >= 3600)); then
    printf '%dh%02dm' $((s / 3600)) $((s % 3600 / 60))
  else
    printf '%dm%02ds' $((s / 60)) $((s % 60))
  fi
}

pct() {
  if [[ -n $1 ]]; then awk -v u="$1" 'BEGIN { printf "%d%%", u * 100 + 0.5 }'; else printf '?'; fi
}

bar() {
  local done=$1 total=$2 width=20 fill=0 out='' i
  ((total > 0)) && fill=$((done * width / total))
  for ((i = 0; i < width; i++)); do
    if ((i < fill)); then out+='█'; else out+='░'; fi
  done
  printf '%s' "$out"
}

render_status() {
  local now l1 l2 l3 elapsed sess=''
  now=$(date +%s)
  elapsed=$(fmt_dur $((now - RUN_START)))
  ((SESSION_START > 0)) && sess=" · $(fmt_dur $((now - SESSION_START)))"
  SPIN_I=$(((SPIN_I + 1) % ${#SPIN[@]}))
  l1="Buzzr autopilot  [$(bar "$DONE_IN_RUN" "$START_TODO")] $DONE_IN_RUN/$START_TODO this run · roadmap $RM_DONE/$RM_TOTAL · ⏱ $elapsed · ≈\$$(printf '%.2f' "$TOTAL_COST")"
  if [[ -n $FEATURE ]]; then
    l2="${SPIN[SPIN_I]} $FEATURE $FEATURE_TITLE · attempt $ATTEMPT/$MAX_ATTEMPTS$sess · $PHASE"
  else
    l2="${SPIN[SPIN_I]} $PHASE"
  fi
  l3="last: $LAST · $TOOLS tools · $EDITS edits"
  [[ -n $RL_5H ]] && l3+=" · 5h $(pct "$RL_5H") · 7d $(pct "$RL_7D")"

  printf '%s\n%s\n%s\n' "$l1" "$l2" "$l3" >"$RUN/status.txt" 2>/dev/null || true
  ((UI_TTY)) || return 0
  ui_check_resize
  {
    tput sc
    tput cup $((ROWS - 4)) 0
    tput el
    printf '%s' "$C_DIM${C_GOLD}$(printf '━%.0s' $(seq 1 "$COLS"))$C_OFF"
    tput cup $((ROWS - 3)) 0
    tput el
    printf '%s' "$C_BOLD${l1:0:COLS-1}$C_OFF"
    tput cup $((ROWS - 2)) 0
    tput el
    printf '%s' "$C_GOLD${l2:0:COLS-1}$C_OFF"
    tput cup $((ROWS - 1)) 0
    tput el
    printf '%s' "$C_DIM${l3:0:COLS-1}$C_OFF"
    tput rc
    printf '\e]0;%s\a' "Buzzr $DONE_IN_RUN/$START_TODO · ${FEATURE:-$PHASE}"
  } >&3
}

# log LEVEL message. LEVEL: info | ok | warn | err | dim
log() {
  local level=$1 color=''
  shift
  local line
  line="$(date +%T) $*"
  printf '%s\n' "$line" >>"$RUN_LOG"
  case $level in
    ok) color=$C_GREEN ;;
    warn) color=$C_GOLD ;;
    err) color=$C_RED ;;
    dim) color=$C_DIM ;;
  esac
  if ((UI_TTY)); then
    printf '%s\n' "$color${line:0:COLS}$C_OFF" >&3
    render_status
  else
    printf '%s\n' "$line" >&3
  fi
}

notify() {
  command -v notify-send >/dev/null && notify-send -a 'Buzzr autopilot' "$1" "${2:-}" 2>/dev/null || true
}

# Sleep while keeping the status line alive.
wait_with_status() {
  local seconds=$1 label=$2 end
  end=$(($(date +%s) + seconds))
  while (($(date +%s) < end)); do
    PHASE="$label · $(fmt_dur $((end - $(date +%s)))) left"
    render_status
    sleep 1
  done
}

# secs N: a fixed wait or poll interval, shortened by AUTOPILOT_WAIT_DIVISOR in tests.
secs() {
  local s=$(($1 / WAIT_DIVISOR))
  echo $((s > 0 ? s : 1))
}

die() {
  log err "STOP: $*"
  notify 'Autopilot stopped' "$*"
  exit 1
}

cleanup() {
  local rc=$?
  stop_session
  kill_strays
  {
    echo "Buzzr autopilot run $(basename "$RUN")"
    echo "exit code: $rc"
    echo "duration: $(fmt_dur $(($(date +%s) - RUN_START)))"
    echo "features committed this run: $DONE_IN_RUN of $START_TODO"
    echo "approx. API cost: \$$(printf '%.2f' "$TOTAL_COST")"
    echo "roadmap: $(roadmap_next | grep -E '^(Done|In progress|Blocked):' | paste -sd' ' -)"
    echo "stashes made by autopilot:"
    git stash list | grep 'autopilot:' || echo "  none"
    echo "commits this run:"
    git log --oneline "$RUN_HEAD_AT_START..HEAD" -- . 2>/dev/null || true
  } >"$RUN/summary.txt" 2>&1 || true
  ui_teardown
  {
    echo
    cat "$RUN/summary.txt" 2>/dev/null || true
    echo "Logs: $RUN"
  } >&3
}

# ---------------------------------------------------------------------------------------------
# Repo helpers

roadmap_next() { "${ROADMAP_JS[@]}" next 2>/dev/null; }

# The feature the roadmap would build now ("Resume:" or "Next eligible:"), or nothing.
next_target() {
  roadmap_next | sed -nE 's/^(Resume|Next eligible): ([FB][0-9]+[a-z]?).*/\2/p' | head -1
}

refresh_counts() {
  local line
  line=$(roadmap_next | sed -nE 's/^Done: ([0-9]+)\/([0-9]+).*/\1 \2/p')
  RM_DONE=${line% *}
  RM_TOTAL=${line#* }
  DONE_IN_RUN=$((RM_DONE - RM_DONE_AT_START))
  # A session may split a feature (F95 into F95a and F95b), which grows the total.
  START_TODO=$((DONE_IN_RUN + RM_TOTAL - RM_DONE))
}

feature_title() { sed -nE "s/^- \[.\] $1 (.*)/\1/p" docs/ROADMAP.md | head -1; }
feature_mark() { sed -nE "s/^- \[(.)\] $1 .*/\1/p" docs/ROADMAP.md | head -1; }
dirty() { [[ -n $(git status --porcelain --untracked-files=all -- .) ]]; }

# Kill dev servers (3000, 5173) left behind by an earlier session, only if they run from buzzer/.
kill_strays() {
  local pid cwd
  for pid in $(ss -ltnpH '( sport = :3000 or sport = :5173 )' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
    if [[ $cwd == "$BUZZER" || $cwd == "$BUZZER"/* ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

stash_changes() {
  local msg=$1
  if dirty; then
    git stash push --include-untracked -m "autopilot: $msg" -- . >/dev/null
    log warn "Stashed uncommitted changes as \"autopilot: $msg\" ($(git stash list | head -1 | cut -d: -f1))"
  fi
}

commit_docs() {
  local msg=$1 f files=()
  for f in docs/ROADMAP.md docs/DECISIONS.md docs/PROGRESS.md; do
    [[ -n $(git status --porcelain -- "$f") ]] && files+=("$f")
  done
  ((${#files[@]})) || return 0
  git add -- "${files[@]}"
  # Only these files: a blocked session may have staged half-built code as well.
  git commit -q -m "$msg" -m "Recorded by scripts/autopilot.sh while running unattended." -- "${files[@]}"
  log info "Committed ${files[*]}: $msg"
}

run_gate() {
  local step
  : >"$RUN/gate.log"
  for step in format:check lint typecheck test build; do
    PHASE="checks: npm run $step"
    render_status
    if ! npm run "$step" >>"$RUN/gate.log" 2>&1; then
      log err "npm run $step failed (see $RUN/gate.log)"
      return 1
    fi
  done
  log ok "All checks green: format, lint, typecheck, tests, build"
}

# ---------------------------------------------------------------------------------------------
# Claude sessions

UNATTENDED_RULES=$(
  cat <<'EOF'
You are running unattended, launched by buzzer/scripts/autopilot.sh. Kim is away from the keyboard and cannot answer.
- Never ask questions and never wait for input. Wherever a skill or instruction says to ask Kim, choose the option a careful senior engineer would pick (simplest choice that meets the spec, the roadmap entry and docs/ux/ when it applies), record it in docs/DECISIONS.md, and continue.
- At the start, if buzzer/ has uncommitted changes and a roadmap feature is marked [~], they are an earlier unattended attempt at that feature: inspect them, keep what is sound, fix the rest, and resume. Never discard them.
- If buzzer/ has uncommitted changes and no feature is marked [~], put them aside with `git stash push --include-untracked -m "autopilot: unexplained changes" -- .` and continue.
- If Playwright or the playtest skill cannot run, write exact manual test steps in the PROGRESS entry instead and continue.
- The roadmap mark, the PROGRESS entry and any DECISIONS rows go into the feature's single commit.
- If a feature is genuinely blocked after three real fix attempts, mark it with roadmap.mjs as the skill describes, and leave the code uncommitted.
- Never push, deploy, run gh, ssh, docker or sudo, edit docs/SPEC.md, or touch files outside buzzer/. The script does the push and deploy.
- Build exactly one feature, commit it, then stop.
EOF
)

DISALLOWED=(
  'Bash(git push:*)' 'Bash(git reset:*)' 'Bash(git clean:*)' 'Bash(git checkout:*)'
  'Bash(git rebase:*)' 'Bash(git restore:*)' 'Bash(gh:*)' 'Bash(ssh:*)' 'Bash(scp:*)'
  'Bash(docker:*)' 'Bash(rm -rf:*)' 'Bash(sudo:*)' 'AskUserQuestion'
)
# Kim's user-level RTK hook rewrites some commands to `rtk <command>` before the deny list
# sees them (a real session ran `git push --dry-run` that way), so deny those forms too.
DISALLOWED+=(
  'Bash(rtk git push:*)' 'Bash(rtk git reset:*)' 'Bash(rtk git clean:*)'
  'Bash(rtk git checkout:*)' 'Bash(rtk git rebase:*)' 'Bash(rtk git restore:*)'
  'Bash(rtk gh:*)' 'Bash(rtk ssh:*)' 'Bash(rtk scp:*)' 'Bash(rtk docker:*)'
  'Bash(rtk rm -rf:*)' 'Bash(rtk sudo:*)' 'Bash(rtk proxy:*)'
)

# One line per stream-json event that matters, tab-separated. Non-JSON lines are skipped.
JQ_FILTER='
def clip(n): tostring | gsub("[\r\n\t]+"; " ") | if length > n then .[0:n] + "…" else . end;
fromjson? |
if .type == "system" and .subtype == "init" then
  "init\t" + (if any(.slash_commands[]?; . == "next-feature") then "1" else "0" end)
elif .type == "assistant" then
  (if (.parent_tool_use_id // "") == "" then "0" else "1" end) as $sub
  | (.message.content // [])[] | select(.type == "tool_use")
  | "tool\t\($sub)\t\(.name)\t" + ((.input.command // .input.file_path // .input.skill
      // .input.subagent_type // .input.description // .input.pattern // .input.url // "") | clip(160))
elif .type == "rate_limit_event" then
  .rate_limit_info as $r
  | "rl\t\($r.status // "")\t\($r.resetsAt // 0)\t\($r.unifiedWindows.five_hour.utilization // "")\t\($r.unifiedWindows.seven_day.utilization // "")"
elif .type == "result" then
  "result\t\(.subtype // "")\t\(.is_error // false)\t\(.total_cost_usd // 0)\t\(.duration_ms // 0)\t\(.num_turns // 0)\t" + ((.result // "") | clip(400))
else empty end'

# Reads the jq lines, logs the timeline and redraws the status once a second.
session_reader() {
  set +e
  local kind a b c d e f
  while :; do
    if IFS=$'\t' read -r -t 1 kind a b c d e f; then
      case $kind in
        init)
          [[ $a == 1 ]] || echo 1 >"$STATE/no_skill"
          ;;
        tool)
          TOOLS=$((TOOLS + 1))
          [[ $b =~ ^(Edit|Write|MultiEdit|NotebookEdit)$ ]] && EDITS=$((EDITS + 1))
          if [[ $a == 1 ]]; then
            LAST="↳ $b ${c:0:90}"
          else
            LAST="$b ${c:0:90}"
            case $b in
              Skill | Agent | Task) log info "  ▸ $b ${c:0:120}" ;;
              Bash)
                if [[ $c == *'git commit'* ]]; then log ok "  ▸ commit"; else log dim "  · $b ${c:0:120}"; fi
                ;;
              *) log dim "  · $b ${c:0:120}" ;;
            esac
          fi
          ;;
        rl)
          RL_5H=$c RL_7D=$d
          printf '%s\t%s\t%s\t%s\n' "$a" "$b" "$c" "$d" >"$STATE/rl"
          ;;
        result)
          printf '%s\n' "$a" >"$STATE/result_subtype"
          printf '%s\n' "$b" >"$STATE/result_is_error"
          printf '%s\n' "$c" >"$STATE/result_cost"
          printf '%s\n' "$f" >"$STATE/result_text"
          [[ $c =~ ^[0-9.eE+-]+$ ]] || c=0
          [[ $d =~ ^[0-9]+$ ]] || d=0
          log info "  session ended: $a · turns $e · $(fmt_dur $((d / 1000))) · ≈\$$(printf '%.2f' "$c")"
          ;;
      esac
      render_status
    else
      (($? > 128)) || break
      render_status
    fi
  done
}

# run_session LABEL PROMPT: one fresh claude -p session. Sets SESSION_RC.
# The pipeline runs in the background and the shell waits for it, so Ctrl-C and SIGTERM reach
# the traps at once instead of after the session (bash defers traps during a foreground job).
# timeout leads a process group of its own, which the terminal's Ctrl-C never reaches, so
# stop_session signals that group. The session gets neither the lock (fd 9) nor the UI (fd 3).
SESSION_PIPE=''
run_session() {
  local label=$1 prompt=$2 jsonl="$RUN/$1.jsonl" err="$RUN/$1.err"
  rm -f "$STATE"/result_* "$STATE/rc" "$STATE/no_skill" "$STATE/rl" "$STATE/session_pid"
  TOOLS=0 EDITS=0 LAST='starting session'
  SESSION_START=$(date +%s)
  kill_strays
  {
    local rc=0
    GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.pushurl \
      GIT_CONFIG_VALUE_0=autopilot-sessions-never-push GH_TOKEN=autopilot-sessions-never-use-gh \
      timeout --kill-after=60 "$SESSION_TIMEOUT" claude -p "$prompt" \
      --output-format stream-json --verbose \
      --dangerously-skip-permissions \
      --disallowedTools "${DISALLOWED[@]}" \
      --append-system-prompt "$UNATTENDED_RULES" \
      </dev/null 2>"$err" 3>&- 9>&- &
    echo $! >"$STATE/session_pid"
    wait $! || rc=$?
    echo "$rc" >"$STATE/rc"
  } | tee -a "$jsonl" | jq -R -r --unbuffered "$JQ_FILTER" 2>>"$err" | session_reader &
  SESSION_PIPE=$!
  wait || true
  SESSION_PIPE=''
  rm -f "$STATE/session_pid"
  SESSION_RC=$(cat "$STATE/rc" 2>/dev/null || echo 1)
  SESSION_COST=$(cat "$STATE/result_cost" 2>/dev/null || echo 0)
  TOTAL_COST=$(awk -v a="$TOTAL_COST" -v b="$SESSION_COST" 'BEGIN { printf "%.4f", a + b }')
  if [[ -f $STATE/rl ]]; then
    IFS=$'\t' read -r _ _ RL_5H RL_7D <"$STATE/rl" || true
  fi
  # The reader's counters lived in its own subshell; keep a summary for the status line.
  LAST="session $label ended (exit $SESSION_RC)"
  SESSION_START=0
  kill_strays
}

# Ctrl-C, SIGTERM or SIGHUP mid-session: end the session's process group, then its pipeline.
stop_session() {
  local pid i
  pid=$(cat "$STATE/session_pid" 2>/dev/null) || return 0
  if kill -0 "$pid" 2>/dev/null; then
    log warn "Stopping the running claude session…"
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for i in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
  fi
  if [[ -n $SESSION_PIPE ]]; then
    for i in $(seq 1 10); do
      kill -0 "$SESSION_PIPE" 2>/dev/null || break
      sleep 0.5
    done
    kill "$SESSION_PIPE" 2>/dev/null || true
  fi
  rm -f "$STATE/session_pid"
}

# Was the session stopped by a usage limit or an overloaded API? Echo "limit EPOCH" or "busy".
# Only a session that errored or died counts: one that ended normally chose to stop, and its
# last message may well mention rate limits or a 503 in the code it was working on. A timeout
# is a failed attempt, not a blocker.
session_blocker() {
  local text status=allowed resets=0
  [[ $(cat "$STATE/result_is_error" 2>/dev/null) == false ]] && return 0
  ((SESSION_RC == 124 || SESSION_RC == 137)) && return 0
  text="$(cat "$STATE/result_text" "$RUN/$1.err" 2>/dev/null || true)"
  if [[ -f $STATE/rl ]]; then
    IFS=$'\t' read -r status resets _ _ <"$STATE/rl" || true
  fi
  if [[ $status != allowed && $status != allowed_warning && -n $status ]] ||
    grep -qiE 'usage limit|limit reached|hit your limit|5-hour limit|weekly limit|rate_limit_error|API Error: 429' <<<"$text"; then
    echo "limit $resets"
  elif grep -qiE 'API Error|overloaded|Connection error|Request timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up' <<<"$text"; then
    echo busy
  fi
  return 0
}

# Sleep until a usage limit resets (plus 2 min), or back off when the reset time is unknown.
LIMIT_WAITS=0
wait_for_limit() {
  local resets=$1 now wait
  now=$(date +%s)
  LIMIT_WAITS=$((LIMIT_WAITS + 1))
  [[ $resets =~ ^[0-9]+$ ]] || resets=0
  ((resets > 100000000000)) && resets=$((resets / 1000)) # milliseconds
  if ((resets > now && resets < now + 8 * 86400)); then
    wait=$((resets - now + $(secs 120)))
  else
    wait=$(secs $((LIMIT_WAITS >= 3 ? 3600 : LIMIT_WAITS == 2 ? 1800 : 900)))
  fi
  log warn "Usage limit hit. Waiting $(fmt_dur "$wait") (until $(date -d "@$((now + wait))" '+%a %H:%M'))."
  notify 'Usage limit' "Waiting $(fmt_dur "$wait")"
  wait_with_status "$wait" 'usage limit'
}

feature_prompt() {
  if [[ -f $STATE/inline_skill ]]; then
    awk 'BEGIN { n = 0 } /^---$/ && n < 2 { n++; next } n >= 2' .claude/skills/next-feature/SKILL.md |
      sed 's/\$ARGUMENTS/(none: pick the next eligible one)/g'
  else
    printf '/next-feature'
  fi
}

# ---------------------------------------------------------------------------------------------
# Preflight

RUN_HEAD_AT_START=$(git rev-parse HEAD)
RM_DONE_AT_START=0
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
# errexit stops the script without a word; leave the failing command in run.log.
# Only the main shell: inside $( ) a failing grep is routine.
err_note() {
  ((BASH_SUBSHELL == 0)) || return 0
  printf '%s command failed (exit %s) at line %s: %s\n' "$(date +%T)" "$1" "$2" "$3" >>"$RUN_LOG"
}
trap 'err_note "$?" "$LINENO" "$BASH_COMMAND"' ERR
ui_setup
log info "Buzzr autopilot · logs in $RUN"
((DRY_RUN)) && log warn "Dry run: nothing is built, pushed or deployed."

for tool in claude node npm git gh jq curl ss timeout; do
  command -v "$tool" >/dev/null || die "missing tool: $tool"
done
gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth login)"
[[ $(git rev-parse --abbrev-ref HEAD) == main ]] || die "not on main"
git fetch -q origin main 2>>"$RUN_LOG" || log warn "git fetch failed; continuing offline until the push"

RM_DONE_AT_START=$(roadmap_next | sed -nE 's/^Done: ([0-9]+)\/.*/\1/p') || true
[[ -n $RM_DONE_AT_START ]] || die "roadmap.mjs did not report progress"
refresh_counts
log info "Roadmap: $RM_DONE/$RM_TOTAL done, $START_TODO to build."

RESUMING=0
if dirty; then
  if roadmap_next | grep -q '^Resume:'; then
    RESUMING=1
    log warn "Uncommitted changes belong to the [~] feature; the first session resumes them."
  elif ((DRY_RUN)); then
    log warn "buzzer/ has uncommitted changes; a real run would refuse to start."
  else
    # Kim is still at the keyboard at this point, so ask for a clean tree rather than stash.
    die "buzzer/ has uncommitted changes; commit or stash them, then start again"
  fi
fi

if ((DRY_RUN)); then
  log info "Skipping the baseline checks in a dry run."
elif ((RESUMING)); then
  # Half-built work is not expected to pass yet; the session's own verify step checks it.
  log info "Skipping the baseline checks: they would run on the [~] feature's unfinished work."
else
  PHASE='baseline checks'
  log info "Baseline checks before the first feature…"
  run_gate || die "the checks fail before any feature is built; fix main first"
fi

# ---------------------------------------------------------------------------------------------
# Feature loop

declare -A ATTEMPTS=()
SESSIONS=0
GIVEUPS_IN_A_ROW=0
BUSY_WAITS=0

while :; do
  refresh_counts
  FEATURE=$(next_target)
  [[ -n $FEATURE ]] || break
  FEATURE_TITLE=$(feature_title "$FEATURE")
  ATTEMPTS[$FEATURE]=$((${ATTEMPTS[$FEATURE]:-0} + 1))
  ATTEMPT=${ATTEMPTS[$FEATURE]}
  PHASE='building'

  if ((DRY_RUN)); then
    log info "Would run: claude -p \"$(feature_prompt | head -c 60)\" for $FEATURE $FEATURE_TITLE"
    log info "Then: final checks, git push origin main, watch $WORKFLOW, force on live games, check $LIVE_URL/healthz"
    FEATURE=''
    PHASE='dry run complete'
    render_status
    exit 0
  fi

  ((SESSIONS < MAX_SESSIONS)) || die "reached $MAX_SESSIONS sessions; something is wrong"
  SESSIONS=$((SESSIONS + 1))
  before=$(git rev-parse HEAD)
  log info "━━ $FEATURE $FEATURE_TITLE · attempt $ATTEMPT/$MAX_ATTEMPTS · session $SESSIONS"
  run_session "$FEATURE-a$ATTEMPT" "$(feature_prompt)"

  mark=$(feature_mark "$FEATURE")
  new_feat=$(git log --format=%s "$before..HEAD" -- . | grep -c '^feat(buzzer): ' || true)

  if [[ $mark == '!' ]]; then
    log err "$FEATURE was marked blocked: $(sed -n "/^- \[!\] $FEATURE /,/^- \[/p" docs/ROADMAP.md | grep -m1 'Blocked:' | sed 's/^ *- //')"
    notify "$FEATURE blocked" "$FEATURE_TITLE"
    # Keep the marker and its notes; set the half-built code aside.
    commit_docs "docs(buzzer): $FEATURE blocked (autopilot)"
    stash_changes "$FEATURE blocked, uncommitted work"
    GIVEUPS_IN_A_ROW=$((GIVEUPS_IN_A_ROW + 1))
  elif [[ -f $STATE/no_skill && ! -f $STATE/inline_skill && $before == "$(git rev-parse HEAD)" ]]; then
    log warn "/next-feature was not recognised in headless mode; inlining its SKILL.md from now on."
    echo 1 >"$STATE/inline_skill"
    ATTEMPTS[$FEATURE]=$((ATTEMPT - 1))
    continue
  elif ((new_feat > 0)) && [[ $mark != '~' ]]; then
    log ok "✔ $FEATURE committed: $(git log -1 --format=%s -- .)"
    notify "$FEATURE done" "$FEATURE_TITLE"
    # Stray files (screenshots, a scratch note) would make the next session stop and stash.
    if dirty; then
      stash_changes "$FEATURE leftovers after its commit"
    fi
    GIVEUPS_IN_A_ROW=0
    BUSY_WAITS=0
    LIMIT_WAITS=0
  else
    blocker=$(session_blocker "$FEATURE-a$ATTEMPT")
    if [[ $blocker == limit* ]]; then
      ATTEMPTS[$FEATURE]=$((ATTEMPT - 1))
      wait_for_limit "${blocker#limit }"
      continue
    elif [[ $blocker == busy ]]; then
      ATTEMPTS[$FEATURE]=$((ATTEMPT - 1))
      BUSY_WAITS=$((BUSY_WAITS + 1))
      ((BUSY_WAITS <= 8)) || die "the API stayed unavailable through 8 retries"
      # 5, 10, 15 … 30 min: about 2.75 h in all before giving up on the API.
      busy_wait=$((BUSY_WAITS * 300 > 1800 ? 1800 : BUSY_WAITS * 300))
      log warn "API busy or network error; retrying in $(fmt_dur "$busy_wait") (retry $BUSY_WAITS/8)."
      wait_with_status "$(secs "$busy_wait")" 'API busy'
      continue
    fi
    if ((SESSION_RC == 124 || SESSION_RC == 137)); then
      log err "✘ $FEATURE attempt $ATTEMPT timed out after $SESSION_TIMEOUT (see $RUN/$FEATURE-a$ATTEMPT.jsonl)."
    else
      log err "✘ $FEATURE attempt $ATTEMPT did not finish (exit $SESSION_RC; see $RUN/$FEATURE-a$ATTEMPT.jsonl)."
    fi
    if ((ATTEMPT >= MAX_ATTEMPTS)); then
      log err "Giving up on $FEATURE after $ATTEMPT sessions."
      notify "Gave up on $FEATURE" "$FEATURE_TITLE"
      stash_changes "$FEATURE gave up after $ATTEMPT sessions"
      # An uncommitted split (F95 into F95a/F95b) went into the stash: mark the original.
      target=$FEATURE
      [[ -n $(feature_mark "$target") ]] || target=${FEATURE%[a-z]}
      "${ROADMAP_JS[@]}" mark "$target" '!' "autopilot: $ATTEMPT unattended sessions did not finish it; logs in $RUN" >/dev/null ||
        die "could not mark $target blocked in docs/ROADMAP.md"
      commit_docs "docs(buzzer): $target blocked (autopilot)"
      GIVEUPS_IN_A_ROW=$((GIVEUPS_IN_A_ROW + 1))
    else
      wait_with_status "$(secs 60)" 'retrying soon'
    fi
  fi
  ((GIVEUPS_IN_A_ROW < MAX_GIVEUPS_IN_A_ROW)) || die "$GIVEUPS_IN_A_ROW features in a row were blocked; stopping before burning the rest"
done

FEATURE=''
refresh_counts
summary=$(roadmap_next | grep -E '^(Done|Blocked|Not eligible)' | paste -sd' ' -)
log info "Roadmap loop finished: $summary"
if ! roadmap_next | grep -q '^Blocked: none'; then
  notify 'Autopilot finished with blocked features' "$summary"
  die "some features are blocked, so nothing is pushed or deployed (a push to buzzer/ deploys)"
fi
# No eligible feature but nothing blocked: a dependency is missing or circular.
roadmap_next | grep -q '^Nothing left' || die "features remain but none is eligible: $summary"
if ((DRY_RUN)); then
  log info "Dry run: nothing left to build. A real run would now run the checks, push and deploy."
  exit 0
fi

# ---------------------------------------------------------------------------------------------
# Final gate, push, deploy

# repair LABEL CONTEXT: one session that fixes failing checks. Waits out usage limits and API
# errors as the feature loop does, so they do not use up a repair.
repair() {
  local label=$1 context=$2 try=1 name blocker
  while :; do
    name=$label
    ((try == 1)) || name+="-r$try"
    run_session "$name" "Every roadmap feature is built and committed, but these checks fail:

$context

Fix only what makes them fail, without weakening, skipping or deleting tests. Run the verify skill until it is green, then make one commit: fix(buzzer): <what you fixed>. Do not start any roadmap feature."
    blocker=$(session_blocker "$name")
    [[ -n $blocker ]] || return 0
    ((try < 8)) || die "repair sessions kept hitting usage limits or API errors"
    if [[ $blocker == limit* ]]; then
      wait_for_limit "${blocker#limit }"
    else
      log warn "API busy or network error during a repair; retrying in 5 min."
      wait_with_status "$(secs 300)" 'API busy'
    fi
    try=$((try + 1))
  done
}

PHASE='final checks'
FEATURE_TITLE='' ATTEMPT=0
for try in 1 2 3; do
  run_gate && break
  ((try < 3)) || die "checks still fail after 2 repair sessions; nothing pushed"
  log warn "Repair session $try for the failing checks…"
  repair "repair-gate-$try" "$(tail -80 "$RUN/gate.log")"
  dirty && stash_changes "repair $try leftovers"
done

if ((!DEPLOY)); then
  log ok "All features built and checked. --no-deploy: not pushing."
  notify 'Autopilot done' 'Built and checked; not pushed (--no-deploy)'
  exit 0
fi

# Fetch, rebase onto origin/main if it moved, push. Each try fetches again, so a push that
# lost a race with another push rebases and goes again.
push_main() {
  local i
  PHASE='pushing'
  for i in 1 2 3; do
    if ! git fetch -q origin main >>"$RUN_LOG" 2>&1; then
      log warn "git fetch failed (try $i)."
    else
      if ! git merge-base --is-ancestor origin/main HEAD; then
        log warn "origin/main moved; rebasing onto it."
        if ! git -C "$REPO" rebase --autostash origin/main >>"$RUN_LOG" 2>&1; then
          git -C "$REPO" rebase --abort >/dev/null 2>&1 || true
          die "rebase onto origin/main conflicted; nothing pushed"
        fi
      fi
      if git push -q origin HEAD:main >>"$RUN_LOG" 2>&1; then
        log ok "Pushed $(git rev-parse --short HEAD) to origin/main."
        return 0
      fi
      log warn "git push failed (try $i)."
    fi
    ((i < 3)) || break
    log warn "Retrying the push in $((i * 30)) s."
    wait_with_status "$(secs $((i * 30)))" 'push retry'
  done
  die "git push failed three times"
}

# find_run EVENT SINCE_EPOCH [SHA]: newest matching deploy run id, waiting up to 5 min.
find_run() {
  local event=$1 since=$2 sha=${3:-} id='' i
  for i in $(seq 1 30); do
    id=$(gh run list --workflow "$WORKFLOW" --event "$event" --limit 10 \
      --json databaseId,createdAt,headSha 2>>"$RUN_LOG" |
      jq -r --arg sha "$sha" --argjson since "$since" \
        '[.[] | select(($sha == "" or .headSha == $sha) and ((.createdAt | fromdateiso8601) >= $since - 60))] | .[0].databaseId // empty' 2>>"$RUN_LOG")
    [[ -n $id ]] && {
      echo "$id"
      return 0
    }
    PHASE="waiting for the $WORKFLOW run to start"
    render_status
    sleep "$(secs 10)"
  done
  return 1
}

# watch_run ID: poll until done, showing the current step. Returns 0 on success. On failure it
# saves the failed log and the failed "job<TAB>step" names next to it.
watch_run() {
  local id=$1 json status conclusion step started unknown=0
  started=$(date +%s)
  log info "Watching deploy run $id: $(gh run view "$id" --json url --jq .url 2>>"$RUN_LOG")"
  while :; do
    json=$(gh run view "$id" --json status,conclusion,jobs 2>>"$RUN_LOG") || json='{}'
    status=$(jq -r '.status // "unknown"' <<<"$json" 2>/dev/null) || status=unknown
    conclusion=$(jq -r '.conclusion // ""' <<<"$json" 2>/dev/null) || conclusion=''
    step=$(jq -r '[.jobs[]?.steps[]? | select(.status == "in_progress") | .name] | first // ""' <<<"$json" 2>/dev/null) || step=''
    PHASE="deploy run $id: $status${step:+ · $step}"
    render_status
    if [[ $status == completed ]]; then
      [[ $conclusion == success ]] && return 0
      gh run view "$id" --log-failed >"$RUN/deploy-$id-failed.log" 2>&1 || true
      jq -r '.jobs[]? | .name as $job | .steps[]? | select(.conclusion == "failure") | "\($job)\t\(.name)"' \
        <<<"$json" >"$RUN/deploy-$id-failed-steps.txt" 2>/dev/null || true
      # Without step data, the log's own "job<TAB>step<TAB>line" prefixes name them.
      [[ -s $RUN/deploy-$id-failed-steps.txt ]] ||
        cut -f1,2 "$RUN/deploy-$id-failed.log" | grep $'\t' | sort -u >"$RUN/deploy-$id-failed-steps.txt" || true
      log err "Deploy run $id ended: $conclusion at $(paste -sd, "$RUN/deploy-$id-failed-steps.txt") (log: $RUN/deploy-$id-failed.log)"
      return 1
    fi
    if [[ $status == unknown ]]; then
      unknown=$((unknown + 1))
      ((unknown < 40)) || die "gh could not read deploy run $id for 10 min; check it by hand"
    else
      unknown=0
    fi
    (($(date +%s) - started < $(secs 5400))) || die "deploy run $id did not finish in 90 min; check it by hand"
    for _ in $(seq 1 "$(secs 15)"); do
      render_status
      sleep 1
    done
  done
}

dispatch_force() {
  local since id
  since=$(date +%s)
  log warn "Live connections blocked the deploy; dispatching with force=true (ends any live game)."
  notify 'Forcing deploy' 'Live connections blocked it; force=true ends any live game'
  gh workflow run "$WORKFLOW" --ref main -f force=true >>"$RUN_LOG" 2>&1 || die "gh workflow run failed"
  id=$(find_run workflow_dispatch "$since") || die "the forced deploy run never appeared"
  RUN_ID=$id
}

push_main
SHA=$(git rev-parse HEAD)
PUSHED_AT=$(date +%s)
RUN_ID=$(find_run push "$PUSHED_AT" "$SHA") || {
  log warn "No push-triggered deploy run appeared; dispatching one."
  gh workflow run "$WORKFLOW" --ref main >>"$RUN_LOG" 2>&1 || die "gh workflow run failed"
  RUN_ID=$(find_run workflow_dispatch "$PUSHED_AT") || die "no deploy run appeared"
}

# The workflow's own checks and image smoke test. A failure there is the code's, so it gets a
# repair session; anything else (ssh, the runner, the outside smoke check) gets one re-run.
CI_STEPS=$'^checks\t(typecheck|lint|format check|tests)$|\tbuild and smoke-test the image$'
REPAIRS=0
RERUNS=0
FORCED=0
until watch_run "$RUN_ID"; do
  failed_log="$RUN/deploy-$RUN_ID-failed.log"
  failed_steps=$(cat "$RUN/deploy-$RUN_ID-failed-steps.txt" 2>/dev/null || true)
  if grep -q 'live connection(s) after 10 min' "$failed_log" && ((FORCED == 0)); then
    FORCED=1
    dispatch_force
  elif grep -qE "$CI_STEPS" <<<"$failed_steps" && ((REPAIRS < 2)); then
    REPAIRS=$((REPAIRS + 1))
    log warn "CI checks failed; repair session $REPAIRS."
    before=$(git rev-parse HEAD)
    repair "repair-ci-$REPAIRS" "The GitHub Actions deploy run failed at: $failed_steps
Its failed-step log ends with:
$(tail -120 "$failed_log")"
    dirty && stash_changes "CI repair $REPAIRS leftovers"
    [[ $(git rev-parse HEAD) != "$before" ]] || die "the CI repair session committed nothing; code is pushed but not live"
    run_gate || die "local checks fail after the CI repair; not pushing again"
    push_main
    SHA=$(git rev-parse HEAD)
    PUSHED_AT=$(date +%s)
    RUN_ID=$(find_run push "$PUSHED_AT" "$SHA") || die "no deploy run appeared after the repair push"
  elif ((RERUNS == 0)); then
    RERUNS=1
    log warn "Deploy failed for another reason; re-running the failed jobs once."
    gh run rerun "$RUN_ID" --failed >>"$RUN_LOG" 2>&1 || die "gh run rerun failed"
    # Until GitHub requeues it, the run still reads completed/failure.
    for _ in $(seq 1 24); do
      [[ $(gh run view "$RUN_ID" --json status --jq .status 2>>"$RUN_LOG") == completed ]] || break
      sleep "$(secs 5)"
    done
  else
    notify 'Deploy failed' "Run $RUN_ID"
    die "deploy run $RUN_ID failed again; code is pushed but not live"
  fi
done

PHASE='checking the live site'
for i in 1 2 3 4 5; do
  if health=$(curl -fsS --max-time 10 "$LIVE_URL/healthz") && [[ $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$LIVE_URL/") == 200 ]]; then
    log ok "Live: $LIVE_URL/healthz → $health"
    notify 'Buzzr is live' "All $START_TODO features built and deployed"
    PHASE='done'
    exit 0
  fi
  log warn "Live check $i failed; retrying in 20 s."
  wait_with_status "$(secs 20)" 'live check'
done
die "the deploy succeeded but $LIVE_URL does not answer"
