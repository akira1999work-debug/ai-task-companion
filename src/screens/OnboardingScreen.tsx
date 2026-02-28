import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Chip,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useApp } from '../context/AppContext';
import { generateId } from '../db/database';
import * as DB from '../db/database';
import {
  getInitialGreeting,
  processOnboardingTurn,
  buildFinalCategories,
  extractUserProfile,
} from '../services/onboardingService';
import type {
  OnboardingState,
  OnboardingMessage,
  SuggestedCategory,
  TaskCategory,
  UserProfile,
} from '../types/onboarding';

// ---------------------------------------------------------------------------
// Screen phases
// ---------------------------------------------------------------------------

type Phase = 'chat' | 'review' | 'saving';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { personality, aiConfig } = useApp();

  // Onboarding state
  const [state, setState] = useState<OnboardingState>(() => ({
    collectedInfo: { work: false, hobby: false, goal: false, sidework: false },
    rawTranscript: '',
    turnCount: 0,
    maxTurns: 4,
    messages: [],
    suggestedCategories: [],
    isComplete: false,
    personality,
  }));

  const [phase, setPhase] = useState<Phase>('chat');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewCategories, setReviewCategories] = useState<SuggestedCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ---------------------------------------------------------------------------
  // Initial greeting
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const greeting = getInitialGreeting(personality);
    const msg: OnboardingMessage = {
      id: generateId(),
      text: greeting,
      sender: 'ai',
      timestamp: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, messages: [msg] }));
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [personality, fadeAnim]);

  // ---------------------------------------------------------------------------
  // Send user message
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');

    const userMsg: OnboardingMessage = {
      id: generateId(),
      text: userText,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const newTurnCount = state.turnCount + 1;

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      turnCount: newTurnCount,
    }));

    setIsProcessing(true);

    try {
      const updatedState = { ...state, turnCount: newTurnCount };
      const response = await processOnboardingTurn(aiConfig, updatedState, userText);

      // Merge collected info
      const mergedInfo = { ...state.collectedInfo };
      if (response.collectedUpdate.work) mergedInfo.work = true;
      if (response.collectedUpdate.hobby) mergedInfo.hobby = true;
      if (response.collectedUpdate.goal) mergedInfo.goal = true;
      if (response.collectedUpdate.sidework) mergedInfo.sidework = true;

      // Accumulate categories
      const allCategories = [...state.suggestedCategories, ...response.extractedCategories];

      const aiMsg: OnboardingMessage = {
        id: generateId(),
        text: response.reply,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };

      const shouldFinish = !response.shouldContinue || newTurnCount >= state.maxTurns;

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg, aiMsg].filter(
          (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i,
        ),
        collectedInfo: mergedInfo,
        rawTranscript: response.summary || prev.rawTranscript + '\n' + userText,
        suggestedCategories: allCategories,
        isComplete: shouldFinish,
      }));

      if (shouldFinish) {
        // Transition to review phase
        const finalCats = buildFinalCategories(allCategories);
        setReviewCategories(finalCats);
        setTimeout(function () { setPhase('review'); }, 1500);
      }
    } catch {
      const errorMsg: OnboardingMessage = {
        id: generateId(),
        text: 'ごめんなさい、うまく通信できませんでした。もう一度話してみてください。',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
        turnCount: newTurnCount - 1, // Don't count failed turn
      }));
    }

    setIsProcessing(false);
  }, [inputText, isProcessing, state, aiConfig]);

  // ---------------------------------------------------------------------------
  // Skip onboarding
  // ---------------------------------------------------------------------------

  const handleSkip = useCallback(async () => {
    setPhase('saving');
    setIsSaving(true);

    // Create default categories
    const defaults: TaskCategory[] = [
      { id: generateId(), name: '仕事', icon: 'briefcase-outline', color: '#3B82F6', sortOrder: 0, isDefault: false, scalingWeight: 'strict', parentId: null },
      { id: generateId(), name: '趣味', icon: 'gamepad-variant', color: '#10B981', sortOrder: 1, isDefault: false, scalingWeight: 'relaxed', parentId: null },
      { id: generateId(), name: '雑務', icon: 'package-variant', color: '#9CA3AF', sortOrder: 999, isDefault: true, scalingWeight: 'normal', parentId: null },
    ];

    await DB.bulkInsertCategories(db, defaults);
    await DB.setSetting(db, 'onboardingComplete', 'true');

    setIsSaving(false);
    onComplete();
  }, [db, onComplete]);

  // ---------------------------------------------------------------------------
  // Remove a suggested category
  // ---------------------------------------------------------------------------

  const handleRemoveCategory = useCallback((name: string) => {
    setReviewCategories((prev) => {
      // Don't allow removing "雑務"
      if (name === '雑務') return prev;
      return prev.filter((c) => c.name !== name);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Confirm categories & save
  // ---------------------------------------------------------------------------

  const handleConfirm = useCallback(async () => {
    setPhase('saving');
    setIsSaving(true);

    // Build TaskCategory array
    const categories: TaskCategory[] = reviewCategories.map((cat, index) => ({
      id: generateId(),
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      sortOrder: cat.name === '雑務' ? 999 : index,
      isDefault: cat.name === '雑務',
      scalingWeight: cat.scalingWeight,
      parentId: null,
    }));

    // Build UserProfile
    const profileData = extractUserProfile(state.rawTranscript, reviewCategories);
    const profile: UserProfile = {
      id: generateId(),
      onboardingRaw: state.rawTranscript,
      occupation: profileData.occupation,
      sideWork: profileData.sideWork,
      interests: profileData.interests,
      goals: profileData.goals,
      ageGroup: null,
      createdAt: new Date().toISOString(),
    };

    await DB.bulkInsertCategories(db, categories);
    await DB.insertUserProfile(db, profile);
    await DB.setSetting(db, 'onboardingComplete', 'true');

    setIsSaving(false);
    onComplete();
  }, [reviewCategories, state.rawTranscript, db, onComplete]);

  // ---------------------------------------------------------------------------
  // Scroll to bottom on new message
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (flatListRef.current && state.messages.length > 0) {
      setTimeout(function () {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages.length]);

  // ---------------------------------------------------------------------------
  // Render: Chat phase
  // ---------------------------------------------------------------------------

  const renderMessage = ({ item }: { item: OnboardingMessage }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.messageRow, isAi ? styles.aiRow : styles.userRow]}>
        <View
          style={[
            styles.bubble,
            isAi
              ? [styles.aiBubble, { backgroundColor: theme.colors.surfaceVariant }]
              : [styles.userBubble, { backgroundColor: theme.colors.primary }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isAi ? theme.colors.onSurface : theme.colors.onPrimary },
            ]}
          >
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  if (phase === 'saving') {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.savingText, { color: theme.colors.onBackground }]}>
          カテゴリを設定中...
        </Text>
      </View>
    );
  }

  if (phase === 'review') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.reviewHeader}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            あなたに合いそうなカテゴリ
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginTop: 8 }}>
            タップで編集、長押しで削除。あとからいつでも変更できます。
          </Text>
        </View>

        <View style={styles.categoryList}>
          {reviewCategories.map((cat) => (
            <Card
              key={cat.name}
              style={[styles.categoryCard, { backgroundColor: theme.colors.surface }]}
              onLongPress={function () { handleRemoveCategory(cat.name); }}
            >
              <Card.Content style={styles.categoryContent}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                    {cat.name}
                  </Text>
                </View>
                <Chip
                  compact
                  textStyle={{ fontSize: 11 }}
                  style={{ backgroundColor: theme.colors.surfaceVariant }}
                >
                  {cat.scalingWeight === 'strict' ? '厳格' : cat.scalingWeight === 'relaxed' ? 'ゆる' : '標準'}
                </Chip>
              </Card.Content>
            </Card>
          ))}
        </View>

        <View style={styles.reviewActions}>
          <Button
            mode="contained"
            onPress={handleConfirm}
            style={{ flex: 1, marginRight: 8 }}
            loading={isSaving}
          >
            これでスタート！
          </Button>
        </View>
      </View>
    );
  }

  // phase === 'chat'
  const turnInfo =
    state.turnCount > 0
      ? state.turnCount + ' / ' + state.maxTurns + ' ターン'
      : '';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outline + '30' }]}>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          はじめまして！
        </Text>
        <View style={styles.headerRight}>
          {turnInfo ? (
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginRight: 8 }}>
              {turnInfo}
            </Text>
          ) : null}
          <Button compact mode="text" onPress={handleSkip} textColor={theme.colors.outline}>
            スキップ
          </Button>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={state.messages}
        renderItem={renderMessage}
        keyExtractor={function (item) { return item.id; }}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {isProcessing ? (
        <View style={[styles.messageRow, styles.aiRow]}>
          <View style={[styles.bubble, styles.aiBubble, { backgroundColor: theme.colors.surfaceVariant }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        </View>
      ) : null}

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline + '30' }]}>
        <TextInput
          mode="outlined"
          placeholder="なんでも気軽に話してください..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          style={styles.textInput}
          dense
          right={
            <TextInput.Icon
              icon="send"
              disabled={!inputText.trim() || isProcessing}
              onPress={handleSend}
            />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  savingText: { marginTop: 16, fontSize: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },

  // Messages
  messageList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  messageRow: { marginBottom: 12 },
  aiRow: { alignItems: 'flex-start' },
  userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  aiBubble: { borderTopLeftRadius: 4 },
  userBubble: { borderTopRightRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },

  // Input
  inputBar: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  textInput: { fontSize: 15 },

  // Review phase
  reviewHeader: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  categoryList: { flex: 1, paddingHorizontal: 16 },
  categoryCard: { marginBottom: 8, borderRadius: 12 },
  categoryContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryLeft: { flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  reviewActions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16 },
});
