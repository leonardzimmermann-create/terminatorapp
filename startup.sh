#!/bin/sh
node /node_modules/prisma/build/index.js db push --skip-generate
node /node_modules/next/dist/bin/next start
