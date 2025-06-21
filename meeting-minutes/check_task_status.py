#!/usr/bin/env python3
"""
调试脚本：检查Whisper服务器的任务状态
用法：python check_task_status.py [task_id]
"""

import requests
import sys
import json

def check_server_health():
    """检查服务器健康状态"""
    try:
        response = requests.get('http://localhost:8178/health', timeout=5)
        if response.ok:
            data = response.json()
            print(f"✅ Server is healthy: {data}")
            return True
        else:
            print(f"❌ Server health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

def list_all_tasks():
    """列出所有任务"""
    try:
        response = requests.get('http://localhost:8178/tasks', timeout=5)
        if response.ok:
            data = response.json()
            print(f"📋 All tasks ({data['total_tasks']}):")
            for task_id, status in data['tasks'].items():
                print(f"   {task_id}: {status}")
            return data['tasks']
        else:
            print(f"❌ Failed to list tasks: {response.status_code}")
            return {}
    except Exception as e:
        print(f"❌ Error listing tasks: {e}")
        return {}

def check_task_status(task_id):
    """检查特定任务状态"""
    try:
        response = requests.get(f'http://localhost:8178/status/{task_id}', timeout=5)
        if response.ok:
            data = response.json()
            print(f"📊 Task {task_id} status:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return data
        else:
            print(f"❌ Task {task_id} not found: {response.status_code}")
            if response.status_code == 404:
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data}")
                except:
                    pass
            return None
    except Exception as e:
        print(f"❌ Error checking task {task_id}: {e}")
        return None

def main():
    print("🔍 Whisper Server Task Status Checker")
    print("=" * 50)
    
    # 检查服务器健康状态
    if not check_server_health():
        print("\n💡 Make sure the Whisper server is running:")
        print("   docker-compose up -d whisper-server")
        return
    
    print()
    
    # 列出所有任务
    all_tasks = list_all_tasks()
    print()
    
    # 如果提供了task_id，检查特定任务
    if len(sys.argv) > 1:
        task_id = sys.argv[1]
        print(f"🎯 Checking specific task: {task_id}")
        check_task_status(task_id)
    else:
        # 如果没有提供task_id，检查最近的任务
        if all_tasks:
            print("🔍 Checking most recent tasks:")
            for task_id in list(all_tasks.keys())[:3]:  # 只检查最近3个
                print(f"\n--- Task: {task_id} ---")
                check_task_status(task_id)
        else:
            print("ℹ️ No tasks found")
    
    print("\n" + "=" * 50)
    print("💡 Usage:")
    print(f"   python {sys.argv[0]}                    # Check all tasks")
    print(f"   python {sys.argv[0]} <task_id>          # Check specific task")
    print(f"   python {sys.argv[0]} ed4800d0-4f1f-4ab6-89d0-ccdfdc2bbed1")

if __name__ == "__main__":
    main()
