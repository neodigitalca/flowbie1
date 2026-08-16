#!/usr/bin/env node
process.env.DEPLOY_SITE = "flowbie.ca";
process.env.DEPLOY_PLUGIN = "0";
import("./../wordpress-plugins/deploy-neo-pulse-app.js");
