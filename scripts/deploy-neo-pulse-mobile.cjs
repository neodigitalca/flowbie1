#!/usr/bin/env node
process.env.DEPLOY_SITE = "neodigital.ca";
process.env.DEPLOY_MOBILE = "1";
import("./../wordpress-plugins/deploy-neo-pulse-app.js");
