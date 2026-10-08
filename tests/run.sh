#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
output=$(mktemp -d)
trap 'rm -rf "$output"' EXIT
javac -d "$output" app/src/main/java/com/fouremp/app/ScheduleMath.java app/src/main/java/com/fouremp/app/WorkMath.java tests/ScheduleMathTest.java app/src/main/java/com/fouremp/app/DayMath.java tests/WorkMathTest.java tests/DayMathTest.java
java -cp "$output" ScheduleMathTest
java -cp "$output" WorkMathTest
java -cp "$output" DayMathTest
