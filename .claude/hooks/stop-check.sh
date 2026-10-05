#!/bin/zsh
# Stop: refuse to finish while typecheck/lint/unit tests fail (e2e runs at milestones).
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
input=$(cat)
# Avoid infinite loops: if we already blocked once in this stop cycle, let it through.
[[ "$input" == *'"stop_hook_active":true'* ]] && exit 0
out=$( (npm run -s typecheck && npm run -s lint && npm run -s test) 2>&1 )
if [[ $? -ne 0 ]]; then
  echo "npm run typecheck/lint/test failed — fix before finishing:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
