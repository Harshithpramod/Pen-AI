FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

# Semgrep — kept as the fallback engine for languages CodeQL can't extract
# without a real build step in this image (java, go, php, ruby, ...).
RUN pip install --no-cache-dir semgrep

# trufflehog3 requires old PyYAML + Cython
RUN pip install --no-cache-dir "Cython<3" wheel
RUN pip install --no-cache-dir --no-build-isolation "PyYAML==5.4"
RUN pip install --no-cache-dir --no-build-isolation trufflehog3

# trufflehog3's own pins drag attrs down to 20.3.0, which only ships the
# legacy `attr` import name — modern semgrep imports the `attrs` package
# name (added in 21.3.0) and crashes with ModuleNotFoundError without this.
# Both import names come from the same distribution in modern attrs, so this
# doesn't break trufflehog3's use of the legacy `attr.s`/`attr.ib` API.
RUN pip install --no-cache-dir "attrs>=23"

# Pre-bundle open-source semgrep rules so the air-gapped runner works offline.
# runner_net is internal-only (no internet at runtime), so rules must be baked in.
# Sparse checkout pulls only the language dirs we need (~60 MB vs ~350 MB full clone).
RUN git clone --depth=1 --filter=blob:none --sparse \
      https://github.com/semgrep/semgrep-rules.git /opt/semgrep-rules \
  && cd /opt/semgrep-rules \
  && git sparse-checkout set \
       javascript \
       python \
       java \
       go \
       ruby \
       php \
       generic \
  && echo "Bundled $(find /opt/semgrep-rules -name '*.yaml' | wc -l) semgrep rules" \
  && chmod -R a+rX /opt/semgrep-rules

# CodeQL — primary verification engine for javascript/typescript and python
# (both extract straight from source, no build step required, so they work
# unattended against an arbitrary cloned repo). The official CLI "bundle"
# ships pre-compiled query packs alongside the binary so no `codeql pack
# download` (which needs network) is required at runtime — required, since
# runner_net has no internet. Pinned so builds are reproducible; bump
# deliberately, not automatically.
ARG CODEQL_BUNDLE_TAG=codeql-bundle-v2.26.3
RUN curl -fL -o /tmp/codeql-bundle.tar.gz \
      "https://github.com/github/codeql-action/releases/download/${CODEQL_BUNDLE_TAG}/codeql-bundle-linux64.tar.gz" \
  && mkdir -p /opt \
  && tar -xzf /tmp/codeql-bundle.tar.gz -C /opt \
  && rm /tmp/codeql-bundle.tar.gz \
  && chmod -R a+rX /opt/codeql \
  && /opt/codeql/codeql version
ENV CODEQL_HOME=/opt/codeql
ENV PATH="${CODEQL_HOME}:${PATH}"

COPY sarif_verdict.py /opt/sarif_verdict.py
RUN chmod +x /opt/sarif_verdict.py

COPY probe.sh /probe.sh
RUN chmod +x /probe.sh

ENTRYPOINT ["/probe.sh"]
