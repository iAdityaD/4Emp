#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
output=$(mktemp -d)
trap 'rm -rf "$output"' EXIT
javac -d "$output" app/src/main/java/com/fouremp/app/ScheduleMath.java tests/ScheduleMathTest.java
java -cp "$output" ScheduleMathTest
