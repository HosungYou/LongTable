# Changelog

## 0.1.4

- treat global setup as researcher-profile onboarding, not project intake
- remove project-specific defaults from setup examples and persisted summaries
- align setup output with the new `longtable start` project interview flow

## 0.1.3

- make setup prompts read more like a short researcher interview and less like a raw config form

## 0.1.2

- add `quickstart` and `interview` setup flows
- persist topic, blocker, preferred entry mode, weakest domain, and panel preference
- enrich runtime artifacts so setup can connect directly to the first research question

## 0.1.1

- switch CLI packaging to `directories.bin` so npm preserves the published executable
- keep the executable name as `longtable-setup`

## 0.1.0

- initial publish-ready setup package scaffold
- quick setup flow and provider selection
- persisted setup output generation
- CLI entrypoint for setup initialization
- example setup outputs for Codex and Claude
