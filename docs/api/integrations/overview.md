---
title: Integrations overview
slug: integrations/overview
section: Integrations
order: 5
---

The **integrations** namespace and related **manager-*** routes configure NEO Pulse server-side credentials and WordPress properties.

## Manager routes

| Prefix | Purpose |
| --- | --- |
| `/api/manager-cloud-settings/*` | OpenRouter, DataForSEO, AgentMail keys stored for the workspace |
| `/api/manager-wordpress-properties/*` | CRUD for connected WordPress sites |

These routes use the logged-in session and tie settings to the NEO Pulse install.

## Product integrations

Namespaces such as `gsc`, `ga`, `gmb`, `dataforseo`, and `semrush` read keys from manager cloud settings on the server. Your API client does not pass vendor API keys in the request body for most calls.

## WordPress link

Properties saved here are the same sites used by [WordPress overview](../wordpress/overview) actions. Test connection after adding or updating a property.
