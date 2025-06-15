#!/bin/bash

# Exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Make the chess engine executable
chmod +x ./nexus-engine
