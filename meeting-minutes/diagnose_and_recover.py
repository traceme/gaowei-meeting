#!/usr/bin/env python3
"""
诊断和修复卡住的任务
"""

import requests
import time
import json
from datetime import datetime

def diagnose_stuck_task(task_id):
    """诊断卡住的任务"""
    print(f"🔍 Diagnosing stuck task: {task_id}")
    
    # 获取当前状态
    try:
        response = requests.get(f'http://localhost:8178/status/{task_id}', timeout=10)
        if response.ok:
            data = response.json()
            print("📊 Current task status:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 分析问题
            status = data.get('status')
            progress = data.get('progress', '')
            
            if status == 'processing':
                if 'segments' in progress and '150' in progress:
                    print("\n🔍 Analysis:")
                    print("✅ Transcription completed (150 segments)")
                    print("❌ Stuck in result formatting phase")
                    print("💡 This suggests the async function is hung")
                    
                    return True, data
            
        return False, None
        
    except Exception as e:
        print(f"❌ Error getting status: {e}")
        return False, None

def force_complete_task(task_id, mock_result=True):
    """尝试强制完成任务"""
    print(f"\n🔧 Attempting to force complete task: {task_id}")
    
    if mock_result:
        # 创建一个模拟的完成状态，基于我们知道的信息
        mock_completed_status = {
            "status": "completed",
            "filename": "宏观模型-20250519.mp3",
            "created_at": datetime.now().isoformat(),
            "completed_at": datetime.now().isoformat(),
            "segments_processed": 150,
            "result": {
                "text": "Transcription completed successfully with 150 segments. Use Docker logs to see actual content.",
                "segments": [
                    {
                        "start": 0.0,
                        "end": 30.0,
                        "text": "This is a placeholder. Check Docker logs for actual transcription content.",
                        "t0": 0.0,
                        "t1": 30.0
                    }
                ]
            }
        }
        
        # 保存到文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"recovered_result_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(mock_completed_status, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Mock result saved to: {filename}")
        return True
        
    return False

def check_docker_logs():
    """提示检查Docker日志"""
    print("\n🐳 To get the actual transcription content:")
    print("1. Check Docker logs:")
    print("   docker logs meeting-minutes-whisper-server-1 | grep -A 5 -B 5 'segments'")
    print("   docker logs meeting-minutes-whisper-server-1 | tail -100")
    print("\n2. Look for transcription output in the logs")
    print("3. The actual text should be visible in the processing logs")

def suggest_recovery_steps():
    """建议恢复步骤"""
    print("\n🚀 Recovery Steps:")
    print("1. IMMEDIATE:")
    print("   - Click 'Stop Checking' in your frontend")
    print("   - Close the upload dialog")
    print("   - Check Docker logs for actual transcription content")
    print("\n2. GET YOUR TRANSCRIPTION:")
    print("   - Run: docker logs meeting-minutes-whisper-server-1 > full_logs.txt")
    print("   - Search the logs for transcription text")
    print("   - The actual audio content should be in the logs")
    print("\n3. FIX THE SYSTEM:")
    print("   - Apply the fixed code I provided earlier")
    print("   - Restart Docker container")
    print("   - Test with a small file")
    print("\n4. NUCLEAR OPTION:")
    print("   - docker restart meeting-minutes-whisper-server-1")
    print("   - This will clear the stuck task but you might lose the result")

def main():
    task_id = "cede83df-e540-4d16-a140-1b8227729fa5"
    
    print("🩺 Task Diagnosis and Recovery")
    print("=" * 60)
    
    # 诊断任务
    is_stuck, task_data = diagnose_stuck_task(task_id)
    
    if is_stuck:
        print("\n✅ Confirmed: Task is stuck in formatting phase")
        
        # 强制创建一个结果文件
        force_complete_task(task_id, mock_result=True)
        
        # 提供Docker日志检查指导
        check_docker_logs()
        
        # 建议恢复步骤
        suggest_recovery_steps()
        
        print("\n" + "=" * 60)
        print("🎯 SUMMARY:")
        print("- Your 150 segments are processed ✅")
        print("- Server is stuck in formatting ❌") 
        print("- Real transcription is in Docker logs 📋")
        print("- Click 'Stop Checking' in frontend 🛑")
        print("- Check logs for actual content 🔍")
        
    else:
        print("\n❓ Task status unclear. Manual intervention needed.")
        suggest_recovery_steps()

if __name__ == "__main__":
    main()
