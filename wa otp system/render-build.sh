#!/usr/bin/env bash
# Exit on error
set -o errexit

STORAGE_DIR=/opt/render/project/src/.render

if [ ! -d "$STORAGE_DIR/chrome" ]; then
  echo "...Installing Chrome"
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  
  # Google Chrome download aur extract karna
  wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x google-chrome-stable_current_amd64.deb .
  rm google-chrome-stable_current_amd64.deb
  
  echo "✅ Chrome installed in $STORAGE_DIR/chrome"
  cd $HOME/project/src
else
  echo "✅ Chrome is already installed in $STORAGE_DIR/chrome"
fi
