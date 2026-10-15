"""Check the course repository skeleton and local Markdown file links."""
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = (
    "README.md", "COLLABORATION.md", ".gitignore",
    "docs/requirements/problem_definition.md",
    "docs/requirements/functional_spec.md", "docs/requirements/nonfunctional_spec.md",
    "docs/requirements/user_stories.md", "docs/requirements/README.md",
    "docs/algorithm/knowledge_and_agent.md", "docs/algorithm/research.md",
    "docs/algorithm/evaluation.md", "docs/software/architecture.md",
    "docs/software/data_and_interfaces.md", "docs/software/prototype/README.md",
    "docs/software/modules/01-job-understanding.md",
    "docs/software/modules/02-personal-materials.md",
    "docs/software/modules/03-interview-configuration.md",
    "docs/software/modules/05-mock-interview.md",
    "docs/software/modules/06-voice-and-speech.md",
    "docs/software/modules/07-feedback-report.md",
    "docs/software/modules/08-retry-and-progress.md",
    "docs/software/modules/09-content-and-operations.md",
    "docs/software/modules/10-code-assessment.md",
    "docs/software/modules/11-personal-center.md",
    "docs/mgmt/team_plan.md", "docs/mgmt/communication_mgmt_plan.md",
    "docs/mgmt/risk_mgmt_plan.md", "docs/retrospection/2026-10-15-scope-revision.md",
    "docs/mgmt/project_management.md", "docs/mgmt/week1_submission.md",
    "docs/mgmt/feedback.md", "docs/algorithm/README.md",
    "docs/software/README.md", "docs/retrospection/README.md",
    "code/backend", "code/frontend", "code/core_engine",
    "tests/unit", "tests/integration", ".github/workflows/repository-check.yml",
)


def main():
    errors = [f"Missing course artifact: {name}" for name in REQUIRED if not (ROOT / name).exists()]
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, check=True, stdout=subprocess.PIPE,
    )
    documents = [ROOT / name for name in result.stdout.decode("utf-8").split("\0") if name.endswith(".md")]
    links_checked = 0
    for path in documents:
        if not path.is_file():
            errors.append(f"Tracked document is missing: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8-sig")
        text = re.sub(r"^\s*(```|~~~).*?^\s*\1\s*$", "", text, flags=re.MULTILINE | re.DOTALL)
        # Current documents use inline Markdown links. Ignore remote URLs and anchors.
        for match in re.finditer(r"!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+\"[^\"]*\")?\)", text):
            target = match.group(1).strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            local_path = unquote(parsed.path)
            destination = (ROOT / local_path.lstrip("/")) if local_path.startswith("/") else (path.parent / local_path)
            links_checked += 1
            if not destination.exists():
                errors.append(f"{path.relative_to(ROOT)}: broken local link {target}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Repository checks passed: {len(documents)} Markdown files, {links_checked} local links.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
