#!/bin/sh
# Bump the ?v= cache version everywhere (index.html, js/, css/) so browsers fetch the new files.
set -e
cd "$(dirname "$0")"
old=$(grep -o 'main\.js?v=[0-9]*' index.html | cut -d= -f2)
new=$((old + 1))
grep -rl "?v=$old" index.html js css | xargs sed -i "s/?v=$old\([^0-9]\)/?v=$new\1/g"
left=$(grep -r "?v=$old[^0-9]" index.html js css || true)
[ -z "$left" ] || { echo "still at v=$old:"; echo "$left"; exit 1; }
echo "v=$old -> v=$new"
