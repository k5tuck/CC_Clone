#!/usr/bin/env node
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';

const SimpleChat: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>(['System ready!']);

  useInput((char, key) => {
    if (key.return && input.trim()) {
      setMessages(prev => [...prev, `You: ${input}`, `Bot: Echo ${input}`]);
      setInput('');
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (char && !key.ctrl) {
      setInput(prev => prev + char);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Simple Chat Test</Text>
      
      {messages.slice(-5).map((msg, i) => (
        <Text key={i}>{msg}</Text>
      ))}
      
      <Text>
        <Text color="cyan">Input: </Text>
        {input || ' '}
        <Text color="cyan">|</Text>
      </Text>
      
      <Text dimColor>Type and press Enter</Text>
    </Box>
  );
};

render(<SimpleChat />);