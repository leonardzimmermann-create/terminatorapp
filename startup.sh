#!/bin/sh
cd /home/site/wwwroot
node node_modules/prisma/build/index.js db push --force-reset --skip-generate
node node_modules/next/dist/bin/next start
