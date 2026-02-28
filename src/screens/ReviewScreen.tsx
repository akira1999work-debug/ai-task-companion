import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Surface,
  IconButton,
  useTheme,
  Avatar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import type { ChatMessage } from '../types';
import { generateId } from '../db/database';
import { sendMessage } from '../services/aiProvider';

export default function ReviewScreen() {
  const theme = useTheme();
  const { chatMessages, addChatMessage, personality, tasks, aiConfig, setActiveConnection, setIsAiProcessing } = useApp();
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const trimmed = inputText.trim();
    setInputText('');

    const userMessage: ChatMessage = {
      id: generateId(),
      text: trimmed,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    addChatMessage(userMessage);
    setIsAiTyping(true);
    setIsAiProcessing(true);

    try {
      const result = await sendMessage(aiConfig, personality, tasks, chatMessages, trimmed, 'review');
      setActiveConnection(result.source);
      const aiMessage: ChatMessage = {
        id: generateId(),
        text: result.text,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(aiMessage);
    } catch (e) {
      const errorText = e instanceof Error ? e.message : 'AI応答の取得に失敗しました';
      const aiMessage: ChatMessage = {
        id: generateId(),
        text: errorText,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(aiMessage);
    } finally {
      setIsAiTyping(false);
      setIsAiProcessing(false);
    }
  };

  const getAiName = () => {
    if (personality === 'yuru') return 'ゆるアシ';
    if (personality === 'maji') return 'マジアシ';
    return 'AIアシスタント';
  };

  const getAiAvatar = () => {
    if (personality === 'yuru') return 'emoticon-happy-outline';
    if (personality === 'maji') return 'glasses';
    return 'robot-happy-outline';
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isAi = item.sender === 'ai';

    return (
      <View
        style={[
          styles.messageRow,
          { justifyContent: isAi ? 'flex-start' : 'flex-end' },
        ]}
      >
        {isAi && (
          <Avatar.Icon
            size={32}
            icon={getAiAvatar()}
            style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}
            color={theme.colors.primary}
          />
        )}
        <Surface
          style={[
            styles.messageBubble,
            isAi
              ? {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderBottomLeftRadius: 4,
                }
              : {
                  backgroundColor: theme.colors.primary,
                  borderBottomRightRadius: 4,
                },
          ]}
          elevation={1}
        >
          <Text
            variant="bodyMedium"
            style={{
              color: isAi ? theme.colors.onSurface : theme.colors.onPrimary,
              lineHeight: 22,
            }}
          >
            {item.text}
          </Text>
          <Text
            variant="labelSmall"
            style={[
              styles.timestamp,
              {
                color: isAi
                  ? theme.colors.outline
                  : theme.colors.onPrimary + '99',
              },
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Surface>
      </View>
    );
  };

  // Summary card at top
  const completedToday = tasks.filter(t => t.completed).length;
  const totalToday = tasks.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          レビュー
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
          {getAiName()}と対話
        </Text>
      </View>

      {/* Quick stats */}
      <Surface style={[styles.statsCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {completedToday}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onBackground }}>完了</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.outline + '30' }]} />
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {totalToday - completedToday}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onBackground }}>残り</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.outline + '30' }]} />
        <View style={styles.statItem}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0}%
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onBackground }}>達成率</Text>
        </View>
      </Surface>

      {/* Chat messages */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListFooterComponent={
          isAiTyping ? (
            <View style={[styles.messageRow, { justifyContent: 'flex-start' }]}>
              <Avatar.Icon
                size={32}
                icon={getAiAvatar()}
                style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}
                color={theme.colors.primary}
              />
              <Surface
                style={[styles.messageBubble, { backgroundColor: theme.colors.surfaceVariant, borderBottomLeftRadius: 4 }]}
                elevation={1}
              >
                <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                  入力中...
                </Text>
              </Surface>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline + '30' }]}>
          <TextInput
            mode="outlined"
            placeholder="メッセージを入力..."
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            style={styles.input}
            outlineStyle={{ borderRadius: 20 }}
            dense
          />
          <IconButton
            icon="send"
            mode="contained"
            size={20}
            onPress={handleSend}
            disabled={!inputText.trim()}
            containerColor={theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            style={styles.sendButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  avatar: {
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  timestamp: {
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    marginRight: 8,
    maxHeight: 80,
  },
  sendButton: {
    margin: 0,
  },
});
