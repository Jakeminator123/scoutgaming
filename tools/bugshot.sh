#!/bin/bash
# Bug screenshot: capture -> pick/create folder -> name -> comment -> save + index.
# Every step has Skip. Esc during capture aborts.
BASE="$HOME/Screenshots/Bugs"
mkdir -p "$BASE"
STAMP=$(date +%Y%m%d-%H%M%S)
TMP="$(mktemp -d)/shot.png"

/usr/sbin/screencapture -i "$TMP"
[ -s "$TMP" ] || exit 0

# ---- 1. Folder ----
FOLDERS=$(cd "$BASE" && find . -mindepth 1 -maxdepth 3 -type d -not -path '*/.*' | sed 's|^\./||' | sort)
LIST=""
while IFS= read -r f; do [ -n "$f" ] && LIST="$LIST, \"$f\""; done <<< "$FOLDERS"
CHOICE=$(osascript <<OSA
set opts to {"＋ New folder…", "Skip (save in Bugs/)"$LIST}
tell application "System Events"
  activate
  set r to choose from list opts with title "Bug screenshot" with prompt "Save to folder:" default items {item 1 of opts} OK button name "Choose" cancel button name "Abort"
end tell
if r is false then return "__ABORT__"
return item 1 of r
OSA
)
[ "$CHOICE" = "__ABORT__" ] && exit 0
if [ "$CHOICE" = "＋ New folder…" ]; then
  NEW=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "New folder (use / for subfolders, e.g. targetaid/checkout):" default answer "" with title "Bug screenshot" buttons {"Skip", "Create"} default button "Create"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
  NEW=$(echo "$NEW" | sed 's|^/*||; s|/*$||')
  DIR="$BASE/${NEW:-}"
elif [[ "$CHOICE" == Skip* ]]; then
  DIR="$BASE"
else
  DIR="$BASE/$CHOICE"
fi
mkdir -p "$DIR"

# ---- 2. Name ----
NAME=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "File name:" default answer "bug-$STAMP" with title "Bug screenshot" buttons {"Skip", "OK"} default button "OK"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
NAME=$(echo "${NAME:-bug-$STAMP}" | sed 's/[\/:]/-/g; s/\.png$//')
[ -e "$DIR/$NAME.png" ] && NAME="$NAME-$STAMP"

# ---- 3. Comment ----
COMMENT=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Describe the issue (linked to $NAME.png):" default answer "" with title "Bug screenshot" buttons {"Skip", "Save"} default button "Save"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)

# ---- 4. Save ----
mv "$TMP" "$DIR/$NAME.png"
REL="${DIR#$BASE/}"; [ "$REL" = "$BASE" ] && REL="."
if [ -n "$COMMENT" ]; then
  printf -- '---\nimage: %s.png\ndate: %s\nfolder: %s\n---\n%s\n' "$NAME" "$(date '+%Y-%m-%d %H:%M')" "$REL" "$COMMENT" > "$DIR/$NAME.md"
  printf -- '- [ ] **%s** (%s): %s  \n  ![%s](%s.png)\n' "$NAME" "$(date '+%Y-%m-%d %H:%M')" "$COMMENT" "$NAME" "$NAME" >> "$DIR/ISSUES.md"
else
  printf -- '- [ ] **%s** (%s)  \n  ![%s](%s.png)\n' "$NAME" "$(date '+%Y-%m-%d %H:%M')" "$NAME" "$NAME" >> "$DIR/ISSUES.md"
fi

# ---- 5. Jira (optional) ----
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CACHE="$HOME/.cache/bugshot"; mkdir -p "$CACHE"
JIRA_KEY=""
WANT=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Create a Jira ticket for $NAME.png?" with title "Bug screenshot" buttons {"Skip", "Create Jira"} default button "Create Jira"
end tell
return button returned of r
OSA
)
if [ "$WANT" = "Create Jira" ]; then
  # 1) Kevin's Axelio vault, if present. 2) env vars. 3) a one-time prompt,
  # cached per-user so every dev supplies their own Jira API token.
  . "$HOME/.claude/skills/_lib/axcreds.sh" 2>/dev/null
  eval "$(ax_mint jira 2>/dev/null || true)"
  SITE="${JIRA_SITE:-scoutgaming.atlassian.net}"
  CREDS_FILE="$CACHE/jira_creds"
  if [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
    [ -f "$CREDS_FILE" ] && . "$CREDS_FILE"
  fi
  if [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
    JIRA_EMAIL=$(osascript -e 'text returned of (display dialog "Jira email:" default answer "" with title "Bug screenshot: first-time Jira setup" buttons {"OK"} default button "OK")' 2>/dev/null)
    JIRA_API_TOKEN=$(osascript -e 'text returned of (display dialog "Jira API token (id.atlassian.com/manage-profile/security/api-tokens):" default answer "" with title "Bug screenshot: first-time Jira setup" buttons {"OK"} default button "OK" with hidden answer)' 2>/dev/null)
    if [ -n "$JIRA_EMAIL" ] && [ -n "$JIRA_API_TOKEN" ]; then
      printf 'JIRA_EMAIL=%q\nJIRA_API_TOKEN=%q\nJIRA_SITE=%q\n' "$JIRA_EMAIL" "$JIRA_API_TOKEN" "$SITE" > "$CREDS_FILE"
      chmod 600 "$CREDS_FILE"
    fi
  fi
  if [ -z "${JIRA_EMAIL:-}" ] || [ -z "${JIRA_API_TOKEN:-}" ]; then
    osascript -e 'display notification "No Jira credentials set" with title "Bug screenshot"'
  else
    J() { curl -s -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Accept: application/json" "$@"; }
    icon_for() { case "$1" in
      Bugg|Bug|"Subtask Bug") echo "🐞";; Uppgift|Task|"Tech Task") echo "✅";; Berättelse|Story) echo "📗";;
      Epic) echo "⚡";; Spike) echo "🔬";; Test*|Precondition) echo "🧪";; *) echo "📄";; esac; }
    # projects (cached 24h)
    PF="$CACHE/projects.tsv"
    if [ ! -s "$PF" ] || [ -n "$(find "$PF" -mmin +1440)" ]; then
      J "https://$SITE/rest/api/3/project/search?maxResults=100&orderBy=key" | jq -r '.values[] | "\(.key)\t\(.name)"' > "$PF.tmp" && mv "$PF.tmp" "$PF"
    fi
    LAST=$(cat "$CACHE/last_project" 2>/dev/null || echo SV2)
    PLIST=""; DEF=""
    while IFS=$'\t' read -r k n; do
      item="🟦 $k — $n"; [ "$k" = "$LAST" ] && DEF="$item"
      PLIST="$PLIST, \"$item\""
    done < "$PF"
    PLIST="${PLIST#, }"; [ -z "$DEF" ] && DEF="${PLIST%%,*}" && DEF="${DEF//\"/}"
    PCHOICE=$(osascript <<OSA
tell application "System Events"
  activate
  set r to choose from list {$PLIST} with title "Jira: project" with prompt "Which project?" default items {"$DEF"} OK button name "Next" cancel button name "Skip"
end tell
if r is false then return ""
return item 1 of r
OSA
)
    if [ -n "$PCHOICE" ]; then
      PKEY=$(echo "$PCHOICE" | sed -E 's/^🟦 ([A-Z0-9]+) — .*/\1/')
      echo "$PKEY" > "$CACHE/last_project"
      # issue types (non-subtask)
      TYPES=$(J "https://$SITE/rest/api/3/issue/createmeta/$PKEY/issuetypes" | jq -r '.issueTypes[]? | select(.subtask==false) | "\(.id)\t\(.name)"')
      TLIST=""; TDEF=""
      while IFS=$'\t' read -r id n; do
        [ -z "$id" ] && continue
        item="$(icon_for "$n") $n"
        case "$n" in Bugg|Bug) TDEF="$item";; esac
        [ -z "$TDEF" ] && case "$n" in Uppgift|Task) TDEF="$item";; esac
        TLIST="$TLIST, \"$item\""
      done <<< "$TYPES"
      TLIST="${TLIST#, }"; [ -z "$TDEF" ] && TDEF="${TLIST%%,*}" && TDEF="${TDEF//\"/}"
      TCHOICE=$(osascript <<OSA
tell application "System Events"
  activate
  set r to choose from list {$TLIST} with title "Jira: $PKEY" with prompt "Issue type:" default items {"$TDEF"} OK button name "Next" cancel button name "Skip"
end tell
if r is false then return ""
return item 1 of r
OSA
)
      if [ -n "$TCHOICE" ]; then
        TNAME="${TCHOICE#* }"
        TID=$(echo "$TYPES" | awk -F'\t' -v n="$TNAME" '$2==n{print $1; exit}')
        DEFSUM="${COMMENT%%$'\n'*}"; DEFSUM="${DEFSUM:-$NAME}"; DEFSUM="${DEFSUM:0:120}"
        SUMMARY=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Summary:" default answer "$(printf '%s' "$DEFSUM" | sed 's/"/\\"/g')" with title "Jira: $PKEY / $TNAME" buttons {"Skip", "Create"} default button "Create"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
        if [ -n "$SUMMARY" ]; then
          # Preserve every answer locally before Jira is contacted.
          STEPS=""; EXPECTED=""
          if [ "$TNAME" = "Bugg" ] || [ "$TNAME" = "Bug" ]; then
            STEPS=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Steps to reproduce (optional):" default answer "" with title "Jira: $PKEY / $TNAME" buttons {"Skip", "Next"} default button "Next"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
            EXPECTED=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Expected result (optional):" default answer "" with title "Jira: $PKEY / $TNAME" buttons {"Skip", "Create"} default button "Create"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
            # Expected-result screenshot: capture a new one, or point at one you already have.
            EXPECTED_IMG=""
            ERWANT=$(osascript <<OSA
tell application "System Events"
  activate
  set r to choose from list {"Skip", "Capture new screenshot", "Choose existing image", "Frame from a video (URL or file)"} with title "Jira: $PKEY / $TNAME" with prompt "Attach an expected-result image?" default items {"Capture new screenshot"} OK button name "Next" cancel button name "Skip"
end tell
if r is false then return "Skip"
return item 1 of r
OSA
)
            if [ "$ERWANT" = "Capture new screenshot" ]; then
              ERTMP="$(mktemp -d)/expected.png"
              /usr/sbin/screencapture -i "$ERTMP"
              [ -s "$ERTMP" ] && EXPECTED_IMG="$DIR/$NAME-expected.png" && mv "$ERTMP" "$EXPECTED_IMG"
            elif [ "$ERWANT" = "Choose existing image" ]; then
              ERPATH=$(osascript <<OSA
tell application "System Events"
  activate
end tell
try
  set f to choose file with prompt "Pick the expected-result screenshot:" of type {"png","jpg","jpeg"}
  return POSIX path of f
on error
  return ""
end try
OSA
)
              if [ -n "$ERPATH" ] && [ -f "$ERPATH" ]; then
                EXT="${ERPATH##*.}"
                EXPECTED_IMG="$DIR/$NAME-expected.$EXT"
                cp "$ERPATH" "$EXPECTED_IMG"
              fi
            elif [ "$ERWANT" = "Frame from a video (URL or file)" ]; then
              VIDSRC=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Video URL or local file path:" default answer "" with title "Jira: $PKEY / $TNAME" buttons {"Skip", "Next"} default button "Next"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
              if [ -n "$VIDSRC" ]; then
                VIDTIME=$(osascript <<OSA
tell application "System Events"
  activate
  set r to display dialog "Timestamp to grab (mm:ss or hh:mm:ss):" default answer "00:00" with title "Jira: $PKEY / $TNAME" buttons {"Skip", "Grab frame"} default button "Grab frame"
end tell
if button returned of r is "Skip" then return ""
return text returned of r
OSA
)
                if [ -n "$VIDTIME" ]; then
                  ERTMP="$DIR/$NAME-expected.png"
                  ffmpeg -y -ss "$VIDTIME" -i "$VIDSRC" -frames:v 1 -q:v 2 "$ERTMP" </dev/null >/tmp/bugshot-ffmpeg.log 2>&1
                  [ -s "$ERTMP" ] && EXPECTED_IMG="$ERTMP"
                  # Page URLs (YouTube/Loom/etc, not a raw video file) need resolving first.
                  if [ -z "$EXPECTED_IMG" ] && [[ "$VIDSRC" == http* ]] && command -v yt-dlp >/dev/null; then
                    DIRECT_URL=$(yt-dlp -g "$VIDSRC" 2>>/tmp/bugshot-ffmpeg.log | head -1)
                    if [ -n "$DIRECT_URL" ]; then
                      ffmpeg -y -ss "$VIDTIME" -i "$DIRECT_URL" -frames:v 1 -q:v 2 "$ERTMP" </dev/null >>/tmp/bugshot-ffmpeg.log 2>&1
                      [ -s "$ERTMP" ] && EXPECTED_IMG="$ERTMP"
                    fi
                  fi
                  if [ -z "$EXPECTED_IMG" ]; then
                    osascript -e 'display dialog "Could not grab that frame (bad URL/timestamp, or unsupported host). See /tmp/bugshot-ffmpeg.log" with title "Bug screenshot" buttons {"OK"}'
                  fi
                fi
              fi
            fi
          fi
          # Keep the user's exact answers even if Jira creation, custom fields,
          # or attachment upload fails. Never depend on a successful POST.
          jq -n --arg project "$PKEY" --arg type "$TID" --arg summary "$SUMMARY" \
            --arg description "$COMMENT" --arg steps "$STEPS" --arg expected "$EXPECTED" \
            --arg image "$NAME.png" --arg expected_image "${EXPECTED_IMG:+$(basename "$EXPECTED_IMG")}" \
            '{project:$project,issueType:$type,summary:$summary,description:$description,steps:$steps,expected:$expected,image:$image,expected_image:$expected_image}' \
            > "$DIR/$NAME.report.json" || exit 1
          {
            printf '\n## Jira report details\n\nSummary: %s\n' "$SUMMARY"
            [ -z "$STEPS" ] || printf '\n### Steps to reproduce\n\n%s\n' "$STEPS"
            [ -z "$EXPECTED" ] || printf '\n### Expected result\n\n%s\n' "$EXPECTED"
            [ -z "$EXPECTED_IMG" ] || printf '\n![expected result](%s)\n' "$(basename "$EXPECTED_IMG")"
          } >> "$DIR/$NAME.md"
          adf() { jq -n --arg t "$1" '{type:"doc",version:1,content:[{type:"paragraph",content:[{type:"text",text:$t}]}]}'; }
          DESC="${COMMENT:-Screenshot: $NAME.png}"
          # The description is the portable copy for every project, including
          # SV2's retry when its custom fields are unavailable on the screen.
          [ -z "$STEPS" ] || DESC="$DESC"$'\n\n'"Steps to reproduce:"$'\n'"$STEPS"
          [ -z "$EXPECTED" ] || DESC="$DESC"$'\n\n'"Expected result:"$'\n'"$EXPECTED"
          DESC="$DESC"$'\n\n'"Screenshot attached: $NAME.png"
          PAYLOAD=$(jq -n --arg p "$PKEY" --arg t "$TID" --arg s "$SUMMARY" --argjson d "$(adf "$DESC")" \
            '{fields:{project:{key:$p},issuetype:{id:$t},summary:$s,description:$d}}')
          # SV2 bug custom fields (customfield_10058/59/60) are plain textarea/string
          # fields, NOT rich-text/ADF — sending adf() objects here always got a 400 and
          # silently fell back to the no-customfields retry below. Fixed 2026-09-09.
          if [ "$PKEY" = "SV2" ] && { [ -n "$STEPS" ] || [ -n "$EXPECTED" ] || [ -n "$COMMENT" ]; }; then
            PAYLOAD=$(echo "$PAYLOAD" | jq --arg st "${STEPS:-See screenshot}" --arg ar "${COMMENT:-See screenshot}" --arg er "${EXPECTED:-See screenshot}" \
              '.fields.customfield_10058=$st | .fields.customfield_10059=$ar | .fields.customfield_10060=$er')
          fi
          RESP=$(J -X POST -H "Content-Type: application/json" --data "$PAYLOAD" "https://$SITE/rest/api/3/issue")
          JIRA_KEY=$(echo "$RESP" | jq -r '.key // empty')
          CUSTOMFIELDS_DROPPED=0
          if [ -z "$JIRA_KEY" ] && [ "$PKEY" = "SV2" ]; then
            # Custom fields still rejected for some other reason (e.g. screen config
            # changed) — retry without them so the ticket isn't lost, but say so.
            CUSTOMFIELDS_DROPPED=1
            PAYLOAD=$(echo "$PAYLOAD" | jq 'del(.fields.customfield_10058,.fields.customfield_10059,.fields.customfield_10060)')
            RESP=$(J -X POST -H "Content-Type: application/json" --data "$PAYLOAD" "https://$SITE/rest/api/3/issue")
            JIRA_KEY=$(echo "$RESP" | jq -r '.key // empty')
          fi
          if [ -n "$JIRA_KEY" ] && [ "$CUSTOMFIELDS_DROPPED" = "1" ]; then
            osascript -e "display notification \"Custom fields (Steps/Actual/Expected) rejected by Jira \\u2014 they're still in the description text\" with title \"Bug screenshot: $JIRA_KEY\""
          fi
          if [ -n "$JIRA_KEY" ]; then
            J -X POST -H "X-Atlassian-Token: no-check" -F "file=@$DIR/$NAME.png" "https://$SITE/rest/api/3/issue/$JIRA_KEY/attachments" >/dev/null
            [ -n "$EXPECTED_IMG" ] && [ -f "$EXPECTED_IMG" ] && J -X POST -H "X-Atlassian-Token: no-check" -F "file=@$EXPECTED_IMG" "https://$SITE/rest/api/3/issue/$JIRA_KEY/attachments" >/dev/null
            URL="https://$SITE/browse/$JIRA_KEY"
            printf -- 'jira: %s\n' "$URL" >> "$DIR/$NAME.md" 2>/dev/null
            sed -i '' "s|^- \[ \] \*\*$NAME\*\*|- [ ] [$JIRA_KEY]($URL) **$NAME**|" "$DIR/ISSUES.md"
            printf '%s' "$URL" | pbcopy
            osascript -e "display notification \"$JIRA_KEY created, link copied\" with title \"Jira ticket\" subtitle \"$SUMMARY\""
            open "$URL"
          else
            ERR=$(echo "$RESP" | jq -r '.errors // .errorMessages // .' | tr '\n' ' ' | cut -c1-200)
            osascript -e "display dialog \"Jira create failed: $ERR\" with title \"Bug screenshot\" buttons {\"OK\"}"
          fi
        fi
      fi
    fi
  fi
fi

if [ -z "$JIRA_KEY" ]; then
osascript -e "set the clipboard to (read (POSIX file \"$DIR/$NAME.png\") as «class PNGf»)" 2>/dev/null
  osascript -e "display notification \"$REL/$NAME.png (copied to clipboard)\" with title \"Bug screenshot saved\""
fi
