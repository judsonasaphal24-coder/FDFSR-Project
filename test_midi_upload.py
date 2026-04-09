import requests

# Create a minimal valid MIDI file for testing
midi_data = bytes.fromhex(
    "4d546864000000060000000100604d54726b0000000c00ff510307a12000ff2f00"
)
with open("test.mid", "wb") as f:
    f.write(midi_data)

try:
    with open("test.mid", "rb") as f:
        response = requests.post("http://127.0.0.1:8000/api/midi/upload/", files={"file": ("test.mid", f, "audio/midi")})
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
