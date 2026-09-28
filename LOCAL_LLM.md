# Let a local model (LM Studio) work on this project

A model running in LM Studio can't reach GitHub by itself. It needs a coding agent: a program that reads the repo, asks
the model for edits, applies them, runs the checks and commits. The model does the thinking; the agent does the file and
git work. Keep `main` protected, and let the local model open pull requests that you review, so a bad edit never
reaches the live site.

```
LM Studio (your model, http://localhost:1234/v1)
      ↑ OpenAI-compatible API
Coding agent (Aider, Cline, Roo Code, Continue…) → your clone of the repo → branch → push → pull request
      ↓
GitHub: CI checks it; you review and merge; main deploys the site
```

## 1. Start LM Studio's server

1. Load a **coding** model. Small models struggle with a project this size. Good choices that fit on one GPU, roughly
   in order of quality: Qwen3-Coder (30B-A3B), Devstral Small, Qwen2.5-Coder 32B/14B. Any model LM Studio runs works the
   same way.
2. Set the **context length** as high as your memory allows (32k or more; agents send a lot of code).
3. Developer tab → **Start Server**. It listens on `http://localhost:1234/v1` and speaks the OpenAI API. Note the exact
   model id it shows (e.g. `qwen3-coder-30b-a3b-instruct`).

## 2. Clone the repo and let git push

```sh
git clone https://github.com/TitanmasterRy/todo-list.git
cd todo-list
npm ci
npx playwright install chromium   # for the browser tests
```

Give git a token that can only touch this repository: GitHub → Settings → Developer settings → **Fine-grained tokens**:

- **Repository access:** only `todo-list`.
- **Permissions:** Contents: read and write, Pull requests: read and write.
- **Expiry:** set one.

Use it when git asks for a password, or install the GitHub CLI and run `gh auth login`.

## 3. Pick an agent

### Option A: Aider (terminal, the simplest)

```sh
python -m pip install aider-install && aider-install
export OPENAI_API_BASE=http://localhost:1234/v1
export OPENAI_API_KEY=lm-studio                 # any text; LM Studio doesn't check it
git switch -c llm/my-change
aider --model openai/<model-id-from-lm-studio> --read AGENTS.md \
      --lint-cmd "npx eslint" --test-cmd "npx vitest run" --auto-test
```

Then describe the change in plain words ("add a dark-mode toggle to the Focus view"). Aider edits the files, runs the
tests, and commits each step. When you're happy:

```sh
git push -u origin llm/my-change
gh pr create --fill          # or open the pull request on github.com
```

### Option B: VS Code with Cline, Roo Code or Continue

Install the extension. In its settings, pick the **LM Studio** provider (or "OpenAI compatible") with base URL
`http://localhost:1234/v1` and your model id. Open the repo folder, tell it to read `AGENTS.md` first, and give it a
task. These agents can also run the terminal commands in `AGENTS.md` and commit for you. Push and open a pull request as
above, or use VS Code's GitHub pull request panel.

## 4. Protect `main`

On github.com: repo → Settings → Rules → Rulesets → New branch ruleset for `main`:

- Require a pull request before merging.
- Require status checks to pass: `check`, `e2e`, `lighthouse`.
- Block force pushes.

The model can then propose changes, CI tests them, and nothing reaches the live site until you merge.

## Optional: run it from GitHub on your own computer

GitHub's servers can't see your LM Studio. To start a model run from GitHub, for example from your phone, you would need:

1. a **self-hosted runner** on the computer that runs LM Studio (repo → Settings → Actions → Runners → New self-hosted
   runner);
2. a workflow you trigger by hand with `workflow_dispatch`, with a text input for the task;
3. a job that runs `aider --yes --message "<task>"` on a new branch, pushes it, and opens a pull request.

Only ever trigger it yourself. A workflow that anyone's issue comments could start would let strangers run code on your
computer.

## Tips

- **Small tasks work best.** One feature or one bug per session, and name the files involved.
- **Paste the error.** If the checks fail, give the model the exact error output.
- **Big refactors and casino odds** are where local models most often go wrong. Review those diffs carefully.
- `ROADMAP.md` and `FEATURES.md` list ideas that aren't done yet, which makes a good queue of tasks.
