# CEO

## Project Description

NeoPulse is a server-side program that controls how a language model researches and writes AISEO for live sites. Work began in October 2025 and continues, with new features tested and regular updates. The method is query fan-out, in which one keyword becomes three to five research queries, the same class of split ChatGPT and Google use. Code then compiles those answers into a brief of search results, confirmed facts, and first-party claims, and a writing harness uses that brief to call the model once per heading under a token budget. Keys and publish stay on the server.

## What technological uncertainties did you attempt to overcome?

The technological uncertainty was whether we could control model-authored AISEO at batch so quality held on every job. The goal was one brief per job, one model call per heading, and one publish per URL. ChatGPT and Google now split one question across many source types (web, documents, video, news, Wikipedia, local, shopping), so a published page has to answer that split and stay first-party.

The investigation asked whether planner code, a verified brief, and a per-heading harness could do that work as one process.

* Can the planner turn one keyword into three to five research queries, and can verification write only confirmed facts into the brief?
* Can the harness keep writing rules in the system prompt and the brief in the user prompt, then build a first-party article one heading at a time?
* Can that same brief drive posts, service-area pages, Wikipedia research, a live refresh, and visitor chat on published pages?
* Can we automate the run so it saves progress and publishes each URL once, with keys on the server and a short site digest in the prompt?

## What work did you perform to overcome the technological uncertainties described in the previous answer?

We ran a systematic investigation in which each code change was a test, verified through Google Search Console, SEM, Google Analytics, and client retention and satisfaction. We kept the paths those signals confirmed and trimmed the rest. When the brief or the harness needed a change, we changed the prompt or the schema and tested again.

**Q4 2025 (October to December)**

Work started in October 2025 with hand-run Python: scrape, prompt, paste, publish. In Q4 we replaced that with a job runner in code: keyword in, live write out. In November we pointed posts and service-area pages at the live site and treated the city as a title modifier.

* Result: one runner handled both posts and service-area pages, throughput rose, and GSC, SEM, Analytics, and retention told us what to keep.

**Q1 2026 (January to March)**

We wrote the planner and the harness into the program. The planner emits three to five queries, search and a model fill them, verification writes the brief, and the harness then calls the model once per heading. Wikipedia text and images, plus image generation, ran on that same job, while Google APIs and the live site inventory ran on the server.

* Result: every job in a batch shared one brief shape, token use fell, and the same verification set confirmed the planner and harness.

**Q2 2026 (April to May)**

We locked the harness rules in templates: answer first, sourced figures, a comparison, a field observation. We added run-state automation so a job saves progress and published URLs. We added visitor chat that reads published pages. Live optimize re-runs fan-out to refresh the brief.

* Result: the tenth validated job matched the first, GSC, SEM, Analytics, and retention confirmed what stayed in the program, and the project continues with new features tested on the same verification set.

## What technological advancements did you achieve or attempt to achieve as a result of the work described in the previous answer?

The advancement is a control plane for model-authored AISEO, in which planner code fans out the keyword, a brief holds verified facts and first-party claims, a harness writes one heading per call, and automation publishes the live URL once.

That is the same class of query split ChatGPT and Google already run, built on our side as writing software. Keys stay in environment variables, the prompt gets a site digest and a per-heading budget, and the same contract runs posts, service-area pages, Wikipedia research, live refresh, and visitor chat.

The tenth validated job matches the first. We kept only the code GSC, SEM, Analytics, and client satisfaction confirmed, and the program remains under test and is updated as those signals confirm new work.

# Technical

## Project Description

NeoPulse is a server-side control plane that binds a language model to a research-and-write pipeline for live AISEO. Work began in October 2025 and continues, with new modules tested and regular stack updates. Planner code performs query fan-out, expanding one seed into three to five research queries of the same class ChatGPT and Google execute at retrieval time. A verification pass materializes a typed brief, and a writing harness issues one completion per heading, isolating stable rules in the system prompt and job state in the user prompt under a token budget. Credentials and publish remain server-side.

## What technological uncertainties did you attempt to overcome?

The technological uncertainty was whether we could close the loop on model-authored AISEO as an engineered system: a typed brief as the job contract, one completion per heading as the execution unit, and an idempotent publish. ChatGPT and Google already fan a query across web, documents, video, news, Wikipedia, local, and shopping, so the artifact we emit has to remain first-party under that retrieval.

We treated the stack as three cooperating modules (planner, brief, harness) and asked whether that architecture would hold quality across a batch.

* Can the planner emit a bounded query set, and can verification commit only confirmed facts into the brief?
* Can the harness enforce a system and user split and compile a first-party document as a sequence of heading-scoped completions?
* Can one brief object drive posts, service-area pages, Wikipedia research, live refresh, and retrieval-backed visitor chat?
* Can orchestration persist run state, publish each URL once, keep secrets on the server, and feed the model a site digest?

## What work did you perform to overcome the technological uncertainties described in the previous answer?

We ran the investigation as a sequence of module-level experiments. Each merge was scored against Google Search Console, SEM, Google Analytics, and client retention and satisfaction. Paths those signals confirmed stayed in the program; the rest were removed. Prompt and schema changes were the accepted edits to the writing contract, then we tested again.

**Q4 2025 (October to December)**

Work began in October 2025 as a linear Python path: scrape, prompt, paste, publish. In Q4 we replaced that script with a job runner that accepted a keyword and wrote to the live site. In November we bound posts and service-area collections to that runner and treated the city as a title modifier.

* Result: one runner executed both post and service-area jobs, throughput rose, and GSC, SEM, Analytics, and retention selected the paths we kept.

**Q1 2026 (January to March)**

We implemented the planner and the harness as first-class modules. The planner emits three to five queries, retrieval and a model fill them, verification writes the typed brief, and the harness dispatches one completion per heading. Wikipedia text and images, plus image generation, attached to the same job graph, while Google APIs and site inventory executed on the server.

* Result: every job in a batch shared one brief schema, token use fell, and the same verification set confirmed both modules.

**Q2 2026 (April to May)**

We encoded harness policy in templates (direct answer, sourced figures, comparison, field observation), added durable run state and a published-URL set, and shipped visitor chat that retrieves over the published index. Live optimize re-invokes fan-out when the brief needs a refresh.

* Result: the tenth validated job matched the first, GSC, SEM, Analytics, and retention confirmed the retained paths, and the project continues with new modules tested against that same set.

## What technological advancements did you achieve or attempt to achieve as a result of the work described in the previous answer?

The advancement is an agentic control architecture for model-authored AISEO: the planner is the fan-out agent, the typed brief is shared grounded memory, the harness is the constrained writer, and orchestration persists the run and publishes each live URL once.

That implements query fan-out, the same class of method ChatGPT and Google run, as our writing stack. Secrets stay in environment variables, the prompt receives a site digest and a per-heading budget, and one contract compiles across posts, service-area pages, Wikipedia research, live refresh, and retrieval-backed visitor chat.

The tenth validated job matches the first. We retained only the modules GSC, SEM, Analytics, and client satisfaction confirmed, and the stack remains under test as those signals admit new work.
