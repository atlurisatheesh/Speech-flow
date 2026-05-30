import asyncio
import websockets
import json
import time

async def test_websocket_transcription():
    uri = "ws://localhost:8000/api/transcribe/stream"
    try:
        print("Connecting to WebSocket...")
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending audio data...")
            with open("test_audio.mp3", "rb") as f:
                # Send the whole file as a single binary message
                data = f.read()
                await websocket.send(data)
            
            print("Audio sent. Waiting for transcription...")
            # We wait for the JSON response containing the text
            response = await websocket.recv()
            result = json.loads(response)
            print("Transcription Result:", result.get("text"))
            print("\nTest passed! The WebSocket is successfully transcribing audio.")
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_transcription())
