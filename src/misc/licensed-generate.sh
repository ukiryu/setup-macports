#!/bin/bash
# Licensed generate script
node_modules/.bin/licensed --exclude "MIT; ISC; Apache-2.0; BSD-2-Clause; BSD-3-Clause; BSD*" --output src/misc/.licensedrc.json
