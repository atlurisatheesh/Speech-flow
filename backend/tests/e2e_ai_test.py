import asyncio
import os
from langchain_openai import ChatOpenAI
from browser_use import Agent

async def run_ai_test():
    print("🤖 Initializing Browser Use AI Agent...")
    
    # Read the testing protocol and pending tasks
    try:
        with open("../test_result.md", "r") as f:
            test_state = f.read()
    except FileNotFoundError:
        test_state = "No test_result.md found."

    # Prompt for the AI Agent
    prompt = f"""
    You are an automated testing agent for Speech-Flow, an AI-powered speech-to-text app.
    The app is running at http://localhost:3000.
    
    Here is the current testing protocol and state:
    {test_state}
    
    Your task:
    1. Navigate to http://localhost:3000
    2. Check the UI loads properly.
    3. Look at the 'test_plan' section from the state above, find any 'current_focus' or 'stuck_tasks'.
    4. Attempt to verify those specific features in the UI.
    5. Summarize your findings so the main agent can update the test_result.md file.
    """

    # We use GPT-4o-mini to save cost while still being capable
    llm = ChatOpenAI(model="gpt-4o-mini")
    
    agent = Agent(
        task=prompt,
        llm=llm, # type: ignore
    )
    
    print("🚀 Starting autonomous UI test...")
    result = await agent.run()
    
    print("\n" + "="*50)
    print("📊 AI Test Results:")
    print("="*50)
    print(result)

if __name__ == "__main__":
    # Note: Requires OPENAI_API_KEY to be set in environment
    if "OPENAI_API_KEY" not in os.environ:
        print("⚠️ OPENAI_API_KEY not found. Browser Use requires it.")
    else:
        asyncio.run(run_ai_test())
