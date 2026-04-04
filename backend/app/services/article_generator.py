import os
import google.generativeai as genai

PROMPT_TEMPLATE = """
以下はポッドキャスト「AIに仕事奪われてみたチャンネル」の文字起こしです。
ホスト（鶴岡）とゲスト（大悟）の二人の会話を分析して、以下のJSON形式で返してください。

ホスト（鶴岡）の発言：
{host}

ゲスト（大悟）の発言：
{guest}

以下のJSON形式のみで返してください（マークダウン不要）：
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
    "wandering": ["途中で寄り道したトピック（複数可。話が発散していれば多めに）"],
    "landing": "最終的に二人が辿り着いた場所・結論",
    "unresolved": "次回に持ち越したモヤモヤや問い"
  }}
}}
"""


def generate_summary(host_text: str | None, guest_text: str | None) -> dict:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"].strip())
    model = genai.GenerativeModel("gemini-2.5-flash")

    prompt = PROMPT_TEMPLATE.format(
        host=host_text or "（音声なし）",
        guest=guest_text or "（音声なし）",
    )

    response = model.generate_content(prompt)
    text = response.text.strip()

    import json
    return json.loads(text)
