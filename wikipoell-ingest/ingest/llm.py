"""The LLM pass: fill in what deterministic rules could not.

Runs through OpenRouter's OpenAI-compatible chat-completions endpoint, so the
model is a config value rather than a code change. Only listings the router
sends here are processed, so most garments never cost a call.

The prompt is ported from `legacy/agent-review/review.js`, including its use
of past human corrections as few-shot examples — the whole point of keeping
the AgentCorrection collection.

Text-only by default; images are attached when the text alone was not enough
(`--images auto`) or always (`--images always`).
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from ingest.models import Draft, Origin
from ingest.normalize.vocabulary import VOCAB_FIELDS, Vocabulary

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-5.6-luna"
MAX_TOKENS = 1024
REQUEST_TIMEOUT = 120.0
MAX_EXAMPLES = 25
MAX_IMAGES = 2
IMAGE_TIMEOUT = 30.0
_JSON_BLOCK = re.compile(r"\{.*\}", re.S)


def _example_block(corrections: list[dict[str, Any]]) -> str:
    lines = []
    for i, ex in enumerate(corrections[:MAX_EXAMPLES], 1):
        before, after = ex.get("before") or {}, ex.get("after") or {}
        changed = [f for f in (ex.get("changed") or {}) if f != "title"]
        lines.append(
            f"Example {i}:\n"
            f"  Before: {json.dumps(before, ensure_ascii=False)}\n"
            f"  After:  {json.dumps(after, ensure_ascii=False)}\n"
            f"  Fields changed: {', '.join(changed) or 'none (only title formatted)'}"
        )
    return "\n\n".join(lines)


def build_system_prompt(vocab: Vocabulary, corrections: list[dict[str, Any]]) -> str:
    def describe(key: str, value: str) -> str:
        text = vocab.descriptions.get((key, value))
        return f"{value} ({text})" if text else value

    prop_lines = "\n".join(
        f"{key}: " + ", ".join(describe(key, v) for v in sorted(vocab.values[key]))
        for key in VOCAB_FIELDS
        if vocab.values.get(key)
    )
    return f"""You are reviewing garment entries for Wikipoell, an archive of \
Carol Christian Poell (CCP) clothing.

Your job: given a listing's metadata (and sometimes images), output corrected
field values.

RULES:
1. title: title case; strip any trailing /COLOR suffix; expand abbreviations
   ("O.D." / "O.Dyed" -> "Object Dyed", "L." -> "Leather", "JKT" -> "Jacket",
   "H." -> "High"). Always normalise this.
2. category: choose from the valid list. Prefer at least 2 levels deep
   (e.g. "outerwear.coats", not "outerwear").
3. type, gender, model, material, process, color: choose from the valid lists.
   These usually come from the article code and are usually right — change
   only when clearly wrong. The parenthesised text after each value explains
   what it means; the `type` letter in particular narrows the category a
   great deal (e.g. C is a shirt, P is pants, M is a metal accessory).
4. procedure: an array of valid values, same rule.
5. Use ONLY values from the lists below. If the correct value is not in a
   list, return null for that field rather than inventing one — a human will
   decide whether to add it.
6. confidence: 0.0-1.0, how certain you are overall.

VALID CATEGORIES:
{", ".join(sorted(vocab.categories))}

VALID PROPERTY VALUES:
{prop_lines}

EXAMPLES OF PAST HUMAN CORRECTIONS:
{_example_block(corrections)}

Respond with ONLY a JSON object, no markdown:
{{"title": "...", "category": "...", "type": null, "gender": null,
  "model": null, "procedure": [], "material": null, "process": null,
  "color": null, "confidence": 0.0, "notes": "brief reasoning"}}"""


class LlmReviewer:
    def __init__(
        self,
        api_key: str,
        vocab: Vocabulary,
        corrections: list[dict[str, Any]],
        *,
        images_mode: str = "auto",
        threshold: float = 0.90,
        model: str = MODEL,
    ) -> None:
        self.vocab = vocab
        self.system = build_system_prompt(vocab, corrections)
        self.images_mode = images_mode
        self.threshold = threshold
        self.model = model
        self.calls = 0
        self._api = httpx.Client(
            base_url="https://openrouter.ai/api/v1",
            headers={
                "Authorization": f"Bearer {api_key}",
                # OpenRouter attributes usage to these; both are optional.
                "HTTP-Referer": "https://wikipoell.com",
                "X-Title": "wikipoell-ingest",
            },
            timeout=REQUEST_TIMEOUT,
        )
        # Separate client for pulling listing images: different host, different
        # timeout, and it must not carry the API credentials.
        self._http = httpx.Client(follow_redirects=True, timeout=IMAGE_TIMEOUT)

    def close(self) -> None:
        self._api.close()
        self._http.close()

    # -- prompt pieces -----------------------------------------------------

    def _user_text(self, draft: Draft, missing: list[str]) -> str:
        listing = draft.listing
        return (
            f"Listing title: {listing.title}\n"
            f"Article code: {listing.article_code or '(none shown)'}\n"
            f"SKU: {listing.sku or '(none)'}\n"
            f"Site section / hints: category={listing.category_hint}, "
            f"gender={listing.gender_hint}, color={listing.color_hint}\n"
            f"Description: {(listing.description or '(none)')[:600]}\n\n"
            f"Deterministic pass produced: "
            f"{json.dumps(draft.field_values(), ensure_ascii=False)}\n"
            f"Could not determine: {', '.join(missing) or '(nothing)'}\n\n"
            "Return the corrected JSON object."
        )

    def _image_blocks(self, draft: Draft) -> list[dict[str, Any]]:
        blocks: list[dict[str, Any]] = []
        for url in draft.listing.images[:MAX_IMAGES]:
            try:
                response = self._http.get(url)
                response.raise_for_status()
                media_type = (
                    response.headers.get("content-type") or "image/jpeg"
                ).split(";")[0]
                if media_type not in {
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                }:
                    continue
                encoded = base64.b64encode(response.content).decode()
                blocks.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{encoded}"},
                    }
                )
            except Exception:
                continue  # an unavailable image must not lose the listing
        return blocks

    # -- the call ----------------------------------------------------------

    def _ask(self, content: list[dict[str, Any]]) -> dict[str, Any] | None:
        """One completion. Returns the parsed object, or None if unusable.

        Never raises: a listing that the model cannot classify should fall
        through to a human, not abort the source.
        """
        self.calls += 1
        try:
            response = self._api.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "max_tokens": MAX_TOKENS,
                    # The model supports JSON mode, so the response does not
                    # need coaxing out of prose — but _JSON_BLOCK still guards
                    # against a provider that ignores the hint.
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": self.system},
                        {"role": "user", "content": content},
                    ],
                },
            )
        except httpx.HTTPError as exc:
            raise RuntimeError(f"OpenRouter request failed: {exc}") from exc

        if response.status_code >= 400:
            raise RuntimeError(
                f"OpenRouter {response.status_code}: {response.text[:200]}"
            )

        payload = response.json()
        if payload.get("error"):
            raise RuntimeError(f"OpenRouter: {str(payload['error'])[:200]}")

        choices = payload.get("choices") or []
        if not choices:
            return None
        text = (choices[0].get("message") or {}).get("content") or ""

        match = _JSON_BLOCK.search(text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    def review(self, draft: Draft, missing: list[str]) -> Draft:
        """Fill the draft in place from Claude's answer and record confidence.

        With `--images auto`, a low-confidence text-only answer is retried once
        with images attached — which is where most of the remaining signal is,
        since category and colour are often clearer from a photo.
        """
        text_block = {"type": "text", "text": self._user_text(draft, missing)}

        if self.images_mode == "always":
            answer = self._ask([*self._image_blocks(draft), text_block])
        else:
            answer = self._ask([text_block])
            low = (
                answer is None or float(answer.get("confidence") or 0) < self.threshold
            )
            if low and self.images_mode == "auto":
                retry = self._ask([*self._image_blocks(draft), text_block])
                if retry is not None:
                    answer = retry

        if answer is None:
            draft.llm_confidence = 0.0
            draft.llm_notes = "LLM returned no parseable JSON"
            draft.llm_model = self.model
            return draft

        self._apply(draft, answer)
        return draft

    def _apply(self, draft: Draft, answer: dict[str, Any]) -> None:
        confidence = float(answer.get("confidence") or 0.0)
        draft.llm_confidence = confidence
        draft.llm_notes = (answer.get("notes") or "")[:500] or None
        draft.llm_model = self.model

        for name in ("title", "category", *VOCAB_FIELDS):
            if name not in answer:
                continue
            value = answer[name]
            if value in (None, "", []):
                continue
            # Never let the LLM overwrite a value read straight off an article
            # code — that is structured data, and the model is guessing.
            existing = draft.fields.get(name)
            if existing is not None and existing.origin is Origin.CODE:
                continue
            draft.set(name, value, confidence, Origin.LLM)

        for name in VOCAB_FIELDS:
            if name in draft.fields:
                fv = draft.fields[name]
                fv.value = self.vocab.canonicalize(name, fv.value)

        from ingest.normalize.draft import collect_unknown

        draft.unknown_values = collect_unknown(draft, self.vocab)
