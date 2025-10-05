#!/bin/bash

# Fix URLs in a loop until none are found
MAX_ITERATIONS=10
iteration=1

while [ $iteration -le $MAX_ITERATIONS ]; do
  echo "=== Iteration $iteration ==="

  result=$(curl -s -X POST "http://localhost:3000/api/v1/admin/fix-urls" \
    -H "Authorization: Bearer odfp123")

  found=$(echo "$result" | jq -r '.found // 0')
  fixed=$(echo "$result" | jq -r '.fixed // 0')

  echo "Found: $found broken URLs"
  echo "Fixed: $fixed URLs"
  echo "$result" | jq '.'

  if [ "$found" -eq 0 ]; then
    echo "✅ No more broken URLs found!"
    break
  fi

  iteration=$((iteration + 1))
  echo ""
done

echo "Done after $iteration iterations"
