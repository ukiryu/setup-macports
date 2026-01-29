#!/bin/bash

set -e

VERSION="3.6.0"
if [[ "$OSTYPE" == "darwin"* ]]; then
  ARCH="darwin-x64"
else
  ARCH="linux-x64"
fi

LICENSED_DIR="_temp/licensed-${VERSION}"
LICENSED_BIN="${LICENSED_DIR}/licensed"

if [ ! -f "${LICENSED_DIR}.done" ]; then
  echo 'Downloading licensed...'
  mkdir -p "${LICENSED_DIR}"
  pushd "${LICENSED_DIR}"
  curl -Lfs -o licensed.tar.gz "https://github.com/github/licensed/releases/download/${VERSION}/licensed-${VERSION}-${ARCH}.tar.gz"
  tar -xzf licensed.tar.gz
  popd
  touch "${LICENSED_DIR}.done"
fi

echo 'Running: licensed status'
"${LICENSED_BIN}" status
