import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  IconButton,
  TextInput,
  Surface,
  useTheme,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

const AI_RESPONSES = [
  'タスクを追加しました：「企画書のレビュー」\n期限: 明日 17:00\n優先度: 高',
  'タスクを追加しました：「ジョギング30分」\n繰り返し: 毎日\n優先度: 中',
  'タスクを追加しました：「メール返信」\n期限: 今日中\n優先度: 高',
  '「ストレッチ」を完了にしました！お疲れさまです 💪',
];

export default function HomeScreen() {
  const theme = useTheme();
  const { addTask, personality, rescheduleAllTasks, completeTaskByVoice } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isRecording, setIsRecording] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      rippleAnim.stopAnimation();
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
    }
  }, [isRecording]);

  const handleMicPress = () => {
    if (isRecording) {
      setIsRecording(false);
      simulateAiResponse();
    } else {
      setIsRecording(true);
      setAiResponse(null);
    }
  };

  const simulateAiResponse = () => {
    const response = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    setAiResponse(response);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Mock: add a new task
    addTask({
      id: Date.now().toString(),
      title: '音声で追加されたタスク',
      completed: false,
      priority: 'medium',
      isRecurring: false,
      subTasks: [],
      createdAt: new Date().toISOString(),
    });
  };

  const handleTextSubmit = () => {
    if (!textValue.trim()) return;

    // Check for completion voice command
    if (textValue.includes('終わった') || textValue.includes('完了')) {
      const taskName = textValue.replace(/終わった|完了|よ|！|!/g, '').trim();
      completeTaskByVoice(taskName);
      setAiResponse(`「${taskName}」を完了にしました！お疲れさまです ✨`);
    } else {
      addTask({
        id: Date.now().toString(),
        title: textValue.trim(),
        completed: false,
        priority: 'medium',
        isRecurring: false,
        subTasks: [],
        createdAt: new Date().toISOString(),
      });
      setAiResponse(`タスクを追加しました：「${textValue.trim()}」`);
    }

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setTextValue('');
    setShowTextInput(false);
  };

  const handleReschedule = () => {
    rescheduleAllTasks();
    setShowRescheduleConfirm(false);
    setAiResponse('今日のタスクをすべて明日に移動しました。ゆっくり休んでくださいね 🌙');
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (personality === 'yuru') {
      if (hour < 12) return 'おはよ〜！✨ きょうも一緒にがんばろ〜';
      if (hour < 18) return 'やっほ〜！午後もファイトだよ〜💕';
      return 'おつかれ〜！今日もよくがんばったね〜🌙';
    }
    if (personality === 'maji') {
      if (hour < 12) return 'おはようございます。本日のタスクを確認しましょう。';
      if (hour < 18) return '午後の部です。集中して取り組みましょう。';
      return 'お疲れ様です。本日の振り返りをしましょう。';
    }
    if (hour < 12) return 'おはようございます！今日のタスクを話しかけてください';
    if (hour < 18) return 'こんにちは！何かタスクを追加しますか？';
    return 'こんばんは！今日の振り返りをしましょう';
  };

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.greeting, { color: theme.colors.onBackground }]}>
          {getGreeting()}
        </Text>
        <IconButton
          icon="cog"
          size={24}
          onPress={() => navigation.navigate('Settings')}
          iconColor={theme.colors.onBackground}
        />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* AI Response */}
        {aiResponse && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Surface
              style={[
                styles.responseCard,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              elevation={2}
            >
              <MaterialCommunityIcons
                name="robot-happy-outline"
                size={24}
                color={theme.colors.primary}
                style={styles.responseIcon}
              />
              <Text
                variant="bodyLarge"
                style={{ color: theme.colors.onBackground, flex: 1 }}
              >
                {aiResponse}
              </Text>
            </Surface>
          </Animated.View>
        )}

        {/* Mic button area */}
        <View style={styles.micArea}>
          {/* Ripple effect */}
          {isRecording && (
            <Animated.View
              style={[
                styles.ripple,
                {
                  backgroundColor: theme.colors.primary,
                  transform: [{ scale: rippleScale }],
                  opacity: rippleOpacity,
                },
              ]}
            />
          )}

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              style={[
                styles.micButton,
                {
                  backgroundColor: isRecording
                    ? theme.colors.error
                    : theme.colors.primary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isRecording ? 'stop' : 'microphone'}
                size={48}
                color="#FFFFFF"
              />
            </Pressable>
          </Animated.View>

          <Text
            variant="bodyMedium"
            style={[styles.micLabel, { color: theme.colors.onSurface }]}
          >
            {isRecording ? '話しています... タップで停止' : 'タップして話す'}
          </Text>
        </View>
      </View>

      {/* Bottom actions */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomActions}
      >
        {showTextInput ? (
          <View style={styles.textInputRow}>
            <TextInput
              mode="outlined"
              placeholder="テキストでタスクを入力..."
              value={textValue}
              onChangeText={setTextValue}
              onSubmitEditing={handleTextSubmit}
              style={styles.textInput}
              autoFocus
              right={
                <TextInput.Icon
                  icon="send"
                  onPress={handleTextSubmit}
                />
              }
            />
            <IconButton
              icon="close"
              size={20}
              onPress={() => setShowTextInput(false)}
            />
          </View>
        ) : (
          <View style={styles.actionRow}>
            <IconButton
              icon="keyboard-outline"
              size={28}
              onPress={() => setShowTextInput(true)}
              iconColor={theme.colors.onSurface}
              style={[styles.actionButton, { backgroundColor: theme.colors.surfaceVariant }]}
            />
            <Button
              mode="contained-tonal"
              onPress={() => setShowRescheduleConfirm(true)}
              icon="calendar-refresh"
              buttonColor={theme.colors.error}
              textColor="#FFFFFF"
              style={styles.rescheduleButton}
            >
              今日は無理！
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Reschedule confirmation modal */}
      <Portal>
        <Modal
          visible={showRescheduleConfirm}
          onDismiss={() => setShowRescheduleConfirm(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <MaterialCommunityIcons
            name="emoticon-sad-outline"
            size={48}
            color={theme.colors.primary}
            style={{ alignSelf: 'center', marginBottom: 16 }}
          />
          <Text
            variant="headlineSmall"
            style={{ textAlign: 'center', marginBottom: 8, color: theme.colors.onSurface }}
          >
            緊急リスケ
          </Text>
          <Text
            variant="bodyMedium"
            style={{ textAlign: 'center', marginBottom: 24, color: theme.colors.onSurface }}
          >
            今日の未完了タスクをすべて明日に移動しますか？{'\n'}
            無理しないでくださいね。
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowRescheduleConfirm(false)}
              style={{ flex: 1, marginRight: 8 }}
            >
              やっぱやる
            </Button>
            <Button
              mode="contained"
              onPress={handleReschedule}
              style={{ flex: 1, marginLeft: 8 }}
            >
              移動する
            </Button>
          </View>
        </Modal>
      </Portal>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  greeting: {
    flex: 1,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  responseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
  },
  responseIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  micArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  micLabel: {
    marginTop: 16,
    opacity: 0.7,
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 12,
  },
  rescheduleButton: {
    borderRadius: 12,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
});
