#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
强制获取转录结果并保存
"""

import requests
import json
import time
import sys
from datetime import datetime

def force_get_result(task_id):
    """强制获取任务结果"""
    print(f"🔍 Force retrieving result for task: {task_id}")
    
    try:
        response = requests.get(f'http://localhost:8178/status/{task_id}', timeout=10)
        
        if response.ok:
            data = response.json()
            print(f"✅ Got task data")
            print(f"Status: {data.get('status')}")
            print(f"Progress: {data.get('progress')}")
            
            # 检查是否有结果
            if 'result' in data:
                result = data['result']
                print(f"🎉 Found result with {len(result.get('segments', []))} segments!")
                
                # 保存结果到文件
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"transcript_result_{timestamp}.json"
                
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump({
                        'task_id': task_id,
                        'filename': data.get('filename'),
                        'result': result,
                        'retrieved_at': datetime.now().isoformat()
                    }, f, indent=2, ensure_ascii=False)
                
                print(f"💾 Result saved to: {filename}")
                
                # 显示转录预览
                if 'text' in result and result['text']:
                    print(f"\n📄 Full text length: {len(result['text'])} characters")
                    print("📖 Text preview (first 500 chars):")
                    print("-" * 50)
                    print(result['text'][:500] + "...")
                    print("-" * 50)
                
                # 显示segments信息
                if 'segments' in result and result['segments']:
                    segments = result['segments']
                    print(f"\n📝 Segments: {len(segments)} total")
                    print("🔢 First few segments:")
                    for i, seg in enumerate(segments[:3]):
                        start = seg.get('start', 0)
                        end = seg.get('end', 0)
                        text = seg.get('text', '').strip()
                        print(f"  [{i+1}] {start:.1f}s-{end:.1f}s: {text[:100]}...")
                
                return result
            else:
                print("❌ No result found in task data")
                print("Raw data:", json.dumps(data, indent=2, ensure_ascii=False))
                return None
                
        else:
            print(f"❌ Failed to get task: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def convert_to_frontend_format(result, task_id):
    """转换为前端需要的格式"""
    if not result:
        return []
    
    transcripts = []
    
    if 'segments' in result and result['segments']:
        for i, segment in enumerate(result['segments']):
            transcripts.append({
                'id': f'uploaded-{task_id}-{i}',
                'text': segment.get('text', '').strip(),
                'timestamp': f"{segment.get('start', 0):.1f}s - {segment.get('end', 0):.1f}s"
            })
    elif 'text' in result and result['text']:
        transcripts.append({
            'id': f'uploaded-{task_id}',
            'text': result['text'].strip(),
            'timestamp': datetime.now().isoformat()
        })
    
    # 过滤空文本
    transcripts = [t for t in transcripts if t['text'].strip()]
    
    # 保存前端格式
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    frontend_filename = f"frontend_transcripts_{timestamp}.json"
    
    with open(frontend_filename, 'w', encoding='utf-8') as f:
        json.dump(transcripts, f, indent=2, ensure_ascii=False)
    
    print(f"📱 Frontend format saved to: {frontend_filename}")
    print(f"📊 Generated {len(transcripts)} transcript entries")
    
    return transcripts

def get_all_tasks():
    """获取所有任务"""
    try:
        response = requests.get('http://localhost:8178/tasks', timeout=10)
        if response.ok:
            data = response.json()
            return data.get('tasks', {})
        else:
            print(f"❌ Failed to get tasks: {response.status_code}")
            return {}
    except Exception as e:
        print(f"❌ Error getting tasks: {e}")
        return {}

if __name__ == "__main__":
    print("🚀 Force Result Retrieval")
    print("=" * 50)
    
    # 检查命令行参数
    if len(sys.argv) > 1 and sys.argv[1] == "--list":
        print("📋 Listing all tasks...")
        tasks = get_all_tasks()
        if tasks:
            for task_id, status in tasks.items():
                print(f"  {task_id}: {status}")
        else:
            print("❌ No tasks found")
        sys.exit(0)
    
    # 默认任务ID（你之前提到的）
    task_id = "6ec05086-cef3-4871-9a15-12c081923244"
    
    # 如果提供了任务ID参数
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        task_id = sys.argv[1]
    
    print(f"🎯 Target task: {task_id}")
    
    result = force_get_result(task_id)
    
    if result:
        print("\n🔄 Converting to frontend format...")
        transcripts = convert_to_frontend_format(result, task_id)
        
        print("\n✅ SUCCESS! You now have:")
        print(f"   1. Raw result: transcript_result_*.json")
        print(f"   2. Frontend format: frontend_transcripts_*.json")
        print(f"   3. {len(transcripts)} transcript segments ready to use")
        
        print("\n💡 Next steps:")
        print("   1. Click 'Stop Checking' in your frontend")
        print("   2. Close the upload dialog")
        print("   3. The transcripts are ready - check the JSON files!")
        
    else:
        print("\n❌ Could not retrieve result")
        print("💡 The task might still be processing. Try again in a few minutes.")
        
        # 显示所有任务以便调试
        print("\n🔍 All available tasks:")
        tasks = get_all_tasks()
        for tid, status in tasks.items():
            print(f"   {tid}: {status}")
