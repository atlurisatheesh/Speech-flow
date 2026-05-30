import os
import time
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class TestRunnerHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_run = 0
        self.cooldown = 10  # seconds cooldown to prevent multiple triggers

    def run_tests(self):
        current_time = time.time()
        if current_time - self.last_run < self.cooldown:
            return
        self.last_run = current_time
        
        print("\n" + "="*60)
        print("FILE CHANGE DETECTED. RUNNING AUTOMATED TEST SUITE...")
        print("="*60 + "\n")
        
        # Ensure reports directory exists
        os.makedirs("test_reports", exist_ok=True)
        
        # 1. Run Backend Pytest
        print("\n[1/2] Running Pytest (Backend Integration Tests)...")
        try:
            subprocess.run(
                ["python", "-m", "pytest", "tests/backend_test.py", "--junitxml=../test_reports/pytest_results.xml", "-q"], 
                cwd="backend", 
                check=False
            )
        except Exception as e:
            print(f"Pytest failed: {e}")
            
        # 2. Run Playwright E2E
        print("\n[2/2] Running Playwright E2E Tests (Frontend)...")
        try:
            # Note: assuming dev server is already running on port 3000
            subprocess.run(
                ["npx", "playwright", "test"], 
                cwd="frontend", 
                check=False
            )
        except Exception as e:
            print(f"Playwright failed: {e}")
            
        # 3. Update test_result.md based on Playwright/Pytest
        print("\nAI tests (Shortest / Browser Use) are configured for manual trigger to save tokens.")
        print("\n" + "="*60)
        print("AUTOMATED TEST SUITE COMPLETE.")
        print("="*60 + "\n")

    def on_modified(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        # Trigger on python or JS/TS file changes
        if filepath.endswith(('.py', '.jsx', '.js', '.tsx', '.ts')):
            # Ignore test reports, node_modules, and virtual envs
            if any(ignore in filepath for ignore in ['test_reports', 'node_modules', '.venv', '__pycache__', 'test_result.md']):
                return
            self.run_tests()

if __name__ == "__main__":
    path = "."
    event_handler = TestRunnerHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    print(f"Starting automated E2E test watcher on {path}...")
    print(f"Watching for .py, .js, .jsx, .ts, .tsx changes...")
    
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
