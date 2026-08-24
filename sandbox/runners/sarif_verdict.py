#!/usr/bin/env python3
"""Turn a CodeQL SARIF file into the {"status","evidence","details"} verdict
probe.sh must print as its last stdout line.

Usage: sarif_verdict.py <sarif_path> <probe> [target_file]

A CodeQL security-extended run finds far more than the one thing a job is
verifying, so a raw "results > 0" check would flag unrelated findings as
confirming e.g. an SSRF probe. For a probe with a known CWE mapping (sqli,
ssrf, rce, xss, idor), relevance to that CWE is mandatory — a result merely
sitting in the same file is not enough, since an unrelated finding (e.g. a
SQLi hit) must never "confirm" a different probe (e.g. xss) just because it
happens to live in the file the AI flagged. Within CWE-relevant results, one
also located in the job's target file is preferred as the strongest evidence.
Only the generic "semgrep" probe (no specific category) has no CWE mapping,
so it falls back to "any result in the target file" or, failing that, "any
security-extended result at all".
"""
import json
import sys

CWE_BY_PROBE = {
    "sqli": {"external/cwe/cwe-089"},
    "ssrf": {"external/cwe/cwe-918"},
    "rce": {
        "external/cwe/cwe-078",
        "external/cwe/cwe-094",
        "external/cwe/cwe-095",
        "external/cwe/cwe-077",
    },
    "xss": {"external/cwe/cwe-079"},
    "idor": {
        "external/cwe/cwe-022",
        "external/cwe/cwe-284",
        "external/cwe/cwe-639",
        "external/cwe/cwe-862",
        "external/cwe/cwe-863",
    },
}


def rule_tags(rules_by_id, rule_id):
    rule = rules_by_id.get(rule_id, {})
    return set(rule.get("properties", {}).get("tags", []))


def result_locations(result):
    locs = []
    for loc in result.get("locations", []) or []:
        phys = loc.get("physicalLocation", {}) or {}
        uri = (phys.get("artifactLocation", {}) or {}).get("uri", "")
        line = (phys.get("region", {}) or {}).get("startLine")
        locs.append({"file": uri, "line": line})
    return locs


def matches_target_file(locations, target_file):
    if not target_file:
        return False
    for loc in locations:
        uri = loc["file"]
        if uri == target_file or uri.endswith("/" + target_file) or target_file.endswith(uri):
            return True
    return False


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "failed", "evidence": "sarif_verdict.py: missing arguments"}))
        return

    sarif_path, probe = sys.argv[1], sys.argv[2]
    target_file = sys.argv[3] if len(sys.argv) > 3 else ""

    try:
        with open(sarif_path) as f:
            sarif = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(json.dumps({"status": "failed", "evidence": f"could not read CodeQL SARIF output: {e}"}))
        return

    run = (sarif.get("runs") or [{}])[0]
    driver = run.get("tool", {}).get("driver", {}) or {}
    rules_by_id = {r["id"]: r for r in (driver.get("rules") or []) if "id" in r}
    results = run.get("results") or []

    enriched = []
    for r in results:
        rule_id = r.get("ruleId", "")
        locations = result_locations(r)
        enriched.append(
            {
                "ruleId": rule_id,
                "message": (r.get("message") or {}).get("text", ""),
                "tags": sorted(rule_tags(rules_by_id, rule_id)),
                "locations": locations,
            }
        )

    target_hits = [e for e in enriched if matches_target_file(e["locations"], target_file)]
    wanted_cwes = CWE_BY_PROBE.get(probe)

    if wanted_cwes is not None:
        # Probe has a specific vulnerability class in mind: relevance to that
        # CWE is mandatory, regardless of file. A hit that is *also* in the
        # flagged file is the strongest evidence; a CWE-relevant hit
        # elsewhere in the repo still confirms the class is present.
        cwe_hits = [e for e in enriched if set(e["tags"]) & wanted_cwes]
        cwe_hits_in_target = [e for e in cwe_hits if e in target_hits]
        if cwe_hits_in_target:
            evidence_set, kind = cwe_hits_in_target, f"matched the flagged file ({target_file}) and the relevant CWE"
        elif cwe_hits:
            evidence_set, kind = cwe_hits, "matched the relevant CWE for this probe, elsewhere in the repo"
        else:
            evidence_set, kind = [], "no relevant findings"
    else:
        # Generic probe (e.g. "semgrep") has no specific CWE to check —
        # anything in the flagged file counts, otherwise any result at all.
        if target_hits:
            evidence_set, kind = target_hits, f"matched the flagged file ({target_file})"
        elif enriched:
            evidence_set, kind = enriched, "generic security-extended finding"
        else:
            evidence_set, kind = [], "no relevant findings"

    if evidence_set:
        verdict = {
            "status": "confirmed",
            "evidence": f"CodeQL security-extended analysis: {len(evidence_set)} finding(s) ({kind})",
            "details": {
                "count": len(evidence_set),
                "results": [
                    {"rule": e["ruleId"], "message": e["message"], "locations": e["locations"], "tags": e["tags"]}
                    for e in evidence_set[:5]
                ],
            },
        }
    else:
        total = len(enriched)
        evidence = (
            f"CodeQL security-extended analysis found {total} finding(s), none relevant to probe '{probe}'"
            if total
            else "CodeQL security-extended analysis found no findings"
        )
        verdict = {"status": "not_exploitable", "evidence": evidence}

    print(json.dumps(verdict))


if __name__ == "__main__":
    main()
