#!/usr/bin/env python3
"""
持续监控任务状态脚本
"""

import requests
import time
import sys

def monitor_task(task_id, check_interval=10):
    """持续监控任务状态"""
    print(f"🔍 Monitoring task: {task_id}")
    print(f"⏱️ Checking every {check_interval} seconds...")
    print("=" * 60)
    
    check_count = 0
    
    while True:
        try:
            check_count += 1
            print(f"\n[Check #{check_count}] {time.strftime('%H:%M:%S')}")
            
            response = requests.get(f'http://localhost:8178/status/{task_id}', timeout=10)
            
            if response.ok:
                data = response.json()
                status = data.get('status', 'unknown')
                progress = data.get('progress', 'No progress info')
                
                print(f"Status: {status}")
                print(f"Progress: {progress}")
                
                if 'segments_processed' in data:
                    print(f"Segments processed: {data['segments_processed']}")
                
                if status == 'completed':
                    print("\n🎉 Task completed successfully!")
                    result = data.get('result', {})
                    if 'segments' in result:
                        print(f"📝 Generated {len(result['segments'])} transcript segments")
                    if 'text' in result:
                        text_length = len(result['text'])
                        print(f"📄 Total text length: {text_length} characters")
                        
                        # 显示前200个字符作为预览
                        preview = result['text'][:200]
                        print(f"📖 Preview: {preview}...")
                    
                    print("\n✅ You can now use this result in your frontend!")
                    break
                    
                elif status == 'error':
                    print(f"\n❌ Task failed with error: {data.get('error', 'Unknown error')}")
                    break
                    
                elif status == 'processing':
                    if progress == "Formatting results...":
                        print("⚠️ Task seems stuck in formatting. This usually takes <30 seconds.")
                        if check_count > 6:  # 1分钟后
                            print("🔧 Consider restarting the docker container if this persists.")
            else:
                print(f"❌ Failed to get status: {response.status_code}")
                if check_count > 3:
                    break
                    
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped by user")
            break
        except Exception as e:
            print(f"❌ Error: {e}")
            
        print(f"⏳ Waiting {check_interval} seconds...")
        time.sleep(check_interval)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        task_id = sys.argv[1]
        monitor_task(task_id)
    else:
        print("Usage: python monitor_task.py <task_id>")
        print("Example: python monitor_task.py cede83df-e540-4d16-a140-1b8227729fa5")
