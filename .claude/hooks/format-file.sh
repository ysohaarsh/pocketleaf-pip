#!/bin/zsh
# PostToolUse(Edit|Write): format + autofix the touched file. Never blocks.
f=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.file_path??"")}catch{}})')
[[ -z "$f" || ! -f "$f" ]] && exit 0
root=$(cd "$(dirname "$f")" && git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
[[ -d node_modules ]] || exit 0
case "$f" in
  *.ts|*.tsx|*.js|*.json|*.css|*.md|*.yml|*.html)
    npx --no-install prettier --write --log-level=silent "$f" >/dev/null 2>&1 ;;
esac
case "$f" in
  *.ts|*.tsx|*.js) npx --no-install eslint --fix "$f" >/dev/null 2>&1 ;;
esac
exit 0
