/**
 * Agent Communication Panel Component
 * Displays agent-to-agent messages and conversation threads
 */

import React from 'react';
import { Box, Text } from 'ink';
import {
  AgentCommunicationLog,
  InterAgentMessage,
  ConversationThread,
  MessageType,
  MessagePriority,
} from '../../lib/agents/AgentCommunication';

interface AgentCommunicationPanelProps {
  communicationLog: AgentCommunicationLog;
  mode?: 'messages' | 'threads';
  maxDisplay?: number;
}

export const AgentCommunicationPanel: React.FC<AgentCommunicationPanelProps> = ({
  communicationLog,
  mode = 'threads',
  maxDisplay = 5,
}) => {
  const activeThreads = communicationLog.getActiveThreads().slice(0, maxDisplay);
  const recentMessages = communicationLog['messageHistory']
    ? (communicationLog as any).messageHistory.slice(0, maxDisplay)
    : [];

  const getMessageTypeIcon = (type: MessageType): string => {
    switch (type) {
      case MessageType.REQUEST:
        return '❓';
      case MessageType.RESPONSE:
        return '💬';
      case MessageType.NOTIFICATION:
        return '📢';
      case MessageType.ERROR:
        return '❌';
      case MessageType.HANDOFF:
        return '🔀';
      case MessageType.BROADCAST:
        return '📡';
      default:
        return '•';
    }
  };

  const getPriorityColor = (priority: MessagePriority): string => {
    switch (priority) {
      case MessagePriority.LOW:
        return 'gray';
      case MessagePriority.NORMAL:
        return 'white';
      case MessagePriority.HIGH:
        return 'yellow';
      case MessagePriority.URGENT:
        return 'red';
      default:
        return 'white';
    }
  };

  const formatTime = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const renderMessage = (message: InterAgentMessage): JSX.Element => {
    return (
      <Box key={message.id} flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={getPriorityColor(message.priority)}>
            {getMessageTypeIcon(message.type)}{' '}
          </Text>
          <Text bold>{message.from}</Text>
          <Text color="gray"> → </Text>
          <Text>{Array.isArray(message.to) ? message.to.join(', ') : message.to}</Text>
          <Box flexGrow={1} />
          <Text color="gray" dimColor>
            {formatTime(message.timestamp)}
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Text bold color="cyan">
            {message.subject}
          </Text>
          {!message.read && (
            <Text color="yellow"> (unread)</Text>
          )}
        </Box>
        {typeof message.content === 'string' && (
          <Box paddingLeft={2}>
            <Text color="gray">{message.content.slice(0, 60)}...</Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderThread = (thread: ConversationThread): JSX.Element => {
    return (
      <Box key={thread.id} flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="cyan">
            💬 {thread.subject}
          </Text>
          <Text color="gray"> ({thread.messages.length} messages)</Text>
          <Box flexGrow={1} />
          <Text color="gray" dimColor>
            {formatTime(thread.lastActivity)}
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color="gray">
            Participants: {thread.participants.join(', ')}
          </Text>
        </Box>
        <Box paddingLeft={2} flexDirection="column">
          {thread.messages.slice(-2).map(msg => (
            <Box key={msg.id}>
              <Text color="gray">
                {msg.from}: {typeof msg.content === 'string' ? msg.content.slice(0, 40) : '...'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          📨 Agent Communication
        </Text>
        <Box flexGrow={1} />
        <Text color="gray" dimColor>
          Ctrl+M
        </Text>
      </Box>

      {mode === 'threads' && (
        <Box flexDirection="column">
          <Text bold color="white">
            Active Threads ({activeThreads.length}):
          </Text>
          {activeThreads.length > 0 ? (
            activeThreads.map(renderThread)
          ) : (
            <Box paddingLeft={2}>
              <Text color="gray" dimColor>
                No active conversation threads
              </Text>
            </Box>
          )}
        </Box>
      )}

      {mode === 'messages' && (
        <Box flexDirection="column">
          <Text bold color="white">
            Recent Messages:
          </Text>
          {recentMessages.length > 0 ? (
            recentMessages.map(renderMessage)
          ) : (
            <Box paddingLeft={2}>
              <Text color="gray" dimColor>
                No messages yet
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Help Text */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Press Ctrl+Shift+M to toggle between messages and threads
        </Text>
      </Box>
    </Box>
  );
};
