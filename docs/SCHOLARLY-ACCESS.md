# Scholarly Access Readiness

LongTable separates scholarly access readiness from research evidence search.

Use `longtable access setup` when a project may collect PDFs, use full text,
include institutionally licensed sources, or perform systematic review /
meta-analysis corpus work.

```bash
longtable access setup
longtable access status
longtable access doctor
longtable access probe --doi "10.1016/example" --publisher elsevier
```

## What Access Setup Records

`longtable access setup` records non-secret capability status only:

- metadata source readiness
- open-access full-text route
- institutional VPN/proxy/library-login readiness
- publisher API/TDM environment-variable readiness
- manual PDF workflow readiness
- whether LongTable must stop for an access checkpoint before full-text work

It writes this profile to:

```text
~/.longtable/access-readiness.json
```

LongTable does not store passwords, SSO credentials, API keys, tokens, PDFs, or
full text in the readiness profile.

## Institutional Access Boundary

Institutional access means the researcher may have a legitimate route through a
school, library, VPN, proxy, or publisher login. LongTable does not complete
password or MFA steps for the researcher.

Expected workflow:

1. The researcher logs into VPN/proxy/library/SSO directly.
2. LongTable can probe metadata, DOI access signals, or publisher API/TDM
   entitlement where configured.
3. If the researcher explicitly allows browser assistance, Computer Use may help
   with non-secret navigation, download organization, and file naming after
   login.
4. LongTable records provenance and the declared access route.

Access to read an article is not the same as permission to run automated
full-text extraction. TDM/full-text extraction permission remains a separate
research decision.

## Access Checkpoint

Before PDF collection, subscription-only source inclusion, full-text extraction,
or source-corpus construction, LongTable should stop with an ACCESS CHECKPOINT
when the project access policy is not explicit.

The checkpoint should ask which route governs the current project:

- OA-only full text
- institutional access after researcher login
- publisher API/TDM credential route
- manual PDFs supplied by the researcher
- metadata-only for now

This is a blocking research checkpoint because the answer affects corpus bias,
inclusion criteria, reproducibility, and TDM permission.

## Search Relationship

`longtable search` remains the scholarly evidence discovery command.

`longtable access` is the readiness and access-policy command.

Removed search subcommands:

```text
longtable search setup
longtable search doctor
longtable search status
longtable search probe
```

Use the corresponding access commands instead.
