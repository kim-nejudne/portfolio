#!/usr/bin/env bash
# Unattended roadmap runner for Pinpoint (rendered by the bootstrap-autopilot skill from the
# runner proven on two earlier apps). Builds every remaining docs/ROADMAP.md feature with one
# fresh `claude -p "/next-feature"` session each (a fresh session is the same as /clear), retries
# failures, gives blocked features one more pass, then gates, pushes and deploys to pinpoint.kimnejudne.dev
# once nothing is left. It also deploys once mid-run, right after the feature that writes the
# deploy workflow, so deploy problems show on day one; that early deploy never stops the build.
#
#   scripts/autopilot.sh [--dry-run] [--no-deploy] [--max-attempts N]
#
# --dry-run builds nothing. It checks the queue, the push guard, gh auth and the repo's deploy
# secrets, SSH reachability and disk on the droplet, and the live URL, then stops.
#
# It runs from a copy of itself (sessions never edit this file, and bash reads a script as it
# goes). Sessions run with --dangerously-skip-permissions and a hard deny list (push, reset,
# clean, checkout, rebase, remote, gh, ssh, scp, docker, rm -rf, sudo, roadmap ungate), inside
# bubblewrap with an empty ~/.ssh and gh config. Their environment also points origin's push URL
# nowhere, disables git's ssh and gives gh a dead token, so a push, ssh or gh call that slips past
# the deny list still fails. This script does the push and deploy itself, after the push guard
# (which also runs after every feature commit): the right remote, no secrets or agent files in
# the commits, and docs/spec.md and this file unchanged since the run started. A blocked feature
# doesn't stop the rest from shipping.
# Checks only Kim can do are queued under "Kim checks" in docs/PROGRESS.md; they never block the
# run. Features with a "Gate:" line wait for Kim and never block the deploy of the rest.
# Logs: ~/.cache/pinpoint-autopilot/<UTC timestamp>/ (run.log, status.txt, summary.txt,
# morning-report.md, one .jsonl per session, durations.tsv and rl.tsv for the ETA; later runs
# read earlier runs' durations). ~/.cache/pinpoint-autopilot/morning-report.md always points at
# the newest report.
#
# Test hooks (environment; unset in a real run): AUTOPILOT_SESSION_TIMEOUT (default 3h),
# AUTOPILOT_LIVE_URL (default https://pinpoint.kimnejudne.dev), AUTOPILOT_WAIT_DIVISOR (default 1; divides every
# fixed wait, backoff and poll interval, but not the wait for a usage-limit reset),
# AUTOPILOT_PLAIN=1 (no pinned status area), AUTOPILOT_OFFLINE=1 (dry runs and --no-deploy only: skip gh,
# ssh and the live URL, allow a local origin), AUTOPILOT_TEST=1 (the test harness: a local origin
# with the deploy on, driven by a fake gh). XDG_CACHE_HOME moves the logs and lock.

# Functions called from traps or through dry_check look unused to shellcheck; jq and sed
# programs are single-quoted on purpose.
# shellcheck disable=SC2329,SC2016,SC2017
set -Eeuo pipefail
shopt -s extglob

# ---------------------------------------------------------------------------------------------
# Options and paths

DRY_RUN=0
DEPLOY=1
MAX_ATTEMPTS=3
MAX_SESSIONS=150
MAX_GIVEUPS_IN_A_ROW=3
SESSION_TIMEOUT=${AUTOPILOT_SESSION_TIMEOUT:-3h}
LIVE_URL=${AUTOPILOT_LIVE_URL:-'https://pinpoint.kimnejudne.dev'}
WAIT_DIVISOR=${AUTOPILOT_WAIT_DIVISOR:-1}
OFFLINE=${AUTOPILOT_OFFLINE:-}
TEST=${AUTOPILOT_TEST:-}

# Project facts, rendered once by the bootstrap.
APP='pinpoint'
APP_TITLE='Pinpoint'
GH_REPO='kim-nejudne/portfolio'
REPO_VISIBILITY='public'
DROPLET='165.245.189.5'
HEALTH_PATH='/healthz'
WORKFLOW='deploy-pinpoint.yml'
# Exists once F01 has scaffolded the project; before that there is nothing to check.
SCAFFOLD_FILE='package.json'
# Monorepo mode: the app is pinpoint/ of kim-nejudne/portfolio. The run works in a git worktree of its
# own on BRANCH, so Kim keeps working (and committing) anywhere in the repo meanwhile. Only
# commits whose paths all match PUSH_ALLOWED are pushed: the app and a few named root files.
APP_DIR='pinpoint'
BRANCH='autopilot/pinpoint'
PUSH_ALLOWED='^(pinpoint/|\.github/workflows/(ci|deploy-pinpoint|deploy-hub)\.yml$|README\.md$|hub/)'
INSTALL_CMD='npm ci'
LOCKFILE='package-lock.json'
# The checks, in order: "name|command". The same list as the verify skill and CI.
GATE=(
  'format|npm run format:check'
  'lint|npm run lint'
  'typecheck|npm run typecheck'
  'test|npm test'
  'build|npm run build'
)
# Dev servers a session may leave behind (killed only when they run from this repo).
DEV_PORTS_SS='( sport = :3010 or sport = :5180 )'
# Deploy steps whose failure is the code's (a repair session), not the infrastructure's.
CI_STEPS=$'^checks\t(format|lint|typecheck|test|build)$|\tbuild and smoke-test the image$'
# Commits a feature session makes (the commit that proves a feature was built).
FEAT_RE='^feat(\([^)]*\))?: '
# The option loop shifts them away; the re-execs below need them all.
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
CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/$APP-autopilot
mkdir -p "$CACHE"

# Run from a copy: bash reads a script as it executes, so an edit to scripts/autopilot.sh while
# it runs would corrupt the run. AUTOPILOT_HOME carries the project directory across.
if [[ -z ${AUTOPILOT_HOME:-} ]]; then
  export AUTOPILOT_HOME
  AUTOPILOT_HOME=$(dirname -- "$(dirname -- "$SELF")")
  copy=$(mktemp "$CACHE/running.XXXXXX.sh")
  cp -- "$SELF" "$copy"
  chmod +x "$copy"
  exec "$copy" "${ORIG_ARGS[@]}"
fi
PROJECT=$AUTOPILOT_HOME
cd "$PROJECT"
REPO=$(git rev-parse --show-toplevel)
# Kim's checkout. PROJECT and REPO move to the worktree once preflight has checked the launch.
CHECKOUT=$PROJECT
CHECKOUT_REPO=$REPO
WORKTREE=$CACHE/worktree
# Set once the deploy is live: the cleanup then removes the worktree and its branch.
WORKTREE_REMOVE=0
if [[ ${PROJECT#"$REPO"/} != "$APP_DIR" ]]; then
  echo "This runner is for $APP_DIR/ of its repo, but it sits in ${PROJECT#"$REPO"/}/." >&2
  exit 1
fi
# Client engagements never use Kim's droplet, accounts or this runner.
case $PROJECT/ in
  "$HOME"/Documents/work/*)
    echo "$PROJECT is a client engagement (~/Documents/work); this runner is for personal apps only." >&2
    exit 1
    ;;
esac
ROADMAP_JS=(node .claude/scripts/roadmap.mjs)

# Keep the machine awake for the whole run (Kim is away). Re-exec once under systemd-inhibit.
if [[ -z ${AUTOPILOT_INHIBITED:-} ]] && command -v systemd-inhibit >/dev/null &&
  systemd-inhibit --what=idle:sleep:handle-lid-switch --who="$APP-autopilot" --why=probe true 2>/dev/null; then
  export AUTOPILOT_INHIBITED=1
  exec systemd-inhibit --what=idle:sleep:handle-lid-switch --who="$APP-autopilot" \
    --why="$APP_TITLE autopilot is building the roadmap" --mode=block "$SELF" "${ORIG_ARGS[@]}"
fi
# Children never inherit fd 9 (see run_session), so a stray dev server cannot keep the lock.
exec 9>"$CACHE/lock"
if ! flock -n 9; then
  echo "Another autopilot run holds $CACHE/lock." >&2
  exit 1
fi

RUN="$CACHE/$(date -u +%Y%m%dT%H%M%SZ)"
# Two runs in the same second (a quick dry run, then the real one) must not share a log dir.
[[ -e $RUN ]] && RUN+="-$$"
STATE="$RUN/state"
mkdir -p "$STATE"
RUN_LOG="$RUN/run.log"

# ---------------------------------------------------------------------------------------------
# Terminal UI: a scrolling timeline with a pinned status area at the bottom. Its height follows
# the terminal: 10 rows (a rule, the feature queue, three status rows) from 30 rows up, 5 (the
# queue as a one-line strip) from 16, otherwise 4.

UI_TTY=0
[[ -t 1 && -z ${AUTOPILOT_PLAIN:-} ]] && UI_TTY=1
# All UI output goes to fd 3, so functions whose stdout is captured with $( ) stay clean.
exec 3>&1
ROWS=0
COLS=80
PIN=4
RULE=''
C_DIM=$'\e[2m' C_BOLD=$'\e[1m' C_GOLD=$'\e[33m' C_RED=$'\e[31m' C_GREEN=$'\e[32m' C_OFF=$'\e[0m'
C_BLUE=$'\e[34m' C_MAGENTA=$'\e[35m' C_CYAN=$'\e[36m'
# The spinners are read through a nameref (P_SPIN) in render_status.
# shellcheck disable=SC2034
{
  SPIN_BRAILLE=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  SPIN_DOTS=(⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷)
  SPIN_CLOCK=(◴ ◷ ◶ ◵)
  SPIN_PULSE=(⇡ ⇡ ↑ ' ')
  SPIN_NONE=(' ')
}
SPIN_I=0
EIGHTHS=('' ▏ ▎ ▍ ▌ ▋ ▊ ▉)
LEVELS=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █)
# Phase icons are emoji, two cells wide; fit() counts them so a pinned row never wraps.
# Without a UTF-8 locale they fall back to ASCII.
EMOJI=1
[[ $(locale charmap 2>/dev/null) == UTF-8 ]] || EMOJI=0
P_ICON='' P_COLOR='' P_SPIN=SPIN_BRAILLE

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
  if ((ROWS >= 30)); then
    PIN=10
  elif ((ROWS >= 16)); then
    PIN=5
  else
    PIN=4
  fi
  RULE=$(printf '━%.0s' $(seq 1 "$COLS"))
  {
    printf '\n%.0s' $(seq 1 "$PIN")
    tput csr 0 $((ROWS - PIN - 1))
    tput cup $((ROWS - PIN - 1)) 0
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
    printf '\n\e]0;%s\a' "$APP_TITLE autopilot: stopped"
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
FEATURE='' FEATURE_TITLE='' FEATURE_MS='' ATTEMPT=0
PHASE='starting'
LAST='—'
TOOLS=0 EDITS=0
SESSION_COST=0 TOTAL_COST=0
RL_5H='' RL_7D=''
START_TODO=0 DONE_IN_RUN=0 RM_DONE=0 RM_TOTAL=0

fmt_dur() {
  local s=$1
  if ((s >= 86400)); then
    printf '%dd%02dh' $((s / 86400)) $((s % 86400 / 3600))
  elif ((s >= 3600)); then
    printf '%dh%02dm' $((s / 3600)) $((s % 3600 / 60))
  else
    printf '%dm%02ds' $((s / 60)) $((s % 60))
  fi
}

# bar DONE TOTAL [WIDTH]: a progress bar drawn in eighths of a cell.
bar() {
  local done=$1 total=$2 width=${3:-20} e=0 full part out='' i
  ((total > 0)) && e=$((done * width * 8 / total))
  ((e < 0)) && e=0
  ((e > width * 8)) && e=$((width * 8))
  full=$((e / 8)) part=$((e % 8))
  for ((i = 0; i < full; i++)); do out+='█'; done
  if ((part > 0)); then
    out+=${EIGHTHS[part]}
    full=$((full + 1))
  fi
  for ((i = full; i < width; i++)); do out+='░'; done
  printf '%s' "$out"
}

# gauge UTIL: a usage level such as "▅ 25%": green under 70 %, gold under 90 %, red above.
gauge() {
  local p color
  if [[ ! $1 =~ ^[0-9.eE+-]+$ ]]; then
    printf '?'
    return 0
  fi
  p=$(awk -v u="$1" 'BEGIN { printf "%d", u * 100 + 0.5 }')
  if ((p < 70)); then
    color=$C_GREEN
  elif ((p < 90)); then
    color=$C_GOLD
  else
    color=$C_RED
  fi
  printf '%s%s %d%%%s' "$C_OFF$color" "${LEVELS[p >= 100 ? 7 : p * 8 / 100]}" "$p" "$C_OFF$C_DIM"
}

# phase_style: the icon, colour and spinner for the current PHASE.
phase_style() {
  local icon ascii color=$C_GOLD spin=SPIN_BRAILLE
  case $PHASE in
    building*) icon=🔨 ascii='#' ;;
    'baseline checks'* | 'final checks'* | checks:*) icon=🧪 ascii='?' color=$C_CYAN spin=SPIN_DOTS ;;
    repairing*) icon=🩹 ascii='+' color=$C_MAGENTA ;;
    'usage limit'* | 'API busy'*) icon=⏳ ascii='~' color=$C_RED spin=SPIN_CLOCK ;;
    'retrying soon'*) icon=🔁 ascii='~' spin=SPIN_CLOCK ;;
    pushing* | 'push retry'*) icon=📤 ascii='^' color=$C_BLUE spin=SPIN_PULSE ;;
    'waiting for the'* | 'deploy run'*) icon=🚀 ascii='>' color=$C_MAGENTA ;;
    'checking the live site'* | 'live check'*) icon=🌐 ascii='@' color=$C_GREEN ;;
    done*) icon=🎉 ascii='*' color=$C_GREEN spin=SPIN_NONE ;;
    *) icon=🔧 ascii='.' color=$C_DIM ;;
  esac
  ((EMOJI)) || icon=$ascii
  P_ICON=$icon P_COLOR=$color P_SPIN=$spin
}

# fit TEXT WIDTH: sets FIT to TEXT cut to WIDTH terminal cells, then a colour reset. Escape
# sequences take no cells; the emoji the UI uses take two.
FIT=''
fit() {
  local s=$1 max=$2 w=0 i ch cp cw esc
  FIT=''
  for ((i = 0; i < ${#s}; i++)); do
    ch=${s:i:1}
    if [[ $ch == $'\e' ]]; then
      esc=${s:i}
      esc=${esc%%m*}m
      FIT+=$esc
      i=$((i + ${#esc} - 1))
      continue
    fi
    printf -v cp '%d' "'$ch"
    if ((cp >= 0x1F000 || cp == 0x23F3)); then cw=2; else cw=1; fi
    ((w + cw <= max)) || break
    FIT+=$ch
    w=$((w + cw))
  done
  FIT+=$C_OFF
}

# plain TEXT: TEXT without colour escapes, for status.txt.
plain() { printf '%s' "${1//$'\e'\[+([0-9;])m/}"; }

# ---------------------------------------------------------------------------------------------
# ETA: the features left times the median feature, plus the final checks, push and deploy (the
# "tail"), plus usage-limit waits: the one under way and the ones the 5h/7d trend predicts.

FEAT_MEDIAN=900
TAIL_EST=360
declare -A FEAT_DUR=() FEAT_START=() FEAT_WAITED=()
TAIL_START=0 WAIT_END=0 WAIT_LIMIT=0
ETA_SECS=0 ETA_WAIT=0 ETA_AT=0 ETA_TXT='…' ETA_LEFT='…'

# Feature wall times and tail times from earlier runs: a run's durations.tsv when it wrote one,
# otherwise its run.log timeline (first attempt to commit, less usage-limit and API waits).
# Prints "D id seconds" per feature, then "M median" (newest 20) and "T tail median".
HIST_AWK='
function secs(s, a) { split(s, a, ":"); return a[1] * 3600 + a[2] * 60 + a[3] }
function dur(s, t, n, u) {
  t = 0
  while (match(s, /^[0-9]+[dhms]/)) {
    n = substr(s, 1, RLENGTH - 1) + 0; u = substr(s, RLENGTH, 1)
    t += n * (u == "d" ? 86400 : u == "h" ? 3600 : u == "m" ? 60 : 1)
    s = substr(s, RLENGTH + 1)
  }
  return t
}
function median(a, n, k, b, i, j, m, x) {
  m = 0
  for (i = (n > k ? n - k : 0); i < n; i++) b[m++] = a[i]
  for (i = 1; i < m; i++) { x = b[i]; for (j = i - 1; j >= 0 && b[j] > x; j--) b[j + 1] = b[j]; b[j + 1] = x }
  return m ? (m % 2 ? b[int(m / 2)] : int((b[m / 2 - 1] + b[m / 2]) / 2)) : -1
}
FNR == 1 { day = 0; prev = -1; t0 = -1; cur = ""; split("", start); split("", waited) }
FILENAME ~ /durations\.tsv$/ {
  if ($2 ~ /^[0-9]+$/) { s[n++] = $2; print "D\t" $1 "\t" $2 }
  next
}
$1 ~ /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]$/ {
  t = secs($1); if (prev >= 0 && t < prev) day += 86400; prev = t; t += day
  if ($2 == "━━") { cur = $3; if ($0 ~ / · attempt 1\//) { start[cur] = t; waited[cur] = 0 } }
  else if ($2 == "✔" && $4 ~ /^committed/) {
    if ($3 in start) { d = t - start[$3] - waited[$3]; s[n++] = d; print "D\t" $3 "\t" d; delete start[$3] }
  }
  else if ($2 == "Usage" && $5 == "Waiting") waited[cur] += dur($6)
  else if ($2 == "API" && $3 == "busy") { for (i = 4; i < NF; i++) if ($i == "in") { waited[cur] += dur($(i + 1)); break } }
  else if ($2 == "Roadmap" && $3 == "loop") t0 = t
  else if ($2 == "Live:" && t0 >= 0) { tl[m++] = t - t0; t0 = -1 }
}
END { print "M\t" median(s, n, 20); print "T\t" median(tl, m, 10) }'

load_history() {
  local d kind a b files=()
  for d in "$CACHE"/2*/; do
    if [[ -f $d/durations.tsv ]]; then
      files+=("$d/durations.tsv")
    elif [[ -f $d/run.log ]]; then
      files+=("$d/run.log")
    fi
  done
  ((${#files[@]})) || return 0
  FEAT_DUR=()
  while IFS=$'\t' read -r kind a b; do
    case $kind in
      D) FEAT_DUR[$a]=$b ;;
      M) if ((a > 0)); then FEAT_MEDIAN=$a; fi ;;
      T) if ((a > 0)); then TAIL_EST=$a; fi ;;
    esac
  done < <(awk "$HIST_AWK" "${files[@]}" 2>/dev/null)
  return 0
}

# Predicted usage-limit waits for W seconds of building from START. Input: this run's
# rl.tsv (epoch, 5h utilization, 5h reset, 7d utilization, 7d reset). A window's burn rate is
# its rise since its last reset, over at least 10 min; when it would reach 100 %, the build
# waits for that reset plus 2 min, as wait_for_limit does.
ETA_AWK='
BEGIN { FS = "\t"; P[1] = 18000; P[2] = 604800 }
{
  for (w = 1; w <= 2; w++) {
    uv = $(2 * w); rv = $(2 * w + 1) + 0
    if (uv == "" || rv <= 0) continue
    if (rv > 100000000000) rv = int(rv / 1000)
    if (!(w in R) || rv != R[w]) { T0[w] = $1; U0[w] = uv + 0; R[w] = rv }
    T[w] = $1; U[w] = uv + 0
  }
}
END {
  t = start; work = W; wait = 0
  for (w = 1; w <= 2; w++) {
    if (!(w in R)) continue
    span = T[w] - T0[w]
    rate[w] = (span >= 600 && U[w] > U0[w]) ? (U[w] - U0[w]) / span : 0
    u[w] = U[w]; r[w] = R[w]
    while (r[w] <= t) { u[w] = 0; r[w] += P[w] }
  }
  for (it = 0; work > 0 && it < 1000; it++) {
    step = work; hit = 0
    for (w = 1; w <= 2; w++) {
      if (!(w in R)) continue
      if (r[w] - t < step) { step = r[w] - t; hit = -w }
      if (rate[w] > 0) { tf = (1 - u[w]) / rate[w]; if (tf < 0) tf = 0; if (tf < step) { step = tf; hit = w } }
    }
    t += step; work -= step
    for (w = 1; w <= 2; w++) if (w in R) u[w] += rate[w] * step
    if (hit > 0) { x = r[hit] + 120 - t; if (x > 0) { t += x; wait += x } }
    for (w = 1; w <= 2; w++) if (w in R) while (r[w] <= t) { u[w] = 0; r[w] += P[w] }
    if (hit > 0) u[hit] = 0
  }
  print int(wait)
}'

# eta_compute [force]: sets ETA_SECS, ETA_WAIT (the usage-limit part), ETA_TXT ("~1h05m") and
# ETA_LEFT ("~1h05m left"). Recomputed at most every 15 s unless forced.
eta_compute() {
  local now build=0 tail el known=0 pred=0 left=$Q_LEFT wait_txt=''
  printf -v now '%(%s)T' -1
  case $PHASE in
    done* | 'dry run'*)
      ETA_SECS=0 ETA_WAIT=0 ETA_TXT='—' ETA_LEFT='done'
      return 0
      ;;
  esac
  if ((!${1:-0} && now - ETA_AT < 15)); then return 0; fi
  ETA_AT=$now
  if ((TAIL_START == 0)); then
    if [[ -n $FEATURE && -n ${FEAT_START[$FEATURE]:-} ]] && ((left > 0)); then
      el=$((now - ${FEAT_START[$FEATURE]} - ${FEAT_WAITED[$FEATURE]:-0}))
      build=$((FEAT_MEDIAN - el > 60 ? FEAT_MEDIAN - el : 60))
      build=$((build + FEAT_MEDIAN * (left - 1)))
    else
      build=$((FEAT_MEDIAN * left))
    fi
    tail=$TAIL_EST
  else
    tail=$((TAIL_EST - (now - TAIL_START)))
    ((tail > 30)) || tail=30
  fi
  # Without the deploy, the tail is only the final checks.
  if ((!DEPLOY && tail > 120)); then tail=120; fi
  if ((WAIT_END > now)); then known=$((WAIT_END - now)); fi
  if ((build > 0)) && [[ -s $RUN/rl.tsv ]]; then
    pred=$(awk -v start=$((now + known)) -v W="$build" "$ETA_AWK" "$RUN/rl.tsv" 2>/dev/null) || pred=0
    [[ $pred =~ ^[0-9]+$ ]] || pred=0
  fi
  ETA_SECS=$((known + build + pred + tail))
  ETA_WAIT=$((pred + (WAIT_LIMIT ? known : 0)))
  if ((ETA_WAIT >= 300)); then
    wait_txt=" ($( ((EMOJI)) && printf '⏳' || printf 'wait') ~$(fmt_dur "$ETA_WAIT") limit)"
  fi
  ETA_TXT="~$(fmt_dur "$ETA_SECS")$wait_txt"
  ETA_LEFT="~$(fmt_dur "$ETA_SECS") left$wait_txt"
  return 0
}

# ---------------------------------------------------------------------------------------------
# Feature queue: the two newest committed features, the one being built, the next three.

Q_DONE=() Q_NEXT=() Q_LEFT=0
queue_refresh() {
  local lines=() i
  mapfile -t lines < <(git log --format=%s -n 30 -- . 2>/dev/null | sed -nE 's/^feat(\([^)]*\))?: ([FB][0-9]+[a-z]?) /\2 /p' | head -2)
  Q_DONE=()
  for ((i = ${#lines[@]} - 1; i >= 0; i--)); do Q_DONE+=("${lines[i]}"); done
  local gated
  # Gated features wait for Kim's approval: neither queued nor counted in the ETA.
  gated=$(roadmap_next | sed -n 's/^Gated: //p' | grep -v '^none$' | tr ';' '\n' | sed -nE 's/^ *([FB][0-9]+[a-z]?) .*/\1/p' | paste -sd'|' -) || true
  [[ -n $gated ]] || gated='—'
  mapfile -t Q_NEXT < <(sed -nE 's/^- \[ \] ([FB][0-9]+[a-z]?) (.*)/\1 \2/p' docs/ROADMAP.md | grep -vE "^(${FEATURE:-—}|$gated) " | head -3)
  Q_LEFT=$(sed -nE 's/^- \[[ ~]\] ([FB][0-9]+[a-z]?) .*/\1/p' docs/ROADMAP.md | grep -cvxE "$gated" || true)
  return 0
}

# queue_rows NOW: sets QROWS (six rows) and QSTRIP (the same on one row).
QROWS=() QSTRIP=''
queue_rows() {
  local now=$1 row id t el tw=$((COLS - 26)) cell
  ((tw >= 12)) || tw=12
  QROWS=() QSTRIP=''
  for row in "${Q_DONE[@]}"; do
    id=${row%% *} t=${row#* } cell=''
    [[ -n ${FEAT_DUR[$id]:-} ]] && cell=$(fmt_dur "${FEAT_DUR[$id]}")
    printf -v row '  ✔ %-5s %-*s %s' "$id" "$tw" "${t:0:tw}" "$cell"
    QROWS+=("$C_GREEN$row")
    QSTRIP+="$C_GREEN✔$id$C_OFF "
  done
  while ((${#QROWS[@]} < 2)); do QROWS+=(''); done
  if [[ -n $FEATURE ]]; then
    el=0
    [[ -n ${FEAT_START[$FEATURE]:-} ]] && el=$((now - ${FEAT_START[$FEATURE]} - ${FEAT_WAITED[$FEATURE]:-0}))
    ((el >= 0)) || el=0
    printf -v row '  ▸ %-5s %-*s %s %dm/~%dm' "$FEATURE" "$tw" "${FEATURE_TITLE:0:tw}" \
      "$(bar "$el" "$FEAT_MEDIAN" 6)" $((el / 60)) $((FEAT_MEDIAN / 60))
    QROWS+=("$C_BOLD$P_COLOR$row")
    QSTRIP+="$C_BOLD$P_COLOR▸$FEATURE$C_OFF "
  else
    QROWS+=("$C_BOLD$P_COLOR  ▸ $P_ICON $PHASE")
    QSTRIP+="$C_BOLD$P_COLOR▸ $P_ICON $PHASE$C_OFF "
  fi
  for row in "${Q_NEXT[@]}"; do
    QROWS+=("$C_DIM  · $row")
    QSTRIP+="$C_DIM·${row%% *}$C_OFF "
  done
  while ((${#QROWS[@]} < 6)); do QROWS+=(''); done
  return 0
}

render_status() {
  local now elapsed sess='' l1 l2 l3 rows=() plain_rows=() row i
  printf -v now '%(%s)T' -1
  elapsed=$(fmt_dur $((now - RUN_START)))
  ((SESSION_START > 0)) && sess=" · $(fmt_dur $((now - SESSION_START)))"
  phase_style
  local -n spin=$P_SPIN
  SPIN_I=$((SPIN_I + 1))
  eta_compute
  queue_rows "$now"
  l1="${C_BOLD}$APP_TITLE autopilot  $C_OFF${P_COLOR}[$(bar "$RM_DONE" "$RM_TOTAL")]$C_OFF$C_BOLD $RM_DONE/$RM_TOTAL built · $DONE_IN_RUN this run · ETA $ETA_TXT · ⏱ $elapsed · ≈\$$(printf '%.2f' "$TOTAL_COST")"
  if [[ -n $FEATURE ]]; then
    l2="$P_COLOR$P_ICON ${spin[SPIN_I % ${#spin[@]}]} ${FEATURE_MS:+$FEATURE_MS }$FEATURE $FEATURE_TITLE · attempt $ATTEMPT/$MAX_ATTEMPTS$sess · $PHASE"
  else
    l2="$P_COLOR$P_ICON ${spin[SPIN_I % ${#spin[@]}]} $PHASE"
  fi
  l3="${C_DIM}last: $LAST · $TOOLS tools · $EDITS edits"
  [[ -n $RL_5H ]] && l3+=" · 5h $(gauge "$RL_5H") · 7d $(gauge "$RL_7D")"

  for row in "${QROWS[@]}" "$l1" "$l2" "$l3"; do
    [[ -n $row ]] && plain_rows+=("$(plain "$row")")
  done
  printf '%s\n' "${plain_rows[@]}" >"$RUN/status.txt" 2>/dev/null || true
  ((UI_TTY)) || return 0
  ui_check_resize
  ((UI_TTY)) || return 0
  rows=("$C_DIM$P_COLOR$RULE")
  if ((PIN == 10)); then
    rows+=("${QROWS[@]}")
  elif ((PIN == 5)); then
    rows+=("$QSTRIP")
  fi
  rows+=("$l1" "$l2" "$l3")
  {
    printf '\e7'
    for ((i = 0; i < ${#rows[@]}; i++)); do
      fit "${rows[i]}" $((COLS - 1))
      printf '\e[%d;1H\e[K%s' $((ROWS - PIN + i + 1)) "$FIT"
    done
    printf '\e8'
    printf '\e]0;%s\a' "$APP_TITLE $RM_DONE/$RM_TOTAL · ${FEATURE:-$PHASE} · $ETA_TXT"
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
  command -v notify-send >/dev/null && notify-send -a "$APP_TITLE autopilot" "$1" "${2:-}" 2>/dev/null || true
}

# Sleep while keeping the status line alive. The ETA counts the wait; a usage-limit or API wait
# does not count towards the feature's own time.
wait_with_status() {
  local seconds=$1 label=$2 end
  end=$(($(date +%s) + seconds))
  WAIT_END=$end WAIT_LIMIT=0 ETA_AT=0
  [[ $label == 'usage limit' ]] && WAIT_LIMIT=1
  while (($(date +%s) < end)); do
    PHASE="$label · $(fmt_dur $((end - $(date +%s)))) left"
    render_status
    sleep 1
  done
  WAIT_END=0 WAIT_LIMIT=0 ETA_AT=0
  if [[ -n $FEATURE && ($label == 'usage limit' || $label == 'API busy') ]]; then
    FEAT_WAITED[$FEATURE]=$((${FEAT_WAITED[$FEATURE]:-0} + seconds))
  fi
  return 0
}

# secs N: a fixed wait or poll interval, shortened by AUTOPILOT_WAIT_DIVISOR in tests.
secs() {
  local s=$(($1 / WAIT_DIVISOR))
  echo $((s > 0 ? s : 1))
}

STOP_REASON=''
die() {
  STOP_REASON=$*
  log err "STOP: $*"
  notify 'Autopilot stopped' "$*"
  exit 1
}

# What happened to the push and deploy, for the summary and the morning report.
DEPLOY_STATE='not reached (the run stopped before the push)'
LIVE_STATE='not checked'
# The mid-run deploy's outcome, and what is wrong with the droplet's .env (the deploy said so).
EARLY_STATE=''
ENV_PROBLEM=''

# The morning report: what Kim reads first. Always written, whatever stopped the run.
write_report() {
  local rc=$1 report="$RUN/morning-report.md" blocked gated feats
  feats=$(git log --reverse --format='%h %s' "$RUN_HEAD_AT_START..HEAD" 2>/dev/null | grep -E " (feat|fix)(\([^)]*\))?: " || true)
  blocked=$(awk '/^- \[!\] / { id = $3; sub(/^- \[!\] /, ""); line = $0 } /^ *- Blocked:/ && line { sub(/^ *- Blocked: */, ""); print "- " line " — " $0; line = "" }' docs/ROADMAP.md 2>/dev/null || true)
  gated=$(roadmap_next | sed -n 's/^Gated: //p' | grep -v '^none$' | tr ';' '\n' | sed 's/^ */- /' || true)
  {
    echo "# $APP_TITLE autopilot — morning report"
    echo
    echo "Run \`$(basename "$RUN")\` · $(fmt_dur $(($(date +%s) - RUN_START))) · exit $rc · ≈\$$(printf '%.2f' "$TOTAL_COST")"
    [[ -n $STOP_REASON ]] && echo && echo "**Stopped:** $STOP_REASON"
    [[ -n $ENV_PROBLEM ]] && echo && echo "**Fix on the droplet:** $ENV_PROBLEM. Then run the deploy workflow again, or start the autopilot."
    [[ -n $blocked ]] && echo && echo "**Blocked features** (below) did not ship; everything that doesn't depend on them did."
    echo
    echo "## Roadmap"
    echo
    roadmap_next | grep -E '^(Done|In progress|Blocked|Gated):' | sed 's/^/- /'
    echo
    echo "## Built this run ($DONE_IN_RUN)"
    echo
    if [[ -n $feats ]]; then printf -- '- %s\n' "${feats//$'\n'/$'\n- '}"; else echo "- nothing"; fi
    echo
    echo "## Blocked"
    echo
    if [[ -n $blocked ]]; then echo "$blocked"; else echo "- none"; fi
    echo
    echo "## Waiting on Kim's approval (Gate:)"
    echo
    if [[ -n $gated ]]; then echo "$gated"; echo; echo "Approve, then \`node .claude/scripts/roadmap.mjs ungate <ID>\` and start the autopilot again."; else echo "- none"; fi
    echo
    echo "## Stashes (half-built work set aside)"
    echo
    git stash list | grep "$APP-autopilot:" | sed 's/^/- /' || echo "- none"
    echo
    echo "## Deploy"
    echo
    echo "- $DEPLOY_STATE"
    echo "- Live check: $LIVE_STATE"
    echo "- Live URL: $LIVE_URL"
    [[ -n $EARLY_STATE ]] && echo "- Early deploy (mid-run): $EARLY_STATE"
    echo
    echo "## Worktree"
    echo
    if ((WORKTREE_REMOVE)); then
      echo "- Pushed from \`$BRANCH\`; the worktree and the branch are removed. In $CHECKOUT_REPO run \`git pull --rebase\` to get the build (prep's commits on your main are already in it)."
    elif [[ -d $WORKTREE ]]; then
      echo "- The work is on branch \`$BRANCH\` in $WORKTREE, not on main. The next run resumes there; nothing is lost."
      echo "- To look at it: \`cd $WORKTREE/$APP_DIR\`. Don't change $APP_DIR/ in your own checkout until it is pushed."
    else
      echo "- No worktree was made (the run stopped before it)."
    fi
    echo
    echo "## Kim checks"
    echo
    echo "- $(kim_checks) open under \"## Kim checks\" in docs/PROGRESS.md"
    echo
    echo "## Files"
    echo
    echo "- Logs: $RUN (run.log, summary.txt, one .jsonl per session)"
  } >"$report" 2>/dev/null || return 0
  ln -sfn "$report" "$CACHE/morning-report.md" 2>/dev/null || true
}

cleanup() {
  local rc=$?
  stop_session
  kill_strays
  # The last status (status.txt, the pinned rows) shows where the run ended.
  render_status || true
  {
    echo "$APP_TITLE autopilot run $(basename "$RUN")"
    echo "exit code: $rc"
    [[ -n $STOP_REASON ]] && echo "stopped: $STOP_REASON"
    echo "duration: $(fmt_dur $(($(date +%s) - RUN_START)))"
    echo "features committed this run: $DONE_IN_RUN of $START_TODO"
    echo "approx. API cost: \$$(printf '%.2f' "$TOTAL_COST")"
    echo "roadmap: $(roadmap_next | grep -E '^(Done|In progress|Blocked|Gated):' | paste -sd' ' -)"
    echo "stashes made by autopilot:"
    git stash list | grep "$APP-autopilot:" || echo "  none"
    [[ -n $EARLY_STATE ]] && echo "early deploy: $EARLY_STATE"
    echo "deploy: $DEPLOY_STATE"
    echo "live: $LIVE_STATE"
    echo "Kim checks queued in docs/PROGRESS.md: $(kim_checks)"
    echo "commits this run:"
    git log --oneline "$RUN_HEAD_AT_START..HEAD" 2>/dev/null || true
  } >"$RUN/summary.txt" 2>&1 || true
  ((DRY_RUN)) || write_report "$rc"
  if ((WORKTREE_REMOVE)); then
    worktree_down >>"$RUN_LOG" 2>&1 || echo "Could not remove the worktree $WORKTREE or branch $BRANCH (see $RUN_LOG); remove them by hand." >&3
  fi
  ui_teardown
  [[ $SELF == "$CACHE"/running.*.sh ]] && rm -f -- "$SELF"
  {
    echo
    cat "$RUN/summary.txt" 2>/dev/null || true
    ((DRY_RUN)) || echo "Morning report: $RUN/morning-report.md"
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
feature_ms() { awk -v id="$1" '/^## M[0-9]+/ { m = $2 } $0 ~ "^- \\[.\\] " id " " { print m; exit }' docs/ROADMAP.md; }
feature_mark() { sed -nE "s/^- \[(.)\] $1 .*/\1/p" docs/ROADMAP.md | head -1; }
# Open "- [ ] " lines under "## Kim checks" in docs/PROGRESS.md.
kim_checks() {
  local n
  n=$(sed -n '/^## Kim checks/,/^<!-- entries below/p' docs/PROGRESS.md 2>/dev/null | grep -c '^- \[ \] ') || true
  echo "${n:-0}"
}
# The whole worktree is the run's own, root files included (F01 edits the root ci.yml).
dirty() { [[ -n $(git status --porcelain --untracked-files=all -- ':/') ]]; }

# Kill dev servers left behind by an earlier session, only if they run from this repo.
kill_strays() {
  local pid cwd
  for pid in $(ss -ltnpH "$DEV_PORTS_SS" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || true)
    if [[ $cwd == "$PROJECT" || $cwd == "$PROJECT"/* ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

stash_changes() {
  local msg=$1
  if dirty; then
    git stash push --include-untracked -m "$APP-autopilot: $msg" -- ':/' >/dev/null
    log warn "Stashed uncommitted changes as \"$APP-autopilot: $msg\" ($(git stash list | head -1 | cut -d: -f1))"
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

# ---------------------------------------------------------------------------------------------
# Monorepo: the worktree

# Paths in commits main has that origin/main lacks, outside PUSH_ALLOWED. The worktree starts
# from main, so those commits would be pushed with the build: Kim pushes or moves them first.
foreign_on_main() {
  git -C "$CHECKOUT_REPO" rev-parse -q --verify origin/main >/dev/null || return 0
  git -C "$CHECKOUT_REPO" log --format= --name-only origin/main..main | sed '/^$/d' | sort -u | grep -vE "$PUSH_ALLOWED" || true
}
launch_base_ok() {
  local foreign
  foreign=$(foreign_on_main)
  [[ -z $foreign ]] && return 0
  echo "main has unpushed commits outside $APP_DIR/ and the allowed root files; push or move them first:"
  echo "$foreign"
  return 1
}
# Uncommitted changes to the app in Kim's checkout would be invisible to the worktree.
checkout_app_clean() {
  local changes
  changes=$(git -C "$CHECKOUT" status --porcelain --untracked-files=all -- .)
  [[ -z $changes ]] && return 0
  echo "uncommitted changes in $APP_DIR/ of your checkout (the run works from main and would not see them):"
  echo "$changes"
  return 1
}

# Create the worktree on BRANCH from main, or resume the one an earlier run left. Then move
# PROJECT and REPO into it, copy the gitignored agent files over and install dependencies.
worktree_up() {
  local wt_branch
  if git -C "$CHECKOUT_REPO" worktree list --porcelain | grep -qxF "worktree $WORKTREE"; then
    wt_branch=$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD)
    [[ $wt_branch == "$BRANCH" ]] || die "$WORKTREE is on $wt_branch, not $BRANCH; remove it (git worktree remove) and start again"
    if ! git -C "$CHECKOUT_REPO" merge-base --is-ancestor main "$BRANCH"; then
      [[ -z $(git -C "$WORKTREE" status --porcelain --untracked-files=all) ]] ||
        die "main moved since the last run and $WORKTREE has uncommitted work; commit or stash it there, then start again"
      if ! git -C "$WORKTREE" rebase -q main >>"$RUN_LOG" 2>&1; then
        git -C "$WORKTREE" rebase --abort >/dev/null 2>&1 || true
        die "rebasing $BRANCH onto main conflicted; resolve it in $WORKTREE, then start again"
      fi
      log info "Rebased $BRANCH onto main (main moved since the last run)."
    fi
    log info "Resuming in the worktree $WORKTREE ($BRANCH)."
  else
    [[ -e $WORKTREE ]] && die "$WORKTREE exists but is not a worktree of $CHECKOUT_REPO; move it away, then start again"
    git -C "$CHECKOUT_REPO" worktree prune
    git -C "$CHECKOUT_REPO" worktree add -q -B "$BRANCH" "$WORKTREE" main >>"$RUN_LOG" 2>&1 ||
      die "git worktree add failed (see $RUN_LOG)"
    rm -f "$CACHE/installed.sha256"
    log info "Working in a new worktree $WORKTREE on $BRANCH (from main)."
  fi
  # .claude/ and CLAUDE.md are gitignored, so a worktree has none. Kim's copies win, except the
  # reviewers' memory, which the worktree keeps from an earlier run.
  mkdir -p "$WORKTREE/$APP_DIR/.claude"
  rsync -a --exclude 'agent-memory/' "$CHECKOUT/.claude/" "$WORKTREE/$APP_DIR/.claude/"
  if [[ -d $CHECKOUT/.claude/agent-memory && ! -d $WORKTREE/$APP_DIR/.claude/agent-memory ]]; then
    cp -a "$CHECKOUT/.claude/agent-memory" "$WORKTREE/$APP_DIR/.claude/"
  fi
  if [[ -f $CHECKOUT/CLAUDE.md ]]; then cp -- "$CHECKOUT/CLAUDE.md" "$WORKTREE/$APP_DIR/CLAUDE.md"; fi
  PROJECT=$WORKTREE/$APP_DIR
  REPO=$WORKTREE
  cd "$PROJECT"
  [[ $(git rev-parse --abbrev-ref HEAD) == "$BRANCH" ]] || die "the worktree is not on $BRANCH"
  install_deps
}

# Install dependencies in the worktree when the lockfile is new or changed since the last install.
install_deps() {
  local sum
  [[ -f $LOCKFILE ]] || return 0
  sum=$(sha256sum -- "$LOCKFILE" | cut -d' ' -f1)
  [[ $(cat "$CACHE/installed.sha256" 2>/dev/null) == "$sum" ]] && return 0
  log info "Installing dependencies in the worktree ($INSTALL_CMD)…"
  bash -c "$INSTALL_CMD" >>"$RUN_LOG" 2>&1 </dev/null || die "$INSTALL_CMD failed in $PROJECT (see $RUN_LOG)"
  echo "$sum" >"$CACHE/installed.sha256"
}

# After a live deploy: keep the reviewers' memory, then remove the worktree and its branch.
worktree_down() {
  if [[ -d $WORKTREE/$APP_DIR/.claude/agent-memory ]]; then
    mkdir -p "$CHECKOUT/.claude/agent-memory"
    rsync -a "$WORKTREE/$APP_DIR/.claude/agent-memory/" "$CHECKOUT/.claude/agent-memory/"
  fi
  cd "$CHECKOUT"
  git -C "$CHECKOUT_REPO" worktree remove --force "$WORKTREE"
  git -C "$CHECKOUT_REPO" branch -q -D "$BRANCH"
  rm -f "$CACHE/installed.sha256"
}

run_gate() {
  local step
  : >"$RUN/gate.log"
  [[ -e $SCAFFOLD_FILE ]] || {
    log err "$SCAFFOLD_FILE is missing, so there is nothing to check (F01 creates it)"
    return 1
  }
  for step in "${GATE[@]}"; do
    PHASE="checks: ${step%%|*}"
    render_status
    echo "\$ ${step#*|}" >>"$RUN/gate.log"
    if ! bash -c "${step#*|}" >>"$RUN/gate.log" 2>&1 </dev/null; then
      log err "${step%%|*} failed (see $RUN/gate.log)"
      return 1
    fi
  done
  log ok "All checks green: $(printf '%s\n' "${GATE[@]}" | cut -d'|' -f1 | paste -sd, - | sed 's/,/, /g')"
}

# ---------------------------------------------------------------------------------------------
# Push guard and remote checks

# origin must be this app's own GitHub repo, so nothing ever lands in another project's (or a
# client's) repository, whatever happens to be configured.
check_remote() {
  local url
  url=$(git remote get-url --push origin 2>/dev/null) || die "no origin remote; the bootstrap adds it (gh repo create)"
  if [[ $url =~ ^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)(.+)$ ]]; then
    [[ ${BASH_REMATCH[2]%.git} == "$GH_REPO" ]] || die "origin points at ${BASH_REMATCH[2]%.git}, not $GH_REPO; nothing runs"
  elif [[ -z $OFFLINE && -z $TEST ]]; then
    die "origin ($url) is not github.com/$GH_REPO; nothing runs"
  else
    log warn "Test run: origin is $url (a real run needs github.com/$GH_REPO)."
  fi
}

# The range a push would carry: everything not yet on origin/main (the whole history on the
# first push).
push_range() {
  if git rev-parse -q --verify origin/main >/dev/null; then echo 'origin/main..HEAD'; else echo 'HEAD'; fi
}

# Before every push: no agent files or secrets in what would ship, and the files only Kim
# changes unchanged since the run started (a session that got past the hook with a shell edit).
# Prints the problems to $RUN/push-guard.txt and returns 1 if there are any.
SECRET_RE='-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN OPENSSH PRIVATE KEY-----'
# Paths are relative to the repo root, so .claude/ may sit at any depth.
FORBIDDEN_PATHS_RE='(^|/)(\.env(\..*)?|.*\.pem|.*\.key|id_(rsa|ed25519|ecdsa)(\.pub)?|CLAUDE(\.local)?\.md)$|(^|/)\.claude/'
push_guard() {
  local range out="$RUN/push-guard.txt" bad paths hits
  range=$(push_range)
  : >"$out"
  paths=$(git log --format= --name-only "$range" | sed '/^$/d' | sort -u)
  bad=$(grep -E "$FORBIDDEN_PATHS_RE" <<<"$paths" | grep -vE '(^|/)\.env\.example$' || true)
  [[ -n $bad ]] && printf 'Agent files or secrets in commits (%s):\n%s\n\n' "$range" "$bad" >>"$out"
  # Only this app and the named root files ship: never another project's work, or Kim's.
  bad=$(grep -vE "$PUSH_ALLOWED" <<<"$paths" || true)
  [[ -n $bad ]] && printf 'Paths outside %s/ and the allowed root files (%s):\n%s\n\n' "$APP_DIR" "$range" "$bad" >>"$out"
  # This file holds the patterns themselves; any change to it is caught below instead.
  hits=$(git log -p --format='commit %h' "$range" -- ':/' ':!scripts/autopilot.sh' | grep -E '^(commit |\+)' | grep -E "^commit |$SECRET_RE" |
    awk '/^commit / { c = $2; next } { print c ": " substr($0, 1, 60) "…" }' || true)
  [[ -n $hits ]] && printf 'Lines that look like secrets:\n%s\n\n' "$hits" >>"$out"
  if command -v gitleaks >/dev/null && ! gitleaks git --no-banner --redact --log-opts="$range" >>"$out" 2>&1; then
    printf 'gitleaks found leaks (above).\n\n' >>"$out"
  fi
  if ! git diff --quiet "$RUN_HEAD_AT_START" HEAD -- docs/spec.md scripts/autopilot.sh; then
    printf 'Changed during this run (only Kim changes them):\n%s\n\n' \
      "$(git diff --name-only "$RUN_HEAD_AT_START" HEAD -- docs/spec.md scripts/autopilot.sh)" >>"$out"
  fi
  [[ -s $out ]] && return 1
  return 0
}

check_push_scope() {
  push_guard && return 0
  notify 'Not pushed' "the push guard refused (see $RUN/push-guard.txt)"
  die "the push guard refused: $(head -1 "$RUN/push-guard.txt") (see $RUN/push-guard.txt); nothing pushed"
}

# --dry-run: everything a real run would need, checked without building, pushing or deploying.
DRY_FAILS=0
dry_check() {
  local label=$1
  shift
  if "$@" >>"$RUN/dry-run.log" 2>&1; then
    log ok "  ✔ $label"
  else
    log err "  ✘ $label (see $RUN/dry-run.log)"
    DRY_FAILS=$((DRY_FAILS + 1))
  fi
}
gh_repo_ok() {
  local vis
  vis=$(gh repo view "$GH_REPO" --json visibility --jq '.visibility | ascii_downcase') || return 1
  echo "$GH_REPO $vis"
  [[ $vis == "$REPO_VISIBILITY" ]] || {
    echo "visibility is $vis, bootstrap.json says $REPO_VISIBILITY"
    return 1
  }
}
gh_secrets_ok() {
  local names s
  names=$(gh secret list --repo "$GH_REPO" --json name --jq '.[].name')
  for s in SSH_HOST SSH_USER SSH_KEY SSH_KNOWN_HOSTS; do
    grep -qx "$s" <<<"$names" || {
      echo "missing secret $s"
      return 1
    }
  done
}
# Sessions must not reach the droplet or GitHub with Kim's keys, whatever command they find.
sandbox_ok() {
  "${SANDBOX[@]}" bash -c 'if compgen -G "$HOME/.ssh/id_*" >/dev/null; then echo "~/.ssh keys visible"; exit 1; fi; echo "~/.ssh is empty inside"'
  if "${SANDBOX[@]}" ssh -o BatchMode=yes -o ConnectTimeout=10 "root@$DROPLET" true 2>&1; then
    echo "ssh root@$DROPLET worked inside the sandbox"
    return 1
  fi
  echo "ssh root@$DROPLET fails inside"
}
# Read-only, and only in a dry run with Kim at the keyboard: real runs never ssh anywhere.
droplet_ok() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 "root@$DROPLET" "
    set -e
    df -P / | awk 'NR == 2 { free = \$4 / 1048576; printf \"disk: %.1f GB free on /\\n\", free; if (free < 3) { print \"under 3 GB free\"; exit 1 } }'
    free -m | awk '/^Mem:/ { print \"memory: \" \$7 \" MB available\" }'
    test -d /opt/$APP && stat -c 'stack dir: %n %U:%G %a' /opt/$APP
    test -f /opt/$APP/.env && echo '.env present'
    docker info >/dev/null && echo 'docker up'
    id deploy >/dev/null && echo 'deploy user present'
  "
}
live_ok() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$LIVE_URL/")
  echo "GET $LIVE_URL/ -> $code (TLS verified)"
  [[ $code == 200 || $code == 503 ]]
}
queue_report() {
  roadmap_next | grep -E '^(Done|In progress|Blocked|Gated|Open bugs|Resume|Next eligible|Nothing left|Not eligible):' | sed 's/^/    /' |
    while IFS= read -r line; do log info "$line"; done
  log info "    queue: $(grep -cE '^- \[ \] F' docs/ROADMAP.md || true) todo, of which $(roadmap_next | sed -n 's/^Gated: //p' | grep -v '^none$' | tr ';' '\n' | grep -c . || true) gated"
}
dry_run_checks() {
  log info "Dry run checks:"
  queue_report
  dry_check "push guard: $(push_range) carries no secrets or agent files" push_guard
  dry_check "roadmap.mjs and spec.mjs answer" bash -c 'node .claude/scripts/roadmap.mjs next >/dev/null && node .claude/scripts/spec.mjs --toc >/dev/null'
  dry_check "claude CLI runs" claude --version
  dry_check "sessions can't use ~/.ssh or gh's login (bwrap)" sandbox_ok
  dry_check "main carries nothing unpushed outside $APP_DIR/ and the allowed root files" launch_base_ok
  dry_check "no uncommitted changes in $APP_DIR/ of your checkout" checkout_app_clean
  dry_check "rsync is installed (copies .claude/ into the worktree)" command -v rsync
  if git worktree list --porcelain | grep -qxF "worktree $WORKTREE"; then
    log info "  - an earlier run's worktree $WORKTREE ($BRANCH) is there; a real run resumes in it"
  else
    log info "  - a real run creates the worktree $WORKTREE on $BRANCH from main"
  fi
  if [[ -n $OFFLINE ]]; then
    log warn "  - gh, deploy secrets, droplet and live URL skipped (AUTOPILOT_OFFLINE)"
  else
    dry_check "gh is logged in" gh auth status
    dry_check "GitHub repo $GH_REPO exists and is $REPO_VISIBILITY" gh_repo_ok
    dry_check "deploy secrets set on $GH_REPO" gh_secrets_ok
    dry_check "droplet $DROPLET reachable, disk and stack dir fine" droplet_ok
    dry_check "$LIVE_URL answers over TLS (placeholder 503 or app 200)" live_ok
  fi
  if [[ -f $REPO/.github/workflows/$WORKFLOW ]]; then
    dry_check "$WORKFLOW keeps the job and step names this script matches" \
      bash -c "cd \"\$1\" && grep -q 'name: checks' \"\$2\" && grep -q 'name: droplet' \"\$2\" && grep -q 'build and smoke-test the image' \"\$2\"" _ "$REPO" ".github/workflows/$WORKFLOW"
  else
    log info "  - $WORKFLOW not written yet (F60 writes it from docs/deploy-kit/)"
  fi
  if ((DRY_FAILS)); then
    die "dry run: $DRY_FAILS check(s) failed"
  fi
  log ok "Dry run passed. A real run would build the queue above (deploying once mid-run if a feature adds $WORKFLOW), then run the checks, push and deploy."
}

# ---------------------------------------------------------------------------------------------
# Claude sessions

UNATTENDED_RULES=$(
  cat <<EOF
You are running unattended, launched by scripts/autopilot.sh. Kim is away and cannot answer.
- Never ask questions and never wait for input. Wherever a skill or instruction says to ask Kim, choose the option a careful senior engineer would pick (simplest choice that meets the spec, the roadmap entry and docs/design/DESIGN.md), record it in docs/DECISIONS.md, and continue.
- At the start, if the repo has uncommitted changes and a roadmap feature is marked [~], they are an earlier unattended attempt at that feature: inspect them, keep what is sound, fix the rest, and resume. Never discard them.
- If the repo has uncommitted changes and no feature is marked [~], put them aside with \`git stash push --include-untracked -m "$APP-autopilot: unexplained changes"\` and continue.
- If the feature's roadmap entry has a "Blocked:" line, an earlier attempt gave up on it. Read the note, and look for its unfinished work with \`git stash list | grep $APP-autopilot\` (inspect with \`git stash show -p stash@{N}\`; apply only what helps). Try a different approach.
- A "Gate:" line is Kim's approval and is never yours to remove. Never run roadmap.mjs ungate, and never build a gated feature.
- Checks only a person can do (real devices, real accounts or keys, live third-party services, "Kim has reviewed …") never block: build and test everything around them (Playwright emulation and fakes count for the automated part), then add exact steps under "## Kim checks" in docs/PROGRESS.md (\`- [ ] F09: steps · what to look for\`) and mark the feature done.
- If Playwright or the playtest skill cannot run, write exact manual test steps in the PROGRESS entry instead and continue.
- The roadmap mark, the PROGRESS entry, any Kim checks and any DECISIONS rows go into the feature's single commit.
- If a feature is genuinely blocked after three real fix attempts, mark it with roadmap.mjs as the skill describes, and leave the code uncommitted.
- Real keys never exist in this session. Code reads env vars; tests and development use fakes. Never read, write or create .env files other than .env.example.
- Never push, deploy, run gh, ssh, scp, docker against the droplet, or sudo. Never change git remotes or git config. Never edit docs/spec.md or scripts/autopilot.sh. The script does the push and deploy.
- Never stage .claude/, CLAUDE.md or .env* (they are gitignored; never force-add them).
- Build exactly one feature, commit it, then stop.
- This app is $APP_DIR/ of a monorepo, and you work in a git worktree of it on branch $BRANCH (the current directory is the app). Touch only files inside it, except exactly these, and only when the feature names them: ../.github/workflows/ci.yml (F01: this app's jobs), ../.github/workflows/$WORKFLOW and ../README.md (the deploy feature), and ../hub/ with ../.github/workflows/deploy-hub.yml (the hub spoke feature). Every other project in the repo is a read-only reference: copy patterns from it, never edit or import it. The script refuses to push any commit that touches another path.
- Stage by path (\`git add -- <paths>\`); never \`git add -A\` without \`-- .\` and the named root files. Never switch branches or touch other worktrees.
EOF
)

DISALLOWED=(
  'Bash(git push:*)' 'Bash(git reset:*)' 'Bash(git clean:*)' 'Bash(git checkout:*)'
  'Bash(git rebase:*)' 'Bash(git restore:*)' 'Bash(git remote:*)' 'Bash(git config:*)'
  'Bash(git add -f:*)' 'Bash(git add --force:*)'
  'Bash(gh:*)' 'Bash(ssh:*)' 'Bash(scp:*)' 'Bash(rsync:*)' 'Bash(sftp:*)'
  'Bash(docker:*)' 'Bash(rm -rf:*)' 'Bash(sudo:*)'
  'Bash(node .claude/scripts/roadmap.mjs ungate:*)' 'AskUserQuestion'
  'Bash(git switch:*)' 'Bash(git worktree:*)' 'Bash(git branch -D:*)' 'Bash(git branch -d:*)'
  'Bash(git stash drop:*)' 'Bash(git stash clear:*)'
)
# Kim's user-level RTK hook rewrites some commands to `rtk <command>` before the deny list
# sees them (a real session ran `git push --dry-run` that way), so deny those forms too.
for rule in "${DISALLOWED[@]}"; do
  [[ $rule == Bash\(* ]] && DISALLOWED+=("Bash(rtk ${rule#Bash(}")
done
DISALLOWED+=('Bash(rtk proxy:*)')

# Every session runs in bubblewrap: the whole filesystem as it is, except an empty ~/.ssh and gh
# config, so no tool or subprocess a session starts can use Kim's SSH key (it has no passphrase)
# or GitHub login. Network stays open (installs, docs).
SANDBOX=(bwrap --dev-bind / / --die-with-parent)
for d in "$HOME/.ssh" "${GH_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/gh}"; do
  [[ -d $d ]] && SANDBOX+=(--tmpfs "$d")
done
SANDBOX+=(--)
# Text added to the next session's system prompt (the push guard's refusal), then cleared.
SESSION_NOTE=''

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
  | ($r.unifiedWindows // {}) as $w
  | "rl\t\($r.status // "")\t\($r.resetsAt // 0)\t\($w.five_hour.utilization // "")\t\($w.seven_day.utilization // "")\t\($w.five_hour.resetsAt // 0)\t\($w.seven_day.resetsAt // 0)"
elif .type == "result" then
  "result\t\(.subtype // "")\t\(.is_error // false)\t\(.total_cost_usd // 0)\t\(.duration_ms // 0)\t\(.num_turns // 0)\t" + ((.result // "") | clip(400))
else empty end'

# Reads the jq lines, logs the timeline and redraws the status once a second.
session_reader() {
  set +e
  local kind a b c d e f now
  while :; do
    if IFS=$'\t' read -r -t 1 kind a b c d e f _; then
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
          # The ETA's usage trend: epoch, 5h utilization and reset, 7d utilization and reset.
          printf -v now '%(%s)T' -1
          printf '%s\t%s\t%s\t%s\t%s\n' "$now" "$c" "$e" "$d" "$f" >>"$RUN/rl.tsv"
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
  local rules=$UNATTENDED_RULES
  [[ -z $SESSION_NOTE ]] || rules+=$'\n\n'$SESSION_NOTE
  rm -f "$STATE"/result_* "$STATE/rc" "$STATE/no_skill" "$STATE/rl" "$STATE/session_pid"
  TOOLS=0 EDITS=0 LAST='starting session'
  SESSION_START=$(date +%s)
  kill_strays
  {
    local rc=0
    GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.pushurl \
      GIT_CONFIG_VALUE_0=autopilot-sessions-never-push GH_TOKEN=autopilot-sessions-never-use-gh \
      GITHUB_TOKEN=autopilot-sessions-never-use-gh SSH_AUTH_SOCK='' GIT_SSH_COMMAND=false \
      timeout --kill-after=60 "$SESSION_TIMEOUT" "${SANDBOX[@]}" claude -p "$prompt" \
      --output-format stream-json --verbose \
      --dangerously-skip-permissions \
      --disallowedTools "${DISALLOWED[@]}" \
      --append-system-prompt "$rules" \
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

# The one extra pass: every [!] feature goes back to todo (its "Blocked:" note stays, and the
# session is told to read it and the stash) with a fresh set of attempts. Returns 1 when there
# is nothing to retry.
retry_blocked() {
  local ids id
  RETRY_PASS=1
  ids=$(sed -nE 's/^- \[!\] ([FB][0-9]+[a-z]?) .*/\1/p' docs/ROADMAP.md)
  [[ -n $ids ]] || return 1
  log warn "━━ Extra pass for blocked features: $(paste -sd' ' - <<<"$ids")"
  notify 'Retrying blocked features' "$(paste -sd' ' - <<<"$ids")"
  for id in $ids; do
    "${ROADMAP_JS[@]}" mark "$id" todo >/dev/null || die "could not reset $id to todo"
    ATTEMPTS[$id]=0
  done
  commit_docs "docs: retry blocked features (autopilot)"
  GIVEUPS_IN_A_ROW=0
  return 0
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
log info "$APP_TITLE autopilot · logs in $RUN"
((DRY_RUN)) && log warn "Dry run: nothing is built, pushed or deployed."

for tool in claude node git gh jq curl ss timeout flock bwrap; do
  command -v "$tool" >/dev/null || die "missing tool: $tool"
done
if [[ -n $OFFLINE ]]; then
  ((DRY_RUN || !DEPLOY)) || die "AUTOPILOT_OFFLINE is for dry runs and --no-deploy runs only"
  log warn "Offline test: gh, ssh and the live URL are skipped."
else
  gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth login)"
fi
# Your checkout may be on any branch: the run starts from main, in a worktree of its own.
command -v rsync >/dev/null || die "missing tool: rsync"
[[ -f .claude/skills/next-feature/SKILL.md ]] || die ".claude/skills/next-feature/SKILL.md is missing; the bootstrap writes it"
check_remote
git fetch -q origin 2>>"$RUN_LOG" || log warn "git fetch failed; continuing offline until the push"
if ((!DRY_RUN)); then
  # Kim is still at the keyboard here, so these stop the run rather than work around it.
  launch_base_ok >"$RUN/launch-base.txt" || die "$(head -1 "$RUN/launch-base.txt") (see $RUN/launch-base.txt)"
  checkout_app_clean >"$RUN/checkout.txt" || die "$(head -1 "$RUN/checkout.txt") (see $RUN/checkout.txt)"
  worktree_up
  RUN_HEAD_AT_START=$(git rev-parse HEAD)
fi

RM_DONE_AT_START=$(roadmap_next | sed -nE 's/^Done: ([0-9]+)\/.*/\1/p') || true
[[ -n $RM_DONE_AT_START ]] || die "roadmap.mjs did not report progress"
refresh_counts
load_history
queue_refresh
log info "Roadmap: $RM_DONE/$RM_TOTAL done, $START_TODO to build. A feature takes ~$(fmt_dur "$FEAT_MEDIAN") (median), checks and deploy ~$(fmt_dur "$TAIL_EST")."

RESUMING=0
# A dry run has no worktree yet; checkout_app_clean covers your checkout instead.
if ((!DRY_RUN)) && dirty; then
  if roadmap_next | grep -q '^Resume:'; then
    RESUMING=1
    log warn "Uncommitted changes belong to the [~] feature; the first session resumes them."
  elif ((DRY_RUN)); then
    log warn "The repo has uncommitted changes; a real run would refuse to start."
  else
    # Kim is still at the keyboard at this point, so ask for a clean tree rather than stash.
    die "the repo has uncommitted changes; commit or stash them, then start again"
  fi
fi

if ((DRY_RUN)); then
  log info "Skipping the baseline checks in a dry run."
elif [[ ! -e $SCAFFOLD_FILE ]]; then
  log info "Skipping the baseline checks: no $SCAFFOLD_FILE yet (F01 creates it)."
elif ((RESUMING)); then
  # Half-built work is not expected to pass yet; the session's own verify step checks it.
  log info "Skipping the baseline checks: they would run on the [~] feature's unfinished work."
else
  PHASE='baseline checks'
  log info "Baseline checks before the first feature…"
  run_gate || die "the checks fail before any feature is built; fix main first"
fi

# ---------------------------------------------------------------------------------------------
# Gate, push, deploy (used mid-run once and at the end)

# repair LABEL CONTEXT: one session that fixes failing checks. Waits out usage limits and API
# errors as the feature loop does, so they do not use up a repair.
repair() {
  local label=$1 context=$2 try=1 name blocker
  while :; do
    name=$label
    ((try == 1)) || name+="-r$try"
    PHASE='repairing'
    run_session "$name" "These checks fail on the committed code:

$context

Fix only what makes them fail, without weakening, skipping or deleting tests. Run the verify skill until it is green, then make one commit: fix: <what you fixed>. Do not start any roadmap feature."
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

# The checks before the final push, with up to 2 repair sessions; stops the run if they stay red.
final_gate() {
  local try
  PHASE='final checks'
  for try in 1 2 3; do
    run_gate && return 0
    ((try < 3)) || die "checks still fail after 2 repair sessions; nothing pushed"
    log warn "Repair session $try for the failing checks…"
    repair "repair-gate-$try" "$(tail -80 "$RUN/gate.log")"
    if dirty; then stash_changes "repair $try leftovers"; fi
  done
}

# The mid-run deploy must not stop the build: there, deploy_fail logs, notifies and returns 1.
# The final deploy stops the run on any failure.
DEPLOY_MODE=final
deploy_fail() {
  [[ $DEPLOY_MODE == final ]] && die "$*"
  log err "Early deploy: $*"
  notify 'Early deploy failed' "$*"
  EARLY_STATE="failed: $*"
  return 1
}

# Fetch, rebase onto origin/main if it moved, run the push guard, push. Each try fetches again,
# so a push that lost a race with another push rebases and goes again. The first push of a new
# repo has no origin/main to compare with.
push_main() {
  local i
  PHASE='pushing'
  for i in 1 2 3; do
    if ! git fetch -q origin >>"$RUN_LOG" 2>&1; then
      log warn "git fetch failed (try $i)."
    else
      if git rev-parse -q --verify origin/main >/dev/null && ! git merge-base --is-ancestor origin/main HEAD; then
        log warn "origin/main moved; rebasing onto it."
        if ! git -C "$REPO" rebase --autostash origin/main >>"$RUN_LOG" 2>&1; then
          git -C "$REPO" rebase --abort >/dev/null 2>&1 || true
          deploy_fail "rebase onto origin/main conflicted; nothing pushed"
          return 1
        fi
      fi
      check_remote
      check_push_scope
      if git push -q origin HEAD:main >>"$RUN_LOG" 2>&1; then
        log ok "Pushed $(git rev-parse --short HEAD) to origin/main."
        DEPLOY_STATE="pushed $(git rev-parse --short HEAD); waiting for $WORKFLOW"
        return 0
      fi
      log warn "git push failed (try $i)."
    fi
    ((i < 3)) || break
    log warn "Retrying the push in $((i * 30)) s."
    wait_with_status "$(secs $((i * 30)))" 'push retry'
  done
  DEPLOY_STATE='not pushed: git push failed three times'
  deploy_fail "git push failed three times"
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

# watch_run ID: poll until done, showing the current step. Returns 0 on success, 1 when the run
# failed (the failed log and its "job<TAB>step" names saved next to it), 2 when it could not be
# watched (WATCH_ERR says why).
WATCH_ERR=''
watch_run() {
  local id=$1 json status conclusion step started unknown=0
  WATCH_ERR=''
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
      if ((unknown >= 40)); then
        WATCH_ERR="gh could not read deploy run $id for 10 min; check it by hand"
        return 2
      fi
    else
      unknown=0
    fi
    if (($(date +%s) - started >= $(secs 5400))); then
      WATCH_ERR="deploy run $id did not finish in 90 min; check it by hand"
      return 2
    fi
    for _ in $(seq 1 "$(secs 15)"); do
      render_status
      sleep 1
    done
  done
}

# deploy_said REGEX LOG: a line the workflow's step printed, not its script as GitHub echoes it
# (the echo carries a colour escape after the timestamp, so a grep for the text alone matched the
# script's own `echo "ABORT: …"` and read every droplet failure as live connections).
TS_RE=$'\t[0-9]{4}-[0-9-]+T[0-9:.]+Z '
deploy_said() { grep -qE "${TS_RE}$1" "$2" 2>/dev/null; }

# deploy_once mid|final: checks, push, the deploy run and its recovery, the live check.
# Returns 0 once the site answers. The workflow's own checks, its image smoke test and an app
# that never became healthy are the code's fault and get a repair session; missing env vars on
# the droplet are Kim's to set (no re-run, no repair); anything else (ssh, the runner, the outside
# smoke check) gets one re-run.
deploy_once() {
  DEPLOY_MODE=$1
  ENV_PROBLEM=''
  local repairs=0 reruns=0 forced=0 failed_log failed_steps missing bad_env before rc i health
  FEATURE='' FEATURE_TITLE='' ATTEMPT=0
  if [[ $DEPLOY_MODE == final ]]; then
    final_gate
  else
    PHASE='checks before the early deploy'
    # The final deploy repairs failing checks; the early one just waits for it.
    run_gate || {
      deploy_fail "checks fail, so the early deploy is skipped (the final deploy repairs them)"
      return 1
    }
  fi

  if [[ ! -f $REPO/.github/workflows/$WORKFLOW ]]; then
    DEPLOY_STATE="not pushed: .github/workflows/$WORKFLOW is missing (F60 writes it; gated or unbuilt?)"
    deploy_fail ".github/workflows/$WORKFLOW is missing, so a push would not deploy; F60 should have added it"
    return 1
  fi
  push_main || return 1
  SHA=$(git rev-parse HEAD)
  PUSHED_AT=$(date +%s)
  RUN_ID=$(find_run push "$PUSHED_AT" "$SHA") || {
    log warn "No push-triggered deploy run appeared; dispatching one."
    gh workflow run "$WORKFLOW" --ref main >>"$RUN_LOG" 2>&1 || {
      deploy_fail "gh workflow run failed"
      return 1
    }
    RUN_ID=$(find_run workflow_dispatch "$PUSHED_AT") || {
      deploy_fail "no deploy run appeared"
      return 1
    }
  }

  while :; do
    rc=0
    watch_run "$RUN_ID" || rc=$?
    ((rc == 0)) && break
    if ((rc == 2)); then
      deploy_fail "$WATCH_ERR"
      return 1
    fi
    failed_log="$RUN/deploy-$RUN_ID-failed.log"
    failed_steps=$(cat "$RUN/deploy-$RUN_ID-failed-steps.txt" 2>/dev/null || true)
    missing=$(sed -nE "s/.*${TS_RE}ABORT: missing env: *([^(]*[^ (]).*/\\1/p" "$failed_log" 2>/dev/null | head -1)
    # The app's own startup check (reference/stack-node.md): a value is there but wrong.
    bad_env=$(sed -nE "s/.*${TS_RE}.*(Invalid environment: .*)/\\1/p" "$failed_log" 2>/dev/null | head -1 | cut -c1-240)
    if [[ -n $missing || -n $bad_env ]]; then
      if [[ -n $missing ]]; then
        ENV_PROBLEM="set $missing in /opt/$APP/.env (names in .env.example); the deploy stopped before touching the app"
      else
        ENV_PROBLEM="the app rejected /opt/$APP/.env and the deploy rolled back: $bad_env"
      fi
      DEPLOY_STATE="not live: $ENV_PROBLEM"
      notify 'Deploy needs the droplet env fixed' "$ENV_PROBLEM"
      deploy_fail "the droplet's env needs Kim: $ENV_PROBLEM"
      return 1
    elif deploy_said 'ABORT: [0-9]+ live connection' "$failed_log" && ((forced == 0)); then
      forced=1
      log warn "Live connections blocked the deploy; dispatching with force=true (ends live connections)."
      notify 'Forcing deploy' 'Live connections blocked it; force=true ends live connections'
      PUSHED_AT=$(date +%s)
      gh workflow run "$WORKFLOW" --ref main -f force=true >>"$RUN_LOG" 2>&1 || {
        deploy_fail "gh workflow run failed"
        return 1
      }
      RUN_ID=$(find_run workflow_dispatch "$PUSHED_AT") || {
        deploy_fail "the forced deploy run never appeared"
        return 1
      }
    elif { grep -qE "$CI_STEPS" <<<"$failed_steps" || deploy_said "$APP:[^ ]+ never became healthy" "$failed_log"; } && ((repairs < 2)); then
      repairs=$((repairs + 1))
      log warn "The deploy failed in the code's part; repair session $repairs."
      before=$(git rev-parse HEAD)
      repair "repair-ci-$repairs" "The GitHub Actions deploy run failed at: $failed_steps
Its failed-step log ends with (an app that never became healthy shows its container log here):
$(tail -120 "$failed_log")"
      if dirty; then stash_changes "CI repair $repairs leftovers"; fi
      [[ $(git rev-parse HEAD) != "$before" ]] || {
        deploy_fail "the CI repair session committed nothing; code is pushed but not live"
        return 1
      }
      run_gate || {
        deploy_fail "local checks fail after the CI repair; not pushing again"
        return 1
      }
      push_main || return 1
      SHA=$(git rev-parse HEAD)
      PUSHED_AT=$(date +%s)
      RUN_ID=$(find_run push "$PUSHED_AT" "$SHA") || {
        deploy_fail "no deploy run appeared after the repair push"
        return 1
      }
    elif ((reruns == 0)); then
      reruns=1
      log warn "Deploy failed for another reason; re-running the failed jobs once."
      gh run rerun "$RUN_ID" --failed >>"$RUN_LOG" 2>&1 || {
        deploy_fail "gh run rerun failed"
        return 1
      }
      # Until GitHub requeues it, the run still reads completed/failure.
      for _ in $(seq 1 24); do
        [[ $(gh run view "$RUN_ID" --json status --jq .status 2>>"$RUN_LOG") == completed ]] || break
        sleep "$(secs 5)"
      done
    else
      notify 'Deploy failed' "Run $RUN_ID"
      DEPLOY_STATE="failed: deploy run $RUN_ID failed again ($(paste -sd, "$RUN/deploy-$RUN_ID-failed-steps.txt" 2>/dev/null)); code is pushed but not live. Log: $RUN/deploy-$RUN_ID-failed.log"
      deploy_fail "deploy run $RUN_ID failed again; code is pushed but not live"
      return 1
    fi
  done

  DEPLOY_STATE="deployed $(git rev-parse --short HEAD): $(gh run view "$RUN_ID" --json url --jq .url 2>/dev/null || echo "run $RUN_ID") succeeded"
  PHASE='checking the live site'
  for i in 1 2 3 4 5; do
    if health=$(curl -fsS --max-time 10 "$LIVE_URL$HEALTH_PATH") && [[ $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$LIVE_URL/") == 200 ]]; then
      LIVE_STATE="$LIVE_URL$HEALTH_PATH answered: $(head -c 200 <<<"$health")"
      log ok "Live: $LIVE_URL$HEALTH_PATH → $health"
      return 0
    fi
    log warn "Live check $i failed; retrying in 20 s."
    wait_with_status "$(secs 20)" 'live check'
  done
  LIVE_STATE="FAILED: $LIVE_URL$HEALTH_PATH or $LIVE_URL/ did not answer 200 after the deploy"
  deploy_fail "the deploy succeeded but $LIVE_URL does not answer"
}

# The early deploy: once, right after the feature that wrote the deploy workflow (it was not in
# HEAD when the run started), while features remain. Whatever happens, the build goes on.
EARLY_DONE=0
maybe_deploy_early() {
  ((DEPLOY && !EARLY_DONE)) || return 0
  [[ -f $REPO/.github/workflows/$WORKFLOW ]] || return 0
  git cat-file -e "$RUN_HEAD_AT_START:.github/workflows/$WORKFLOW" 2>/dev/null && return 0
  [[ -n $(next_target) ]] || return 0
  EARLY_DONE=1
  log info "━━ Early deploy: $WORKFLOW exists now; deploying what is built before going on."
  if deploy_once mid; then
    EARLY_STATE="live: $DEPLOY_STATE"
    notify "$APP_TITLE early deploy is live" "$LIVE_URL"
  fi
  # The final deploy reports its own outcome.
  DEPLOY_STATE='not reached (the run stopped before the final push)'
  LIVE_STATE='not checked'
  DEPLOY_MODE=final
  return 0
}

# A feature commit the push guard refuses (a fake key shaped like a real one, an agent file) is
# taken back out of history, so it never ships: its work stays in the tree, the feature goes back
# to [~], and the next attempt is told what to fix. Stops the run if the refusal is older.
uncommit_feature() {
  local id=$1 before=$2 note="$RUN/$1-a$ATTEMPT-push-guard.txt"
  cp -- "$RUN/push-guard.txt" "$note"
  log err "✘ $id's commit fails the push guard ($(head -1 "$note")); un-committing it for the next attempt (see $note)."
  git reset -q --mixed "$before"
  git show "$before:./docs/ROADMAP.md" >docs/ROADMAP.md
  "${ROADMAP_JS[@]}" mark "$id" '~' >/dev/null || die "could not mark $id [~] in docs/ROADMAP.md"
  push_guard || die "the push guard refuses commits from before $id (see $RUN/push-guard.txt); nothing pushed"
  SESSION_NOTE="The previous attempt at $id committed, but scripts/autopilot.sh's push guard refused the commit and took it back out of history. Its work is uncommitted in the tree and $id is marked [~]: resume it. The guard said:
$(head -c 3000 "$note")
Fix exactly that (fake keys: see .claude/rules/tests.md; never weaken a test to do it), finish the feature and commit it again."
}

# ---------------------------------------------------------------------------------------------
# Feature loop

declare -A ATTEMPTS=()
RETRY_PASS=0
SESSIONS=0
GIVEUPS_IN_A_ROW=0
BUSY_WAITS=0

while :; do
  refresh_counts
  FEATURE=$(next_target)
  if [[ -z $FEATURE ]]; then
    ((!DRY_RUN && !RETRY_PASS)) && retry_blocked && continue
    break
  fi
  FEATURE_TITLE=$(feature_title "$FEATURE")
  FEATURE_MS=$(feature_ms "$FEATURE")
  ATTEMPTS[$FEATURE]=$((${ATTEMPTS[$FEATURE]:-0} + 1))
  ATTEMPT=${ATTEMPTS[$FEATURE]}
  PHASE='building'
  [[ -n ${FEAT_START[$FEATURE]:-} ]] || FEAT_START[$FEATURE]=$(date +%s)
  queue_refresh
  ETA_AT=0

  if ((DRY_RUN)); then
    log info "Would run: claude -p \"$(feature_prompt | head -c 60)\" for $FEATURE $FEATURE_TITLE"
    FEATURE=''
    dry_run_checks
    PHASE='dry run complete'
    render_status
    exit 0
  fi

  ((SESSIONS < MAX_SESSIONS)) || die "reached $MAX_SESSIONS sessions; something is wrong"
  SESSIONS=$((SESSIONS + 1))
  before=$(git rev-parse HEAD)
  log info "━━ $FEATURE $FEATURE_TITLE · attempt $ATTEMPT/$MAX_ATTEMPTS · session $SESSIONS"
  run_session "$FEATURE-a$ATTEMPT" "$(feature_prompt)"
  SESSION_NOTE=''

  mark=$(feature_mark "$FEATURE")
  new_feat=$(git log --format=%s "$before..HEAD" | grep -cE "$FEAT_RE" || true)
  committed=0
  guard_refused=0
  if ((new_feat > 0)) && [[ $mark != '~' && $mark != '!' ]]; then
    committed=1
    if ! push_guard; then
      uncommit_feature "$FEATURE" "$before"
      committed=0 guard_refused=1
    fi
  fi

  if [[ $mark == '!' ]]; then
    log err "$FEATURE was marked blocked: $(sed -n "/^- \[!\] $FEATURE /,/^- \[/p" docs/ROADMAP.md | grep -m1 'Blocked:' | sed 's/^ *- Blocked: *//')"
    notify "$FEATURE blocked" "$FEATURE_TITLE"
    # Keep the marker and its notes; set the half-built code aside.
    commit_docs "docs: $FEATURE blocked (autopilot)"
    stash_changes "$FEATURE blocked, uncommitted work"
    GIVEUPS_IN_A_ROW=$((GIVEUPS_IN_A_ROW + 1))
  elif ((!guard_refused)) && [[ -f $STATE/no_skill && ! -f $STATE/inline_skill && $before == "$(git rev-parse HEAD)" ]]; then
    log warn "/next-feature was not recognised in headless mode; inlining its SKILL.md from now on."
    echo 1 >"$STATE/inline_skill"
    ATTEMPTS[$FEATURE]=$((ATTEMPT - 1))
    continue
  elif ((committed)); then
    took=$(($(date +%s) - ${FEAT_START[$FEATURE]} - ${FEAT_WAITED[$FEATURE]:-0}))
    printf '%s\t%s\n' "$FEATURE" "$took" >>"$RUN/durations.tsv"
    unset 'FEAT_START[$FEATURE]'
    load_history
    refresh_counts
    queue_refresh
    eta_compute 1
    log ok "✔ $FEATURE committed in $(fmt_dur "$took"): $(git log -1 --format=%s -- .) · ETA $ETA_TXT"
    notify "$FEATURE done" "$FEATURE_TITLE · $(fmt_dur "$took") · $ETA_LEFT"
    # Stray files (screenshots, a scratch note) would make the next session stop and stash.
    if dirty; then
      stash_changes "$FEATURE leftovers after its commit"
    fi
    GIVEUPS_IN_A_ROW=0
    BUSY_WAITS=0
    LIMIT_WAITS=0
    maybe_deploy_early
  else
    blocker=''
    ((guard_refused)) || blocker=$(session_blocker "$FEATURE-a$ATTEMPT")
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
    if ((guard_refused)); then
      :
    elif ((SESSION_RC == 124 || SESSION_RC == 137)); then
      log err "✘ $FEATURE attempt $ATTEMPT timed out after $SESSION_TIMEOUT (see $RUN/$FEATURE-a$ATTEMPT.jsonl)."
    else
      log err "✘ $FEATURE attempt $ATTEMPT did not finish (exit $SESSION_RC; see $RUN/$FEATURE-a$ATTEMPT.jsonl)."
    fi
    if ((ATTEMPT >= MAX_ATTEMPTS)); then
      log err "Giving up on $FEATURE after $ATTEMPT sessions."
      notify "Gave up on $FEATURE" "$FEATURE_TITLE"
      SESSION_NOTE=''
      stash_changes "$FEATURE gave up after $ATTEMPT sessions"
      # An uncommitted split (F95 into F95a/F95b) went into the stash: mark the original.
      target=$FEATURE
      [[ -n $(feature_mark "$target") ]] || target=${FEATURE%[a-z]}
      "${ROADMAP_JS[@]}" mark "$target" '!' "autopilot: $ATTEMPT unattended sessions did not finish it; logs in $RUN" >/dev/null ||
        die "could not mark $target blocked in docs/ROADMAP.md"
      commit_docs "docs: $target blocked (autopilot)"
      GIVEUPS_IN_A_ROW=$((GIVEUPS_IN_A_ROW + 1))
    else
      wait_with_status "$(secs 60)" 'retrying soon'
    fi
  fi
  ((GIVEUPS_IN_A_ROW < MAX_GIVEUPS_IN_A_ROW)) || die "$GIVEUPS_IN_A_ROW features in a row were blocked; stopping before burning the rest"
done

FEATURE=''
TAIL_START=$(date +%s)
refresh_counts
queue_refresh
summary=$(roadmap_next | grep -E '^(Done|Blocked|Gated|Not eligible)' | paste -sd' ' -)
log info "Roadmap loop finished: $summary"
# No eligible feature, and not every remaining one waits on a gate or a blocked feature: a
# dependency is missing or circular.
roadmap_next | grep -q '^Nothing left' || die "features remain but none is eligible: $summary"
if ! roadmap_next | grep -q '^Blocked: none'; then
  log warn "Still blocked after the extra pass: $(roadmap_next | sed -n 's/^Blocked: //p'). Shipping what is built without them."
  notify 'Autopilot: some features are blocked' 'Shipping the rest; see the morning report'
fi
if ! roadmap_next | grep -q '^Gated: none'; then
  log warn "Waiting on Kim's approval: $(roadmap_next | sed -n 's/^Gated: //p'). Shipping what is built."
fi
if ((DRY_RUN)); then
  log info "Dry run: nothing left to build."
  dry_run_checks
  exit 0
fi

if ((!DEPLOY)); then
  final_gate
  PHASE='done'
  DEPLOY_STATE='skipped (--no-deploy): built and checked, not pushed'
  log ok "All features built and checked. --no-deploy: not pushing."
  notify 'Autopilot done' 'Built and checked; not pushed (--no-deploy)'
  exit 0
fi

deploy_once final
notify "$APP_TITLE is live" "$LIVE_URL · $(kim_checks) Kim checks queued in docs/PROGRESS.md"
WORKTREE_REMOVE=1
PHASE='done'
exit 0
