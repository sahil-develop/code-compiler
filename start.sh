#!/bin/bash
cd "$(dirname "$0")"
echo "Starting CodeRunner at http://localhost:3737"
open http://localhost:3737
node server.js
