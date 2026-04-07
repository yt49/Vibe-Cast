import json
import re

from google import genai

from app.config import get_gemini_api_key

# 1話分の文字起こしが非常に長い場合に Gemini が混乱しないよう、
# 話者ごとに最大文字数を設ける（目安: 8000字 × 2人 = 16000字）
_MAX_CHARS_PER_SPEAKER = 8000

PROMPT_TEMPLATE = """
以下はポッドキャスト「AIに仕事奪われてみたチャンネル」の文字起こしです。
ホスト（鶴岡）とゲスト（大悟）の会話を分析し、指定のJSON形式のみで返してください。

【注意】
- テキストが長くても、全体を通して読んで要約すること。
- 返答はJSONのみ。マークダウンのコードブロック（```）や余分な説明は不要。

ホスト（鶴岡）の発言：
{host}

ゲスト（大悟）の発言：
{guest}

以下のJSON形式のみで返してください：
{{
  "theme": "今回のメインテーマ（一言）",
  "host_claim": "鶴岡の主張（100字以内）",
  "guest_claim": "大悟の主張（100字以内）",
  "agreed": "二人が合意したこと",
  "disagreed": "まだ対立していること",
  "host_question": "鶴岡が次回までに考えたい問い",
  "guest_question": "大悟が次回までに考えたい問い",
  "journey": {{
    "departure": "最初に話し始めたこと",
    "wandering": ["途中で寄り道したトピック（複数可）"],
    "landing": "最終的に二人が辿り着いた場所・結論",
    "unresolved": "次回に持ち越したモヤモヤや問い"
  }}
}}
"""

_FALLBACK_SUMMARY = {
    "theme": "（要約生成に失敗しました）",
    "host_claim": "",
    "guest_claim": "",
    "agreed": "",
    "disagreed": "",
    "host_question": "",
    "guest_question": "",
    "journey": {
        "departure": "",
        "wandering": [],
        "landing": "",
        "unresolved": "",
    },
}


def _truncate(text: str | None) -> str:
    """None・空文字対応 + 長文トランケート"""
    if not text or not text.strip():
        return "（音声なし）"
    if len(text) > _MAX_CHARS_PER_SPEAKER:
        return text[:_MAX_CHARS_PER_SPEAKER] + "\n…（以降省略）"
    return text


def _extract_json(text: str) -> str:
    """マークダウンコードブロックがあれば JSON 部分だけ取り出す"""
    # ```json ... ``` または ``` ... ``` を除去
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1)
    return text.strip()


def generate_summary(host_text: str | None, guest_text: str | None) -> dict:
    client = genai.Client(api_key=get_gemini_api_key())

    prompt = PROMPT_TEMPLATE.format(
        host=_truncate(host_text),
        guest=_truncate(guest_text),
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    raw = response.text.strip()

    try:
        return json.loads(_extract_json(raw))
    except json.JSONDecodeError:
        # フォールバック: エラーにせず既定の構造を返す
        return {**_FALLBACK_SUMMARY, "theme": f"（JSON解析失敗）生レスポンス: {raw[:200]}"}
