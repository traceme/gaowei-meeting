'use client';

import { Block } from '@/types';
import { useRef, useState, useEffect } from 'react';

interface BlockProps {
  block: Block;
  isSelected: boolean;
  onTypeChange: (type: Block['type']) => void;
  onChange: (content: string) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter: () => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDelete?: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onNavigate?: (direction: 'up' | 'down', cursorPosition: number) => void;
}

interface CommandOption {
  id: string;
  label: string;
  type: Block['type'];
  icon: string;
  description: string;
}

const COMMANDS: CommandOption[] = [
  { 
    id: 'text', 
    label: 'Text', 
    type: 'text', 
    icon: 'T', 
    description: 'Just start writing with plain text' 
  },
  { 
    id: 'bullet', 
    label: 'Bullet List', 
    type: 'bullet', 
    icon: '•', 
    description: 'Create a bulleted list' 
  },
  { 
    id: 'h1', 
    label: 'Heading 1', 
    type: 'heading1', 
    icon: 'H1', 
    description: 'Big section heading' 
  },
  { 
    id: 'h2', 
    label: 'Heading 2', 
    type: 'heading2', 
    icon: 'H2', 
    description: 'Medium section heading' 
  },
];

export const BlockComponent: React.FC<BlockProps> = ({
  block,
  isSelected,
  onTypeChange,
  onChange,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  onKeyDown,
  onDelete,
  onContextMenu,
  onNavigate,
}) => {
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [block.content]);

  useEffect(() => {
    if (isSelected && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, [isSelected]);

  useEffect(() => {
    if (showCommands && commandsRef.current) {
      const selectedElement = commandsRef.current.children[selectedCommandIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedCommandIndex, showCommands]);

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.label.toLowerCase().includes(commandFilter.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter' && filteredCommands.length > 0) {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        handleCommandSelect(selectedCommand);
      } else if (e.key === 'Escape') {
        // Clear the slash command text when escaping
        const value = textareaRef.current?.value || '';
        const slashIndex = value.lastIndexOf('/');
        if (slashIndex >= 0) {
          onChange(value.slice(0, slashIndex).trimEnd());
        }
        setShowCommands(false);
      }
    } else if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPosition = textarea.selectionStart || 0;
        const selectionEnd = textarea.selectionEnd || cursorPosition;
        
        // Get the text before and after the cursor/selection
        const textBeforeCursor = block.content.substring(0, cursorPosition);
        const textAfterCursor = block.content.substring(selectionEnd);
        
        // Update current block with text before cursor
        onChange(textBeforeCursor);
        
        // Pass the text after cursor to parent for new block
        if (textAfterCursor) {
          e.currentTarget.dataset.newBlockContent = textAfterCursor;
          onKeyDown(e);
        } else {
          // If no text after cursor, still create new empty block
          e.currentTarget.dataset.newBlockContent = '';
          onKeyDown(e);
        }
      }
    } else if (e.key === 'Backspace' && onDelete) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart || 0;
      const selectionLength = (textarea.selectionEnd || 0) - cursorPosition;
      
      // Only delete block if cursor is at start and content is empty
      if (block.content === '' && cursorPosition === 0 && selectionLength === 0) {
        e.preventDefault();
        // Store cursor position in dataset for parent component
        e.currentTarget.dataset.cursorPosition = '0';
        onDelete();
      } else if (cursorPosition === 0 && selectionLength === 0) {
        // If at start of block but has content, merge with previous block
        e.preventDefault();
        e.currentTarget.dataset.mergeContent = block.content;
        onDelete();
      }
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && onNavigate) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart || 0;
      const isAtStart = cursorPosition === 0;
      const isAtEnd = cursorPosition === textarea.value.length;

      if ((e.key === 'ArrowUp' && isAtStart) || (e.key === 'ArrowDown' && isAtEnd)) {
        e.preventDefault();
        onNavigate(e.key === 'ArrowUp' ? 'up' : 'down', cursorPosition);
      }
    } else if (e.key !== 'Delete' && e.key !== 'Backspace') {
      // Only forward non-deletion events to parent
      onKeyDown(e);
    }
  };

  const handleCommandSelect = (command: CommandOption) => {
    if (!textareaRef.current) return;
    
    // Remove the slash command text completely
    onChange('');
    onTypeChange(command.type);
    setShowCommands(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    if (value.endsWith('/')) {
      setShowCommands(true);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      // Don't add the '/' to the content when entering command mode
      return;
    } else if (showCommands) {
      const slashIndex = value.lastIndexOf('/');
      if (slashIndex >= 0) {
        setCommandFilter(value.slice(slashIndex + 1));
        // Only update content before the slash
        onChange(value.slice(0, slashIndex));
        return;
      } else {
        setShowCommands(false);
      }
    }
    
    onChange(value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div 
      className={`group relative min-h-[24px] flex items-start rounded transition-colors
        ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
    >
      {block.type === 'bullet' && (
        <div className="flex-shrink-0 mr-2 select-none mt-[2px]">•</div>
      )}

      <div className="relative flex-1 py-0.5 px-1">
        <textarea
          ref={textareaRef}
          value={block.content}
          data-block-id={block.id}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => onMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>)}
          onMouseEnter={onMouseEnter}
          onMouseUp={(e) => onMouseUp(e as unknown as React.MouseEvent<HTMLDivElement>)}
          onContextMenu={onContextMenu}
          rows={1}
          className={`
            w-full resize-none overflow-hidden bg-transparent border-none p-0 focus:outline-none focus:ring-0
            ${block.color === 'gray' ? 'text-gray-500' : ''}
            ${block.type === 'heading1' ? 'text-xl font-bold' : ''}
            ${block.type === 'heading2' ? 'text-lg font-semibold' : ''}
          `}
          placeholder="Type '/' for commands..."
        />

        {showCommands && (
          <div 
            ref={commandsRef}
            className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          >
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`
                  w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-50
                  ${index === selectedCommandIndex ? 'bg-gray-50' : ''}
                `}
                onClick={() => handleCommandSelect(cmd)}
                onMouseEnter={() => setSelectedCommandIndex(index)}
              >
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600">
                  {cmd.icon}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{cmd.label}</div>
                  <div className="text-sm text-gray-500">{cmd.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
