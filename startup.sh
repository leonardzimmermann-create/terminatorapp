#!/bin/sh
mkdir -p /home/data
cd /home/site/wwwroot
node node_modules/prisma/build/index.js db push --skip-generate
node node_modules/next/dist/bin/next start
