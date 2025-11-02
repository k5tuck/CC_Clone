/**
 * Permission Prompt Component
 * Interactive prompt for requesting user permission
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import {
  PermissionRequest,
  PermissionResponse,
  PermissionDecision,
  TrustLevel,
} from '../../lib/permissions';
import { getRiskIndicator } from '../../lib/permissions';

interface PermissionPromptProps {
  request: PermissionRequest;
  onDecision: (decision: PermissionDecision) => void;
  currentTrustLevel?: TrustLevel;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  request,
  onDecision,
  currentTrustLevel,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedCommand, setEditedCommand] = useState(request.details.command || '');

  const riskIndicator = getRiskIndicator(request.riskLevel);

  // Build choice items based on operation type
  const choices: Array<{ label: string; value: PermissionResponse }> = [
    {
      label: '[Y] Yes, allow this once',
      value: PermissionResponse.ALLOW_ONCE,
    },
    {
      label: '[A] Yes, allow for this session',
      value: PermissionResponse.ALLOW_SESSION,
    },
    {
      label: '[T] Always trust (this project)',
      value: PermissionResponse.ALLOW_PROJECT,
    },
    {
      label: '[N] No, deny this operation',
      value: PermissionResponse.DENY,
    },
  ];

  // Add edit option for commands
  if (request.details.command) {
    choices.push({
      label: '[E] Edit command before running',
      value: PermissionResponse.EDIT,
    });
  }

  const handleSelect = (item: { value: PermissionResponse }) => {
    if (item.value === PermissionResponse.EDIT) {
      setEditMode(true);
      return;
    }

    const decision: PermissionDecision = {
      requestId: request.id,
      response: item.value,
      timestamp: new Date(),
      editedCommand: editedCommand !== request.details.command ? editedCommand : undefined,
    };

    onDecision(decision);
  };

  if (editMode) {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="yellow" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="yellow">
            Edit Command
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text>Original: {request.details.command}</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="cyan">Edited: {editedCommand}</Text>
        </Box>
        <Box>
          <Text dimColor>
            (Press Enter to accept, or close and retry)
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" padding={1} marginY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️  Permission Required
        </Text>
      </Box>

      {/* Risk indicator */}
      <Box marginBottom={1}>
        <Text>
          {riskIndicator.emoji} Risk Level:{' '}
        </Text>
        <Text bold color={riskIndicator.color as any}>
          {request.riskLevel.toUpperCase()}
        </Text>
      </Box>

      {/* Agent/Tool info */}
      <Box marginBottom={1}>
        <Text dimColor>Requested by: </Text>
        <Text color="cyan">{request.requestedBy}</Text>
      </Box>

      {/* Operation description */}
      <Box marginBottom={1}>
        <Text bold>{request.description}</Text>
      </Box>

      {/* Command/File details */}
      {request.details.command && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          padding={1}
          marginBottom={1}
        >
          <Text color="gray">$ {request.details.command}</Text>
        </Box>
      )}

      {request.details.filePath && !request.details.command && (
        <Box marginBottom={1}>
          <Text color="gray">Path: {request.details.filePath}</Text>
        </Box>
      )}

      {request.details.packageName && (
        <Box marginBottom={1}>
          <Text color="gray">Package: {request.details.packageName}</Text>
        </Box>
      )}

      {request.details.url && (
        <Box marginBottom={1}>
          <Text color="gray">URL: {request.details.url}</Text>
        </Box>
      )}

      {/* Current trust level */}
      {currentTrustLevel && (
        <Box marginBottom={1}>
          <Text dimColor>Current trust: </Text>
          <Text color="cyan">{currentTrustLevel.replace('_', ' ')}</Text>
        </Box>
      )}

      {/* Divider */}
      <Box marginBottom={1}>
        <Text color="gray">{'─'.repeat(50)}</Text>
      </Box>

      {/* Prompt text */}
      <Box marginBottom={1}>
        <Text bold>What would you like to do?</Text>
      </Box>

      {/* Choice selector */}
      <SelectInput items={choices} onSelect={handleSelect} />
    </Box>
  );
};
