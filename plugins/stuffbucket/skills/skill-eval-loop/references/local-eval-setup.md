# Local-First Eval Setup

Running evals against local models keeps data local, eliminates API costs, and gives sub-second iteration on M-series Macs. This guide covers provider config, grader setup, and concurrency tuning.

## Why Local

- **Privacy**: Eval inputs may contain proprietary code. Local inference never leaves the machine.
- **Cost**: Running 100+ tests per eval round gets expensive with cloud APIs.
- **Speed**: With GPU-resident models on M-series, 50+ tok/s is routine. Full suites finish in minutes.
- **Reproducibility**: Local models don't change under you between runs.

## Ollama Setup

Ollama is the easiest path. Install, pull a suitable model, and it exposes an HTTP API on `localhost:11434`.

### Model selection

| Model | Size | Speed (M3 Max) | Use for |
| ----- | ---- | -------------- | ------- |
| `gemma4:latest` | 9.6GB | ~54 tok/s | Default — fast iteration |
| `gemma4:31b` | 19GB | ~13 tok/s | Higher quality, slower |
| `qwen2.5-coder:32b` | 19GB | ~14 tok/s | Code-heavy evaluations |
| `deepseek-r1:8b` | 5.2GB | ~70 tok/s | Fastest, weaker reasoning |

**Block cloud models**. Ollama lists cloud-proxied models (anything with `:cloud` or `-cloud` suffix). Filter them out — they egress data.

```bash
ollama list | grep -v "cloud"
```

### Pull a model

```bash
ollama pull gemma4:latest
```

### Verify availability

```bash
curl -s http://localhost:11434/api/tags | python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in data.get('models', []):
    if 'cloud' not in m['name']:
        print(m['name'])
"
```

## Promptfoo Provider Config

Point promptfoo at the local model:

```yaml
providers:
  - id: 'ollama:chat:gemma4:latest'
    label: 'ollama-local'
    config:
      temperature: 0
      num_ctx: 8192
```

### Critical: set `num_ctx`

Ollama's default context window is 131K tokens. That's overkill for skill evals and burns GPU memory on KV cache. For most skills, 8K is plenty:

```yaml
config:
  num_ctx: 8192
```

This reduces per-request memory from ~65MB to ~4MB, enabling higher concurrency.

## LLM-as-Judge Config

LLM-rubric assertions need a grader. By default promptfoo tries OpenAI — which fails if no API key is set. Point the grader at the same local model:

```yaml
defaultTest:
  options:
    timeout: 180000
    provider:
      text:
        id: 'ollama:chat:gemma4:latest'
        config:
          temperature: 0
          num_ctx: 8192
```

Now rubric grading runs locally too. No API keys required.

## Concurrency Tuning

Running tests in parallel speeds up eval rounds significantly. Two levers:

### Promptfoo concurrency

```yaml
maxConcurrency: 8
```

Default is 4. 8 works well on M3 Max with 128GB unified memory.

### Ollama parallel slots

```bash
export OLLAMA_NUM_PARALLEL=8
```

Ollama serves up to `OLLAMA_NUM_PARALLEL` concurrent requests on the same model. Default is 4. Match it to `maxConcurrency`.

### Memory math

With `gemma4:latest` (13GB resident) and `num_ctx: 8192`:

- Model weights: 13GB
- KV cache per slot: ~4MB
- 8 parallel slots: 13GB + 32MB ≈ 13GB

Well within 128GB unified memory. For larger models (31B+) reduce concurrency to 4.

## Copilot CLI as an Alternative

If Ollama isn't available, GitHub Copilot CLI can be wrapped as a provider via `python` provider type. Works but slower (~50-180s per call due to agent loop overhead).

Pattern: the Python provider shells out to `copilot -p <prompt> -s --no-ask-user --disable-builtin-mcps` and returns stdout.

Not recommended for iteration loops — use Ollama instead.

## Full Example Config

```yaml
description: 'Skill evaluation — local'

maxConcurrency: 8

providers:
  - id: 'ollama:chat:gemma4:latest'
    label: 'ollama-local'
    config:
      temperature: 0
      num_ctx: 8192

prompts:
  - id: skill-eval
    raw: |
      [
        {"role": "system", "content": "{{skill_context}}"},
        {"role": "user", "content": "{{message}}"}
      ]

defaultTest:
  options:
    timeout: 180000
    provider:
      text:
        id: 'ollama:chat:gemma4:latest'
        config:
          temperature: 0
          num_ctx: 8192

tests:
  - file://tests/*.yaml
```

## Runtime Environment

Export once per shell session:

```bash
export OLLAMA_NUM_PARALLEL=8
```

Or in your runner script:

```bash
#!/bin/bash
set -euo pipefail
export OLLAMA_NUM_PARALLEL=8

# Verify model is available (reject cloud models)
MODEL="${1:-gemma4:latest}"
if [[ "$MODEL" == *"cloud"* ]]; then
  echo "ERROR: Cloud model '$MODEL' would egress data"
  exit 1
fi

if ! curl -s http://localhost:11434/api/tags | python3 -c "
import sys, json
names = [m['name'] for m in json.load(sys.stdin).get('models', [])]
sys.exit(0 if '$MODEL' in names else 1)
"; then
  echo "Model '$MODEL' not available locally. Pull with: ollama pull $MODEL"
  exit 1
fi

promptfoo eval -c promptfooconfig.yaml --no-cache "$@"
```

## Inference Speed Benchmarks

Run this to benchmark a model:

```bash
curl -s http://localhost:11434/api/generate \
  -d '{"model":"gemma4:latest","prompt":"Write a 200-word essay on typography.","stream":false}' \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
eval_dur = d.get('eval_duration', 0) / 1e9
tokens = d.get('eval_count', 0)
print(f'Tokens: {tokens}, Time: {eval_dur:.1f}s, Rate: {tokens/eval_dur:.1f} tok/s')
"
```

Good targets:

- **50+ tok/s**: Fast iteration, suitable for interactive development
- **20-50 tok/s**: Usable for full suite runs
- **Below 20 tok/s**: Consider a smaller model or better hardware
