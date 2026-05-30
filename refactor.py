import re
import os

with open('backend/server.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('from emergentintegrations.llm.openai import OpenAISpeechToText # type: ignore', 'from openai import AsyncOpenAI')
code = code.replace('stt = OpenAISpeechToText(api_key=os.getenv("EMERGENT_LLM_KEY"))', 'openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))')

helper = '''
async def generate_chat_completion(system_message: str, prompt: str, temperature: float = 0.3) -> str:
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        temperature=temperature
    )
    return response.choices[0].message.content
'''

code = code.replace('app = FastAPI()', helper + '\napp = FastAPI()')
code = code.replace('await stt.transcribe(', 'await openai_client.audio.transcriptions.create(')
code = code.replace('stt,', 'openai_client,')

# Now for the LlmChat blocks
chat_pattern = re.compile(
r'''\s*from emergentintegrations\.llm\.chat import LlmChat, UserMessage # type: ignore(.*?)chat = LlmChat\(\s*api_key=os\.getenv\("EMERGENT_LLM_KEY"\),\s*session_id=str\(uuid\.uuid4\(\)\),\s*system_message=([a-zA-Z0-9_]+?)\s*\)\.with_model\("openai", "gpt-4o-mini"\)\.with_params\(temperature=([0-9.]+)\)(.*?)response = await chat\.send_message\(\s*UserMessage\(text=([a-zA-Z0-9_]+?)\)\s*\)\s*([a-zA-Z0-9_]+?) = response if isinstance\(response, str\) else response\.message\.text''',
re.DOTALL
)

def replacer(match):
    pre_code = match.group(1)
    sys_msg_var = match.group(2)
    temp_val = match.group(3)
    mid_code = match.group(4)
    prompt_var = match.group(5)
    result_var = match.group(6)
    
    return f"{pre_code}{mid_code}{result_var} = await generate_chat_completion({sys_msg_var}, {prompt_var}, temperature={temp_val})"

new_code = chat_pattern.sub(replacer, code)

with open('backend/server.py', 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Done")
