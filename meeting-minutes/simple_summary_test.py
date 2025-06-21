#!/usr/bin/env python3
"""
临时摘要生成脚本 - 无需Ollama
"""

import sys
import json
import re

def simple_summary(text):
    """简单的基于规则的摘要生成"""
    
    # 分句
    sentences = re.split(r'[。！？]', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # 关键词提取
    keywords = ['讨论', '决定', '计划', '问题', '解决', '项目', '进展', '完成', '需要', '建议']
    
    key_points = []
    action_items = []
    decisions = []
    topics = []
    
    for sentence in sentences:
        if any(word in sentence for word in ['讨论', '谈到', '提到']):
            topics.append(sentence)
        elif any(word in sentence for word in ['决定', '确定', '同意']):
            decisions.append(sentence)
        elif any(word in sentence for word in ['需要', '要', '计划', '将']):
            action_items.append(sentence)
        else:
            key_points.append(sentence)
    
    # 限制每个部分的条目数量
    def format_section(items, max_items=3):
        return [{"content": item, "type": "bullet", "color": "default"} 
                for item in items[:max_items]]
    
    return {
        "MeetingName": "会议摘要",
        "key_points": {
            "title": "Key Points",
            "blocks": format_section(key_points or ["从转录内容中提取的要点"])
        },
        "action_items": {
            "title": "Action Items", 
            "blocks": format_section(action_items or ["需要跟进的行动项目"])
        },
        "decisions": {
            "title": "Decisions",
            "blocks": format_section(decisions or ["会议中做出的决定"])
        },
        "main_topics": {
            "title": "Main Topics",
            "blocks": format_section(topics or ["讨论的主要话题"])
        }
    }

if __name__ == "__main__":
    # 测试
    test_text = "我找了一堆的研报也好，然后包括各种传统的论文，然后包括各种联储的论文，因为这个联储的论文比较多，然后学校的那些论文"
    
    result = simple_summary(test_text)
    print(json.dumps(result, indent=2, ensure_ascii=False))
